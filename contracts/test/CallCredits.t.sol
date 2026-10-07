// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CallCredits} from "../src/CallCredits.sol";
import {FeeToken, MockToken} from "./Mocks.sol";

contract CallCreditsTest is Test {
    MockToken usdg;
    CallCredits credits;
    address treasury = address(0x7EA5);
    address buyer = address(0xB1);
    address friend = address(0xF1);

    function setUp() public {
        usdg = new MockToken("Global Dollar", "USDG", 6);
        credits = new CallCredits(IERC20(address(usdg)), treasury, 1000, 1e6); // 1,000 calls for 1 USDG
        usdg.mint(buyer, 1_000e6);
        vm.prank(buyer);
        usdg.approve(address(credits), type(uint256).max);
    }

    function test_constructor_rejects_bad_terms() public {
        vm.expectRevert(CallCredits.ZeroAddress.selector);
        new CallCredits(IERC20(address(0)), treasury, 1000, 1e6);
        vm.expectRevert(CallCredits.ZeroAddress.selector);
        new CallCredits(IERC20(address(usdg)), address(0), 1000, 1e6);
        vm.expectRevert(CallCredits.BadTerms.selector);
        new CallCredits(IERC20(address(0xdead)), treasury, 1000, 1e6);
        vm.expectRevert(CallCredits.BadTerms.selector);
        new CallCredits(IERC20(address(usdg)), treasury, 0, 1e6);
        vm.expectRevert(CallCredits.BadTerms.selector);
        new CallCredits(IERC20(address(usdg)), treasury, 1000, 0);
        vm.expectRevert(CallCredits.BadTerms.selector);
        new CallCredits(IERC20(address(usdg)), treasury, 1e9 + 1, 1e6);
    }

    function test_buy_pays_treasury_and_records_calls() public {
        vm.expectEmit(true, true, true, true);
        emit CallCredits.Purchased(buyer, friend, 3, 3000, 3e6);
        vm.prank(buyer);
        uint256 calls = credits.buy(friend, 3);
        assertEq(calls, 3000);
        assertEq(usdg.balanceOf(treasury), 3e6);
        assertEq(usdg.balanceOf(address(credits)), 0);
        assertEq(credits.callsPurchased(friend), 3000);
        assertEq(credits.amountPaid(friend), 3e6);
        assertEq(credits.callsPurchased(buyer), 0);
        assertEq(credits.totalPaid(), 3e6);
        (uint256 amount, uint256 c) = credits.quote(5);
        assertEq(amount, 5e6);
        assertEq(c, 5000);
    }

    function test_buy_rejects() public {
        vm.startPrank(buyer);
        vm.expectRevert(CallCredits.ZeroPacks.selector);
        credits.buy(buyer, 0);
        vm.expectRevert(CallCredits.ZeroAddress.selector);
        credits.buy(address(0), 1);
        vm.stopPrank();
        // Not enough balance or allowance: the token reverts, nothing is recorded.
        vm.prank(friend);
        vm.expectRevert();
        credits.buy(friend, 1);
        assertEq(credits.callsPurchased(friend), 0);
    }

    function test_fee_on_transfer_token_is_refused() public {
        FeeToken fee = new FeeToken();
        CallCredits c = new CallCredits(IERC20(address(fee)), treasury, 1000, 100e6);
        fee.mint(buyer, 1_000e6);
        vm.startPrank(buyer);
        fee.approve(address(c), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(CallCredits.TransferShortfall.selector, 100e6, 99e6));
        c.buy(buyer, 1);
        vm.stopPrank();
    }

    function testFuzz_buy(uint32 packs, address account) public {
        vm.assume(account != address(0));
        packs = uint32(bound(packs, 1, 1000));
        uint256 beforeT = usdg.balanceOf(treasury);
        vm.prank(buyer);
        credits.buy(account, packs);
        assertEq(usdg.balanceOf(treasury) - beforeT, uint256(packs) * 1e6);
        assertEq(credits.callsPurchased(account), uint256(packs) * 1000);
        assertEq(usdg.balanceOf(address(credits)), 0);
    }
}
