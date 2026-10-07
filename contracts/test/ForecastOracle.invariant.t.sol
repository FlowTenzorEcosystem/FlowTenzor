// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForecastOracle} from "../src/ForecastOracle.sol";
import {MockFeed} from "./Mocks.sol";

/// Drives the oracle with random commits, price updates, time jumps and scoring attempts.
contract OracleHandler is Test {
    ForecastOracle public oracle;
    MockFeed[2] public feeds;
    address[3] public operators = [address(0x1001), address(0x1002), address(0x1003)];
    uint256[3] public models;

    constructor(ForecastOracle o, MockFeed a, MockFeed b) {
        oracle = o;
        feeds[0] = a;
        feeds[1] = b;
        for (uint256 i; i < 3; ++i) {
            vm.prank(operators[i]);
            models[i] = oracle.registerModel("m", "");
        }
    }

    function commit(uint256 who, uint256 market, uint256 horizon, uint256 lowBps, uint256 widthBps, uint256 conf) external {
        who = bound(who, 0, 2);
        market = bound(market, 0, 1);
        horizon = bound(horizon, 0, 2);
        (, int256 answer,,,) = feeds[market].latestRoundData();
        uint256 ref = uint256(answer);
        uint256 low = (ref * bound(lowBps, 9000, 10500)) / 10000;
        uint256 high = low + (ref * bound(widthBps, 1, 1500)) / 10000;
        vm.prank(operators[who]);
        try oracle.commit(
            models[who],
            ForecastOracle.CommitInput(uint16(market), uint8(horizon), uint128(low), uint128(high), uint16(bound(conf, 5000, 9900)))
        ) {} catch {}
    }

    function move(uint256 market, uint256 bps, bool up, uint256 dt) external {
        market = bound(market, 0, 1);
        vm.warp(vm.getBlockTimestamp() + bound(dt, 1, 6 hours));
        (, int256 answer,,,) = feeds[market].latestRoundData();
        uint256 delta = (uint256(answer) * bound(bps, 1, 300)) / 10000;
        feeds[market].pushNow(int256(up ? uint256(answer) + delta : uint256(answer) - delta));
    }

    function wait(uint256 dt) external {
        vm.warp(vm.getBlockTimestamp() + bound(dt, 1, 2 days));
    }

    /// Tries every round of the market; at most one may succeed.
    function settle(uint256 id) external {
        uint256 count = oracle.forecastCount();
        if (count == 0) return;
        id = bound(id, 1, count);
        ForecastOracle.Forecast memory f = oracle.getForecast(id);
        if (f.status != ForecastOracle.Status.Open || vm.getBlockTimestamp() <= f.resolvesAt) return;
        MockFeed feed = feeds[f.marketId];
        uint64 last = feed.lastIndex(1);
        uint256 wins;
        for (uint64 i = 1; i <= last; ++i) {
            uint80 round = uint80((uint256(1) << 64) | i);
            try oracle.score(id, round) {
                ++wins;
            } catch {}
        }
        require(wins == 1, "exactly one round settles a due forecast");
    }
}

contract ForecastOracleInvariantTest is Test {
    ForecastOracle oracle;
    OracleHandler handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        MockFeed a = new MockFeed();
        MockFeed b = new MockFeed();
        a.pushNow(200e8);
        b.pushNow(50e8);
        address[] memory feeds = new address[](2);
        feeds[0] = address(a);
        feeds[1] = address(b);
        bytes32[] memory symbols = new bytes32[](2);
        symbols[0] = "NVDA";
        symbols[1] = "INTC";
        oracle = new ForecastOracle(feeds, symbols, 7 days);
        handler = new OracleHandler(oracle, a, b);
        targetContract(address(handler));
    }

    /// Every committed forecast is open, scored or void, and the per-model counters agree with the forecasts.
    function invariant_counters_match_forecasts() public view {
        uint256 total = oracle.forecastCount();
        uint256[3] memory scored;
        uint256[3] memory voided;
        uint256[3] memory committed;
        uint256[3] memory sum;
        for (uint256 id = 1; id <= total; ++id) {
            ForecastOracle.Forecast memory f = oracle.getForecast(id);
            uint256 m = f.modelId - 1;
            committed[m] += 1;
            if (f.status == ForecastOracle.Status.Scored) {
                scored[m] += 1;
                sum[m] += f.score;
                assertLe(f.score, 10000);
                assertGt(f.resolvedRound, f.referenceRound);
            } else if (f.status == ForecastOracle.Status.Void) {
                voided[m] += 1;
                assertEq(f.resolvedRound, f.referenceRound);
            } else {
                assertEq(uint8(f.status), uint8(ForecastOracle.Status.Open));
            }
        }
        for (uint256 m; m < 3; ++m) {
            uint256 c;
            uint256 s;
            uint256 v;
            uint256 points;
            for (uint8 h; h < 3; ++h) {
                ForecastOracle.Stats memory st = oracle.stats(m + 1, h);
                c += st.committed;
                s += st.scored;
                v += st.voided;
                points += st.scoreSum;
                assertLe(st.inRange, st.scored);
                assertLe(st.directionHits, st.directionCalls);
            }
            assertEq(c, committed[m]);
            assertEq(s, scored[m]);
            assertEq(v, voided[m]);
            assertEq(points, sum[m]);
        }
    }

    /// At most one live forecast per model, market and horizon.
    function invariant_one_live_forecast_per_slot() public view {
        uint256 total = oracle.forecastCount();
        uint256 nowTs = vm.getBlockTimestamp();
        for (uint256 id = 1; id <= total; ++id) {
            ForecastOracle.Forecast memory f = oracle.getForecast(id);
            if (f.resolvesAt <= nowTs) continue;
            assertEq(oracle.latestId(f.modelId, f.marketId, f.horizon), id);
        }
    }
}
