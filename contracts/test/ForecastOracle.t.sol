// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForecastOracle} from "../src/ForecastOracle.sol";
import {MockFeed} from "./Mocks.sol";

contract ForecastOracleTest is Test {
    ForecastOracle oracle;
    MockFeed nvda;
    MockFeed aapl;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint256 modelA;
    uint256 modelB;

    uint128 constant P = 200e8; // reference price 200.00

    function setUp() public {
        vm.warp(1_800_000_000);
        nvda = new MockFeed();
        aapl = new MockFeed();
        nvda.pushNow(int256(uint256(P)));
        aapl.pushNow(250e8);
        address[] memory feeds = new address[](2);
        feeds[0] = address(nvda);
        feeds[1] = address(aapl);
        bytes32[] memory symbols = new bytes32[](2);
        symbols[0] = "NVDA";
        symbols[1] = "AAPL";
        oracle = new ForecastOracle(feeds, symbols, 4 days);
        vm.prank(alice);
        modelA = oracle.registerModel("Still Water", "https://example.org/a");
        vm.prank(bob);
        modelB = oracle.registerModel("Undertow", "");
    }

    function _in(uint16 market, uint8 h, uint128 low, uint128 high, uint16 conf)
        internal
        pure
        returns (ForecastOracle.CommitInput memory)
    {
        return ForecastOracle.CommitInput({marketId: market, horizon: h, low: low, high: high, confidenceBps: conf});
    }

    function _commitA(uint128 low, uint128 high, uint16 conf) internal returns (uint256) {
        vm.prank(alice);
        return oracle.commit(modelA, _in(0, 0, low, high, conf));
    }

    // ------------------------------------------------------------ constructor

    function _deploy(address[] memory f, bytes32[] memory s, uint256 age) external returns (ForecastOracle) {
        return new ForecastOracle(f, s, age);
    }

    function test_constructor_rejects_bad_input() public {
        address[] memory f = new address[](1);
        bytes32[] memory s = new bytes32[](1);
        f[0] = address(nvda);
        s[0] = "NVDA";

        vm.expectRevert(ForecastOracle.BadMarkets.selector);
        new ForecastOracle(new address[](0), new bytes32[](0), 1 days);

        vm.expectRevert(ForecastOracle.BadMarkets.selector);
        new ForecastOracle(f, new bytes32[](2), 1 days);

        vm.expectRevert(ForecastOracle.BadReferenceAge.selector);
        new ForecastOracle(f, s, 59 minutes);

        vm.expectRevert(ForecastOracle.BadReferenceAge.selector);
        new ForecastOracle(f, s, 7 days + 1);

        address[] memory noCode = new address[](1);
        noCode[0] = address(0xdead);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.BadFeed.selector, address(0xdead)));
        new ForecastOracle(noCode, s, 1 days);

        MockFeed six = new MockFeed();
        six.setDecimals(6);
        address[] memory wrongDec = new address[](1);
        wrongDec[0] = address(six);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.BadFeed.selector, address(six)));
        new ForecastOracle(wrongDec, s, 1 days);

        address[] memory dup = new address[](2);
        dup[0] = address(nvda);
        dup[1] = address(nvda);
        bytes32[] memory two = new bytes32[](2);
        two[0] = "A";
        two[1] = "B";
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.BadFeed.selector, address(nvda)));
        new ForecastOracle(dup, two, 1 days);

        address[] memory pair = new address[](2);
        pair[0] = address(nvda);
        pair[1] = address(aapl);
        bytes32[] memory sameSym = new bytes32[](2);
        sameSym[0] = "X";
        sameSym[1] = "X";
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.BadSymbol.selector, bytes32("X")));
        new ForecastOracle(pair, sameSym, 1 days);

        bytes32[] memory zeroSym = new bytes32[](1);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.BadSymbol.selector, bytes32(0)));
        new ForecastOracle(f, zeroSym, 1 days);

        address[] memory many = new address[](65);
        vm.expectRevert(ForecastOracle.BadMarkets.selector);
        new ForecastOracle(many, new bytes32[](65), 1 days);
    }

    function test_constructor_lists_markets() public view {
        assertEq(oracle.marketCount(), 2);
        assertEq(oracle.market(0).feed, address(nvda));
        assertEq(oracle.market(1).symbol, bytes32("AAPL"));
        assertEq(oracle.markets().length, 2);
        assertEq(oracle.maxReferenceAge(), 4 days);
    }

    // ------------------------------------------------------------ models

    function test_models() public {
        assertEq(oracle.modelCount(), 2);
        assertEq(oracle.ownerOf(modelA), alice);
        assertEq(oracle.model(modelB).name, "Undertow");

        vm.expectRevert(ForecastOracle.NameLength.selector);
        oracle.registerModel("", "");
        vm.expectRevert(ForecastOracle.NameLength.selector);
        oracle.registerModel("123456789012345678901234567890123", "");
        bytes memory longUri = new bytes(201);
        vm.expectRevert(ForecastOracle.UriLength.selector);
        oracle.registerModel("ok", string(longUri));

        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.NotModelOwner.selector, modelA));
        vm.prank(bob);
        oracle.transferModel(modelA, bob);

        vm.expectRevert(ForecastOracle.ZeroAddress.selector);
        vm.prank(alice);
        oracle.transferModel(modelA, address(0));

        vm.expectEmit(true, true, true, true);
        emit ForecastOracle.ModelTransferred(modelA, alice, bob);
        vm.prank(alice);
        oracle.transferModel(modelA, bob);
        assertEq(oracle.ownerOf(modelA), bob);

        vm.prank(bob);
        oracle.updateModelUri(modelA, "ipfs://x");
        assertEq(oracle.model(modelA).uri, "ipfs://x");

        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.UnknownModel.selector, 0));
        oracle.ownerOf(0);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.UnknownModel.selector, 9));
        oracle.model(9);
    }

    // ------------------------------------------------------------ commit

    function test_commit_stores_forecast() public {
        (uint80 round,,,,) = nvda.latestRoundData();
        vm.expectEmit(true, true, true, true);
        emit ForecastOracle.ForecastCommitted(1, modelA, 0, 0, 198e8, 204e8, 8000, P, round, uint40(vm.getBlockTimestamp() + 1 hours));
        uint256 id = _commitA(198e8, 204e8, 8000);
        ForecastOracle.Forecast memory f = oracle.getForecast(id);
        assertEq(id, 1);
        assertEq(f.modelId, modelA);
        assertEq(uint8(f.status), uint8(ForecastOracle.Status.Open));
        assertEq(f.referencePrice, P);
        assertEq(f.referenceRound, round);
        assertEq(f.direction, int8(1));
        assertEq(f.resolvesAt, vm.getBlockTimestamp() + 1 hours);
        assertEq(oracle.latestId(modelA, 0, 0), id);
        assertEq(oracle.stats(modelA, 0).committed, 1);
        assertEq(oracle.latestForecast(modelA, 0, 0).low, 198e8);
        assertEq(uint8(oracle.latestForecast(modelB, 0, 0).status), uint8(ForecastOracle.Status.None));
    }

    function test_commit_direction() public {
        assertEq(oracle.getForecast(_commitA(190e8, 205e8, 8000)).direction, int8(-1));
        vm.prank(alice);
        uint256 id = oracle.commit(modelA, _in(0, 1, 195e8, 205e8, 8000));
        assertEq(oracle.getForecast(id).direction, int8(0));
    }

    function test_commit_validation() public {
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.NotModelOwner.selector, modelA));
        vm.prank(bob);
        oracle.commit(modelA, _in(0, 0, 1, 2, 8000));

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.UnknownMarket.selector, 2));
        oracle.commit(modelA, _in(2, 0, 199e8, 201e8, 8000));
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.UnknownHorizon.selector, 3));
        oracle.commit(modelA, _in(0, 3, 199e8, 201e8, 8000));
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.ConfidenceOutOfRange.selector, 4999));
        oracle.commit(modelA, _in(0, 0, 199e8, 201e8, 4999));
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.ConfidenceOutOfRange.selector, 9901));
        oracle.commit(modelA, _in(0, 0, 199e8, 201e8, 9901));
        vm.expectRevert(ForecastOracle.BadRange.selector);
        oracle.commit(modelA, _in(0, 0, 201e8, 201e8, 8000));
        vm.expectRevert(ForecastOracle.BadRange.selector);
        oracle.commit(modelA, _in(0, 0, 0, 201e8, 8000));
        vm.expectRevert(ForecastOracle.RangeTooFar.selector);
        oracle.commit(modelA, _in(0, 0, 49e8, 201e8, 8000));
        vm.expectRevert(ForecastOracle.RangeTooFar.selector);
        oracle.commit(modelA, _in(0, 0, 199e8, 801e8, 8000));
        vm.stopPrank();
    }

    function test_commit_rejects_stale_and_bad_answers() public {
        vm.warp(vm.getBlockTimestamp() + 4 days + 1);
        (,,, uint256 updatedAt,) = nvda.latestRoundData();
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.ReferenceTooOld.selector, updatedAt));
        _commitA(199e8, 201e8, 8000);

        nvda.pushNow(0);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.FeedAnswerInvalid.selector, address(nvda)));
        _commitA(199e8, 201e8, 8000);

        nvda.push(200e8, vm.getBlockTimestamp() + 10);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.FeedAnswerInvalid.selector, address(nvda)));
        _commitA(199e8, 201e8, 8000);
    }

    function test_commit_one_live_forecast_per_slot() public {
        uint256 first = _commitA(199e8, 201e8, 8000);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.StillOpen.selector, first));
        _commitA(199e8, 201e8, 8000);
        // Other horizons, markets and models are separate slots.
        vm.prank(alice);
        oracle.commit(modelA, _in(0, 1, 199e8, 201e8, 8000));
        vm.prank(alice);
        oracle.commit(modelA, _in(1, 0, 249e8, 251e8, 8000));
        vm.prank(bob);
        oracle.commit(modelB, _in(0, 0, 199e8, 201e8, 8000));
        // Once the first has resolved, the slot opens again (scored or not).
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        uint256 second = _commitA(199e8, 201e8, 8000);
        assertEq(oracle.latestId(modelA, 0, 0), second);
    }

    function test_commitMany() public {
        ForecastOracle.CommitInput[] memory list = new ForecastOracle.CommitInput[](3);
        list[0] = _in(0, 0, 199e8, 201e8, 8000);
        list[1] = _in(0, 1, 195e8, 206e8, 8000);
        list[2] = _in(1, 2, 230e8, 270e8, 9000);
        vm.prank(alice);
        uint256[] memory ids = oracle.commitMany(modelA, list);
        assertEq(ids.length, 3);
        assertEq(oracle.forecastCount(), 3);

        vm.expectRevert(ForecastOracle.BatchSize.selector);
        vm.prank(alice);
        oracle.commitMany(modelA, new ForecastOracle.CommitInput[](0));
        vm.expectRevert(ForecastOracle.BatchSize.selector);
        vm.prank(alice);
        oracle.commitMany(modelA, new ForecastOracle.CommitInput[](65));
    }

    // ------------------------------------------------------------ score

    function test_score_in_range_exact_value() public {
        uint256 id = _commitA(198e8, 204e8, 8000);
        vm.warp(vm.getBlockTimestamp() + 30 minutes);
        uint80 r = nvda.pushNow(203e8);
        vm.warp(vm.getBlockTimestamp() + 31 minutes);
        vm.expectEmit(true, true, true, true);
        // width 6 on 200 = 30000 ppm; 1h budget 20000 ppm -> 0 points
        emit ForecastOracle.ForecastScored(id, modelA, r, 203e8, 0, true, true);
        oracle.score(id, r);

        // A tighter range: width 2 on 200 = 10000 ppm -> 10000 - 5000 = 5000
        vm.warp(vm.getBlockTimestamp() + 1);
        uint256 id2 = _commitA(202e8, 204e8, 8000);
        vm.warp(vm.getBlockTimestamp() + 10 minutes);
        uint80 r2 = nvda.pushNow(203e8 + 1);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        oracle.score(id2, r2);
        ForecastOracle.Forecast memory f = oracle.getForecast(id2);
        assertEq(f.score, 5074); // width 2 on a 203 reference = 9852 ppm
        assertTrue(f.inRange);
        assertEq(uint8(f.status), uint8(ForecastOracle.Status.Scored));
        assertEq(f.resolvedPrice, 203e8 + 1);
    }

    function test_score_miss_is_penalised_by_confidence() public {
        // ref 200, range 200..201, price 199 (miss by 1), confidence 80 %: 1 + 1*2/0.2 = 11 -> 55000 ppm > budget
        (uint16 s80,) = oracle.scoreOf(200e8, 201e8, 8000, 200e8, 199e8, 1);
        // 60000 ppm budget at 1 day: 10000 - 55000*10000/60000 = 834 (rounded down)
        assertEq(s80, 834);
        (uint16 s50, bool inR) = oracle.scoreOf(200e8, 201e8, 5000, 200e8, 199e8, 1);
        // confidence 50 %: 1 + 1*2/0.5 = 5 -> 25000 ppm -> 10000 - 4166 = 5834
        assertEq(s50, 5834);
        assertFalse(inR);
        (uint16 above,) = oracle.scoreOf(200e8, 201e8, 5000, 200e8, 202e8, 1);
        assertEq(above, 5834);
    }

    function test_score_void_when_feed_did_not_move() public {
        uint256 id = _commitA(199e8, 201e8, 8000);
        (uint80 ref,,,,) = nvda.latestRoundData();
        vm.warp(vm.getBlockTimestamp() + 2 hours);
        vm.expectEmit(true, true, true, true);
        emit ForecastOracle.ForecastVoided(id, modelA, ref);
        assertEq(uint8(oracle.score(id, ref)), uint8(ForecastOracle.Status.Void));
        assertEq(oracle.stats(modelA, 0).voided, 1);
        assertEq(oracle.stats(modelA, 0).scored, 0);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.NotOpen.selector, id));
        oracle.score(id, ref);
    }

    function test_score_not_due() public {
        uint256 id = _commitA(199e8, 201e8, 8000);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        (uint80 ref,,,,) = nvda.latestRoundData();
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.NotDue.selector, vm.getBlockTimestamp()));
        oracle.score(id, ref);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.UnknownForecast.selector, 99));
        oracle.score(99, ref);
    }

    function test_score_rejects_wrong_rounds() public {
        uint256 start = vm.getBlockTimestamp();
        (uint80 ref,,,,) = nvda.latestRoundData();
        uint256 id = _commitA(199e8, 201e8, 8000);
        vm.warp(start + 20 minutes);
        uint80 a = nvda.pushNow(200.5e8);
        vm.warp(start + 50 minutes);
        uint80 b = nvda.pushNow(200.7e8); // current at the horizon (start + 1h)
        vm.warp(start + 70 minutes);
        uint80 c = nvda.pushNow(203e8); // after the horizon
        vm.warp(start + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, ref));
        oracle.score(id, ref); // superseded before the horizon
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, a));
        oracle.score(id, a);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, c));
        oracle.score(id, c); // published after the horizon
        uint80 missing = c + 5;
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, missing));
        oracle.score(id, missing);

        oracle.score(id, b);
        ForecastOracle.Forecast memory f = oracle.getForecast(id);
        assertEq(f.resolvedRound, b);
        assertEq(f.resolvedPrice, 200.7e8);
        assertTrue(f.inRange);
        assertTrue(f.directionHit == false); // midpoint 200 is flat: no direction call
        assertEq(oracle.stats(modelA, 0).directionCalls, 0);
    }

    function test_score_uses_latest_round_when_nothing_came_after() public {
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _commitA(199e8, 202e8, 8000);
        vm.warp(start + 40 minutes);
        uint80 r = nvda.pushNow(201e8);
        vm.warp(start + 3 hours); // no newer round: r is still the latest
        oracle.score(id, r);
        assertEq(oracle.getForecast(id).resolvedRound, r);
        assertTrue(oracle.getForecast(id).directionHit);
    }

    function test_score_across_a_phase_change() public {
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _commitA(199e8, 202e8, 8000);
        vm.warp(start + 30 minutes);
        uint80 old = nvda.pushNow(201e8);
        nvda.newPhase();
        vm.warp(start + 90 minutes);
        uint80 first = nvda.pushNow(205e8); // first round of phase 2, after the horizon
        vm.warp(start + 2 hours);
        assertEq(uint256(first) >> 64, 2);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, first));
        oracle.score(id, first);
        oracle.score(id, old);
        assertEq(oracle.getForecast(id).resolvedPrice, 201e8);
    }

    function test_phase_change_first_round_before_horizon_wins() public {
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _commitA(199e8, 202e8, 8000);
        vm.warp(start + 10 minutes);
        uint80 old = nvda.pushNow(201e8);
        nvda.newPhase();
        vm.warp(start + 20 minutes);
        uint80 first = nvda.pushNow(200.5e8);
        vm.warp(start + 2 hours);
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, old));
        oracle.score(id, old);
        oracle.score(id, first);
    }

    function test_feeds_answering_zero_for_missing_rounds() public {
        nvda.setZeroForMissing(true);
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _commitA(199e8, 202e8, 8000);
        vm.warp(start + 10 minutes);
        uint80 r = nvda.pushNow(201e8);
        vm.warp(start + 2 hours);
        uint80 ghost = r + 1;
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, ghost));
        oracle.score(id, ghost);
        oracle.score(id, r);
    }

    function test_scoreMany_skips_settled_and_not_due() public {
        uint256 start = vm.getBlockTimestamp();
        uint256 a = _commitA(199e8, 202e8, 8000);
        vm.prank(alice);
        uint256 d = oracle.commit(modelA, _in(0, 1, 190e8, 210e8, 8000)); // one day: not due
        vm.warp(start + 10 minutes);
        uint80 r = nvda.pushNow(201e8);
        vm.warp(start + 2 hours);
        oracle.score(a, r);
        uint256[] memory ids = new uint256[](2);
        ids[0] = a;
        ids[1] = d;
        uint80[] memory rounds = new uint80[](2);
        rounds[0] = r;
        rounds[1] = r;
        assertEq(oracle.scoreMany(ids, rounds), 0);

        vm.expectRevert(ForecastOracle.ArrayLength.selector);
        oracle.scoreMany(ids, new uint80[](1));
        vm.expectRevert(ForecastOracle.BatchSize.selector);
        oracle.scoreMany(new uint256[](0), new uint80[](0));
    }

    function test_stats_and_average() public {
        uint256 start = vm.getBlockTimestamp();
        // Two scored forecasts and one void.
        uint256 a = _commitA(200e8, 202e8, 8000); // up call
        vm.warp(start + 10 minutes);
        uint80 r1 = nvda.pushNow(201e8);
        vm.warp(start + 61 minutes);
        oracle.score(a, r1); // in range, width 2/200 = 10000ppm -> 5000, direction hit
        uint256 b = _commitA(202e8, 204e8, 8000); // up from 201
        vm.warp(start + 70 minutes);
        uint80 r2 = nvda.pushNow(199e8);
        vm.warp(start + 2 hours + 2 minutes);
        oracle.score(b, r2); // below range
        uint256 c = _commitA(198e8, 200e8, 8000);
        vm.warp(start + 4 hours);
        oracle.score(c, r2); // no new round: void

        ForecastOracle.Stats memory s = oracle.stats(modelA, 0);
        assertEq(s.committed, 3);
        assertEq(s.scored, 2);
        assertEq(s.voided, 1);
        assertEq(s.inRange, 1);
        assertEq(s.directionCalls, 2);
        assertEq(s.directionHits, 1);
        (uint256 avg, uint256 n) = oracle.averageScore(modelA, 0);
        assertEq(n, 2);
        assertEq(avg, (5000 + oracle.getForecast(b).score) / 2);
        (uint256 none, uint256 zero) = oracle.averageScore(modelB, 0);
        assertEq(none + zero, 0);
    }

    // ------------------------------------------------------------ consensus

    function test_consensus() public {
        vm.prank(alice);
        oracle.commit(modelA, _in(0, 1, 200e8, 210e8, 8000)); // mid 205 up
        vm.prank(bob);
        oracle.commit(modelB, _in(0, 1, 190e8, 198e8, 6000)); // mid 194 down
        vm.prank(alice);
        uint256 c = oracle.registerModel("Current", "");
        vm.prank(alice);
        oracle.commit(c, _in(0, 1, 201e8, 207e8, 9000)); // mid 204 up

        uint256[] memory ids = new uint256[](4);
        ids[0] = modelA;
        ids[1] = modelB;
        ids[2] = c;
        ids[3] = modelA; // counted once
        ForecastOracle.Consensus memory k = oracle.consensus(0, 1, ids);
        assertEq(k.live, 3);
        assertEq(k.up, 2);
        assertEq(k.down, 1);
        assertEq(k.midMin, 194e8);
        assertEq(k.midMax, 205e8);
        assertEq(k.spreadPpm, (11e8 * 1e6) / 200e8);
        assertEq(k.confidenceAvg, uint256(23000) / 3);

        vm.warp(vm.getBlockTimestamp() + 1 days);
        assertEq(oracle.consensus(0, 1, ids).live, 0); // horizon reached: no longer live
        vm.expectRevert(abi.encodeWithSelector(ForecastOracle.UnknownMarket.selector, 5));
        oracle.consensus(5, 1, ids);
    }

    function test_forecastsFrom_pages() public {
        for (uint16 i; i < 3; ++i) {
            vm.prank(alice);
            oracle.commit(modelA, _in(0, uint8(i), 199e8, 201e8, 8000));
        }
        assertEq(oracle.forecastsFrom(0, 2).length, 2);
        assertEq(oracle.forecastsFrom(2, 10).length, 2);
        assertEq(oracle.forecastsFrom(4, 10).length, 0);
        assertEq(oracle.forecastsFrom(1, 500).length, 3);
    }

    // ------------------------------------------------------------ fuzz

    /// Reference implementation written separately from the contract's.
    function _expected(uint256 low, uint256 high, uint16 conf, uint256 ref, uint256 price, uint8 h)
        internal
        pure
        returns (uint256)
    {
        uint256 alpha = 10000 - conf;
        uint256 miss = price < low ? low - price : price > high ? price - high : 0;
        uint256 interval = (high - low) + (miss * 2 * 10000) / alpha;
        uint256 budget = h == 0 ? 20_000 : h == 1 ? 60_000 : 150_000;
        uint256 rel = (interval * 1_000_000) / ref;
        if (rel >= budget) return 0;
        return 10000 - (rel * 10000) / budget;
    }

    function testFuzz_scoreOf_matches_reference(uint64 ref, uint64 a, uint64 b, uint64 price, uint16 conf, uint8 h) public view {
        ref = uint64(bound(ref, 1e6, 1e15));
        a = uint64(bound(a, ref / 4, uint256(ref) * 4));
        b = uint64(bound(b, ref / 4, uint256(ref) * 4));
        vm.assume(a != b);
        (uint256 low, uint256 high) = a < b ? (uint256(a), uint256(b)) : (uint256(b), uint256(a));
        price = uint64(bound(price, 1, uint256(ref) * 8));
        conf = uint16(bound(conf, 5000, 9900));
        h = uint8(bound(h, 0, 2));
        (uint16 s, bool inR) = oracle.scoreOf(low, high, conf, ref, price, h);
        assertEq(s, _expected(low, high, conf, ref, price, h));
        assertLe(s, 10000);
        assertEq(inR, price >= low && price <= high);
    }

    function testFuzz_further_miss_never_scores_higher(uint64 d1, uint64 d2, uint16 conf) public view {
        d1 = uint64(bound(d1, 0, 50e8));
        d2 = uint64(bound(d2, d1, 50e8));
        conf = uint16(bound(conf, 5000, 9900));
        (uint16 near,) = oracle.scoreOf(200e8, 202e8, conf, 200e8, 202e8 + uint256(d1), 2);
        (uint16 far,) = oracle.scoreOf(200e8, 202e8, conf, 200e8, 202e8 + uint256(d2), 2);
        assertGe(near, far);
    }

    /// For any history of rounds and any horizon, exactly the round current at the horizon is accepted.
    function testFuzz_only_the_current_round_is_accepted(uint8 count, uint32 seed, uint16 offset) public {
        count = uint8(bound(count, 1, 12));
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _commitA(150e8, 250e8, 8000);
        uint80[] memory ids = new uint80[](count);
        uint256[] memory times = new uint256[](count);
        uint256 t = start;
        for (uint256 i; i < count; ++i) {
            t += 1 + (uint256(keccak256(abi.encode(seed, i))) % 40 minutes);
            vm.warp(t);
            ids[i] = nvda.pushNow(int256(200e8 + i));
            times[i] = t;
        }
        uint256 horizon = start + 1 hours;
        vm.warp(t > horizon ? t + 1 + (offset % 100) : horizon + 1 + (offset % 100));
        uint80 refRound = oracle.getForecast(id).referenceRound;
        // The expected round: the last one published at or before the horizon (the reference round if none).
        uint80 expected = refRound;
        for (uint256 i; i < count; ++i) {
            if (times[i] <= horizon) expected = ids[i];
        }
        for (uint256 i; i < count; ++i) {
            if (ids[i] == expected) continue;
            vm.expectRevert(abi.encodeWithSelector(ForecastOracle.WrongRound.selector, ids[i]));
            oracle.score(id, ids[i]);
        }
        oracle.score(id, expected);
        ForecastOracle.Status st = oracle.getForecast(id).status;
        if (expected == refRound) assertEq(uint8(st), uint8(ForecastOracle.Status.Void));
        else assertEq(uint8(st), uint8(ForecastOracle.Status.Scored));
    }
}
