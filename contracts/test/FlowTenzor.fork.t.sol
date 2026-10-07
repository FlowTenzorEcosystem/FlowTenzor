// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ForecastOracle} from "../src/ForecastOracle.sol";
import {CallCredits} from "../src/CallCredits.sol";
import {ModelBond, IModelOwners} from "../src/ModelBond.sol";
import {IPriceFeed} from "../src/IPriceFeed.sol";

/// Exposes the round proof so it can be checked against real Chainlink history.
contract OracleHarness is ForecastOracle {
    constructor(address[] memory feeds, bytes32[] memory symbols, uint256 age) ForecastOracle(feeds, symbols, age) {}

    function priceAt(address feed, uint80 round, uint256 at) external view returns (uint256) {
        return _priceAt(feed, round, at);
    }
}

/// Runs against Robinhood Chain mainnet state:
///   FORK_URL=https://rpc.mainnet.chain.robinhood.com forge test --mc Fork --evm-version cancun
contract ForkTest is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant NVDA_FEED = 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15;
    OracleHarness oracle;
    bool forked;

    function _markets() internal pure returns (address[] memory f, bytes32[] memory s) {
        f = new address[](36);
        s = new bytes32[](36);
        f[0] = 0x6B22A786bAa607d76728168703a39Ea9C99f2cD0;
        f[1] = 0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72;
        f[2] = 0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C;
        f[3] = 0xB4106147E8cce40b7d46124090d373A71b70f87D;
        f[4] = 0x62Cc8F9b5f56a33c9C8A60c8B92779f523c4E984;
        f[5] = 0x810c12D3a554Bc47fd39597Fe3b3AAC4941F50eF;
        f[6] = 0xA3a468A452940B7D6b69991207B508c609a98Ef2;
        f[7] = 0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a;
        f[8] = 0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C;
        f[9] = 0x1C6c8cADBe02E19129c39dDB92281cE4c0bf206b;
        f[10] = 0xEFdf54610B62A7753Ec30bDc380847c12D32e1D1;
        f[11] = 0x470A51258068043bd43dC0a56245625C9fE86eB0;
        f[12] = 0x27C71df6A64fB476468EdF256CF72c038baB5B67;
        f[13] = 0xF6f373a037c30F0e5010d854385cA89185AE638b;
        f[14] = 0x3f390C5C24628Ac7C489515402235FeAD71D1913;
        f[15] = 0x22EfeC4919baf55F360E0EDee4AbEB26DE4971eb;
        f[16] = 0x7C38C00C30BEe9378381E7B6135d7283356D71b1;
        f[17] = 0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E;
        f[18] = 0x396118bdFB181e6240E74D243F266B061c0edc3D;
        f[19] = 0x425EEFdCf05ed6526C3cE61Af99429A228a6d596;
        f[20] = 0xE1D87B116Ba0fe898998f1D140339D1fA1E09705;
        f[21] = 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15;
        f[22] = 0x0e6a64a2B58A6693a531E6c555f3A5d042eEA844;
        f[23] = 0x820ABedFF239034956B7A9d2F0a331f9F075eB4c;
        f[24] = 0x80901d846d5D7B030F26B480776EE3b29374C2ae;
        f[25] = 0x2A045cF1C49c61c166C036d2f06FA2D2d984f765;
        f[26] = 0x045477BF65Aef6f4F2386ad0164579e48381CC74;
        f[27] = 0xa0DF4ee0fFf975306345875E3548Fcc519577A11;
        f[28] = 0x209b73908e92Ae021826eD79609845451Ecba2ce;
        f[29] = 0xfb133Fa4B7b385802B693a293606682Df47109A3;
        f[30] = 0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb;
        f[31] = 0x319724394D3A0e3669269846abE664Cd621f9f6A;
        f[32] = 0x4A1166a659A55625345e9515b32adECea5547C38;
        f[33] = 0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F;
        f[34] = 0xA994d3684e8400A6c8078226925779FdeE682DD9;
        f[35] = 0x75a9c76Ef439e2C7c2E5a34Ab105EcFe3766431c;
        s[0] = "AAPL";
        s[1] = "AMD";
        s[2] = "AMZN";
        s[3] = "ASML";
        s[4] = "BABA";
        s[5] = "CLSK";
        s[6] = "COIN";
        s[7] = "CRCL";
        s[8] = "CRWV";
        s[9] = "DELL";
        s[10] = "EWY";
        s[11] = "GLD";
        s[12] = "GME";
        s[13] = "GOOGL";
        s[14] = "INTC";
        s[15] = "IONQ";
        s[16] = "META";
        s[17] = "MSFT";
        s[18] = "MSTR";
        s[19] = "MU";
        s[20] = "NBIS";
        s[21] = "NVDA";
        s[22] = "ORCL";
        s[23] = "PLTR";
        s[24] = "QQQ";
        s[25] = "RGTI";
        s[26] = "RKLB";
        s[27] = "SGOV";
        s[28] = "SLV";
        s[29] = "SNDK";
        s[30] = "SPCX";
        s[31] = "SPY";
        s[32] = "TSLA";
        s[33] = "TSM";
        s[34] = "USAR";
        s[35] = "USO";
    }

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) return;
        vm.createSelectFork(url);
        forked = true;
        (address[] memory f, bytes32[] memory s) = _markets();
        oracle = new OracleHarness(f, s, 4 days);
    }

    function test_fork_lists_every_real_feed() public view {
        if (!forked) return;
        assertEq(oracle.marketCount(), 36);
        for (uint256 i; i < 36; ++i) {
            assertEq(IPriceFeed(oracle.market(i).feed).decimals(), 8);
        }
    }

    function test_fork_commit_reads_the_live_feed() public {
        if (!forked) return;
        uint256 nvda = 21;
        assertEq(oracle.market(nvda).symbol, bytes32("NVDA"));
        (uint80 round, int256 answer,, uint256 updatedAt,) = IPriceFeed(NVDA_FEED).latestRoundData();
        // Weekends and quiet hours can leave the feed old; the oracle refuses answers older than four days.
        if (vm.getBlockTimestamp() - updatedAt >= 4 days) return;
        uint256 ref = uint256(answer);
        uint256 id = oracle.registerModel("fork model", "");
        uint256 f = oracle.commit(
            id, ForecastOracle.CommitInput(uint16(nvda), 1, uint128((ref * 98) / 100), uint128((ref * 103) / 100), 8000)
        );
        ForecastOracle.Forecast memory fc = oracle.getForecast(f);
        assertEq(fc.referencePrice, ref);
        assertEq(fc.referenceRound, round);
        assertEq(fc.direction, int8(1));
        // Nothing newer exists on the fork: a day later the same round is still current, so the forecast is void.
        vm.warp(vm.getBlockTimestamp() + 1 days + 1);
        assertEq(uint8(oracle.score(f, round)), uint8(ForecastOracle.Status.Void));
    }

    function test_fork_round_proof_on_real_history() public view {
        if (!forked) return;
        (uint80 latest,,, uint256 tLatest,) = IPriceFeed(NVDA_FEED).latestRoundData();
        (,,, uint256 t1,) = IPriceFeed(NVDA_FEED).getRoundData(latest - 1);
        (,,, uint256 t2,) = IPriceFeed(NVDA_FEED).getRoundData(latest - 2);
        assertLt(t2, t1);
        assertLt(t1, tLatest);
        // A moment between rounds latest-2 and latest-1 belongs to latest-2 only.
        uint256 at = t2 + (t1 - t2) / 2;
        (, int256 a2,,,) = IPriceFeed(NVDA_FEED).getRoundData(latest - 2);
        assertEq(oracle.priceAt(NVDA_FEED, latest - 2, at), uint256(a2));
        try oracle.priceAt(NVDA_FEED, latest - 1, at) returns (uint256) {
            revert("a later round was accepted");
        } catch {}
        try oracle.priceAt(NVDA_FEED, latest - 3, at) returns (uint256) {
            revert("a superseded round was accepted");
        } catch {}
        // The latest round answers for any moment after it.
        oracle.priceAt(NVDA_FEED, latest, vm.getBlockTimestamp());
        try oracle.priceAt(NVDA_FEED, latest + 1, vm.getBlockTimestamp()) returns (uint256) {
            revert("a missing round was accepted");
        } catch {}
    }

    function test_fork_credits_pay_the_treasury_in_usdg() public {
        if (!forked) return;
        address treasury = makeAddr("treasury");
        address buyer = makeAddr("buyer");
        CallCredits credits = new CallCredits(IERC20(USDG), treasury, 1000, 1e6);
        deal(USDG, buyer, 10e6);
        vm.startPrank(buyer);
        IERC20(USDG).approve(address(credits), 10e6);
        credits.buy(buyer, 3);
        vm.stopPrank();
        assertEq(IERC20(USDG).balanceOf(treasury), 3e6);
        assertEq(IERC20(USDG).balanceOf(buyer), 7e6);
        assertEq(credits.callsPurchased(buyer), 3000);
    }

    function test_fork_bond_with_a_real_erc20() public {
        if (!forked) return;
        // The project token does not exist yet; WETH stands in to exercise SafeERC20 on a live token.
        ModelBond bonds = new ModelBond(IERC20(WETH), IModelOwners(address(oracle)), 1e15, 7 days);
        address op = makeAddr("operator");
        deal(WETH, op, 1e16);
        vm.startPrank(op);
        uint256 id = oracle.registerModel("bonded", "");
        IERC20(WETH).approve(address(bonds), 1e15);
        bonds.bond(id);
        assertTrue(bonds.isBonded(id));
        bonds.requestExit(id);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        bonds.withdraw(id);
        vm.stopPrank();
        assertEq(IERC20(WETH).balanceOf(op), 1e16);
    }
}
