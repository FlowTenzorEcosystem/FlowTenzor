// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ModelBond, IModelOwners} from "../src/ModelBond.sol";
import {ForecastOracle} from "../src/ForecastOracle.sol";
import {FeeToken, MockFeed, MockOwners, MockToken} from "./Mocks.sol";

contract ModelBondTest is Test {
    MockToken token;
    MockOwners owners;
    ModelBond bonds;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint256 constant AMOUNT = 1_000_000e18;

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new MockToken("FlowTenzor", "FLOWTENZOR", 18);
        owners = new MockOwners();
        owners.set(1, alice);
        owners.set(2, bob);
        bonds = new ModelBond(IERC20(address(token)), IModelOwners(address(owners)), AMOUNT, 7 days);
        token.mint(alice, 10 * AMOUNT);
        token.mint(bob, 10 * AMOUNT);
        vm.prank(alice);
        token.approve(address(bonds), type(uint256).max);
        vm.prank(bob);
        token.approve(address(bonds), type(uint256).max);
    }

    function test_constructor_rejects_bad_terms() public {
        IERC20 t = IERC20(address(token));
        IModelOwners o = IModelOwners(address(owners));
        vm.expectRevert(ModelBond.ZeroAddress.selector);
        new ModelBond(IERC20(address(0)), o, AMOUNT, 7 days);
        vm.expectRevert(ModelBond.ZeroAddress.selector);
        new ModelBond(t, IModelOwners(address(0)), AMOUNT, 7 days);
        vm.expectRevert(ModelBond.BadTerms.selector);
        new ModelBond(IERC20(address(0xdead)), o, AMOUNT, 7 days);
        vm.expectRevert(ModelBond.BadTerms.selector);
        new ModelBond(t, o, 0, 7 days);
        vm.expectRevert(ModelBond.BadTerms.selector);
        new ModelBond(t, o, AMOUNT, 23 hours);
        vm.expectRevert(ModelBond.BadTerms.selector);
        new ModelBond(t, o, AMOUNT, 91 days);
    }

    function test_bond_exit_withdraw() public {
        vm.expectEmit(true, true, true, true);
        emit ModelBond.Bonded(1, alice, AMOUNT);
        vm.prank(alice);
        bonds.bond(1);
        assertTrue(bonds.isBonded(1));
        assertEq(token.balanceOf(address(bonds)), AMOUNT);
        assertEq(bonds.totalBonded(), AMOUNT);

        vm.expectRevert(abi.encodeWithSelector(ModelBond.AlreadyBonded.selector, 1));
        vm.prank(alice);
        bonds.bond(1);

        vm.expectRevert(abi.encodeWithSelector(ModelBond.ExitNotRequested.selector, 1));
        vm.prank(alice);
        bonds.withdraw(1);

        uint256 t0 = vm.getBlockTimestamp();
        vm.expectEmit(true, true, true, true);
        emit ModelBond.ExitRequested(1, alice, t0 + 7 days);
        vm.prank(alice);
        bonds.requestExit(1);
        assertFalse(bonds.isBonded(1)); // stops counting right away

        vm.expectRevert(abi.encodeWithSelector(ModelBond.ExitPending.selector, 1));
        vm.prank(alice);
        bonds.requestExit(1);

        vm.warp(t0 + 7 days - 1);
        vm.expectRevert(abi.encodeWithSelector(ModelBond.TooEarly.selector, t0 + 7 days));
        vm.prank(alice);
        bonds.withdraw(1);

        vm.warp(t0 + 7 days);
        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        bonds.withdraw(1);
        assertEq(token.balanceOf(alice) - before, AMOUNT);
        assertEq(bonds.totalBonded(), 0);
        assertEq(bonds.bondOf(1, alice).amount, 0);

        // A fresh bond is allowed after withdrawing.
        vm.prank(alice);
        bonds.bond(1);
        assertTrue(bonds.isBonded(1));
    }

    function test_only_the_model_owner_bonds() public {
        vm.expectRevert(abi.encodeWithSelector(ModelBond.NotModelOwner.selector, 1));
        vm.prank(bob);
        bonds.bond(1);
        vm.expectRevert(abi.encodeWithSelector(ModelBond.NoBond.selector, 1));
        vm.prank(bob);
        bonds.requestExit(1);
        vm.expectRevert(abi.encodeWithSelector(ModelBond.NoBond.selector, 1));
        vm.prank(bob);
        bonds.withdraw(1);
        assertFalse(bonds.isBonded(99)); // unknown model
    }

    function test_transfer_of_model_changes_bonded_status() public {
        vm.prank(alice);
        bonds.bond(1);
        owners.set(1, bob); // the model changes hands
        assertFalse(bonds.isBonded(1));
        // The new owner can bond without waiting for the old owner, who keeps their exit.
        vm.prank(bob);
        bonds.bond(1);
        assertTrue(bonds.isBonded(1));
        vm.prank(alice);
        bonds.requestExit(1);
        assertTrue(bonds.isBonded(1));
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.prank(alice);
        bonds.withdraw(1);
        assertEq(token.balanceOf(address(bonds)), AMOUNT);

        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 77;
        bool[] memory out = bonds.bondedMany(ids);
        assertTrue(out[0]);
        assertFalse(out[1]);
        assertFalse(out[2]);
    }

    function test_fee_on_transfer_token_is_refused() public {
        FeeToken fee = new FeeToken();
        ModelBond b = new ModelBond(IERC20(address(fee)), IModelOwners(address(owners)), 100e18, 7 days);
        fee.mint(alice, 1000e18);
        vm.startPrank(alice);
        fee.approve(address(b), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(ModelBond.TransferShortfall.selector, 100e18, 99e18));
        b.bond(1);
        vm.stopPrank();
    }

    function test_works_with_the_real_oracle() public {
        MockFeed feed = new MockFeed();
        feed.pushNow(100e8);
        address[] memory feeds = new address[](1);
        feeds[0] = address(feed);
        bytes32[] memory symbols = new bytes32[](1);
        symbols[0] = "SPY";
        ForecastOracle oracle = new ForecastOracle(feeds, symbols, 1 days);
        ModelBond b = new ModelBond(IERC20(address(token)), IModelOwners(address(oracle)), AMOUNT, 7 days);
        vm.startPrank(alice);
        uint256 id = oracle.registerModel("Still Water", "");
        token.approve(address(b), type(uint256).max);
        b.bond(id);
        vm.stopPrank();
        assertTrue(b.isBonded(id));
        assertFalse(b.isBonded(id + 1)); // the oracle reverts for unknown models; isBonded answers false
    }

    function testFuzz_balance_equals_total(uint8 ops, uint256 seed) public {
        ops = uint8(bound(ops, 1, 40));
        for (uint256 i; i < ops; ++i) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            address who = r % 2 == 0 ? alice : bob;
            uint256 model = who == alice ? 1 : 2;
            uint256 action = (r >> 8) % 3;
            vm.startPrank(who);
            if (action == 0) {
                try bonds.bond(model) {} catch {}
            } else if (action == 1) {
                try bonds.requestExit(model) {} catch {}
            } else {
                try bonds.withdraw(model) {} catch {}
            }
            vm.stopPrank();
            vm.warp(vm.getBlockTimestamp() + ((r >> 16) % 4 days));
            assertEq(token.balanceOf(address(bonds)), bonds.totalBonded());
        }
    }
}
