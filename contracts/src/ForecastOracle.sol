// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceFeed} from "./IPriceFeed.sol";

/// @title ForecastOracle
/// @notice A public record of price-range forecasts for stock tokens, scored against Chainlink.
///
/// Anyone can register a model. A model commits a forecast for one market and one horizon
/// (1 hour, 1 day or 1 week): a low and a high price and the confidence that the price at the
/// horizon lands inside that range. The reference price is read from the market's Chainlink feed
/// in the same transaction, so a forecast can never be placed against a price the model picked.
///
/// After the horizon anyone can score the forecast by naming the Chainlink round that was current
/// at the horizon. The contract checks that claim against the feed itself: the named round was
/// published at or before the horizon and the round after it (if any) was published after it.
/// If the feed published nothing new during the forecast window, the forecast is void: there was
/// no fresh price to judge it by (markets closed, or the price never moved past the feed's
/// deviation threshold).
///
/// The score is a clamped interval score (Gneiting and Raftery): the width of the range plus a
/// penalty for a miss that grows with the stated confidence, relative to the reference price and
/// to a fixed budget per horizon. A tight range that holds scores close to 10000; a wide range or
/// a confident miss scores close to 0. Every committed forecast stays on chain and every one can
/// be scored, so a model cannot hide its misses.
///
/// There is no owner, no admin key, no fee, no pause and no upgrade path. Markets and the maximum
/// age of a reference price are fixed at deployment.
contract ForecastOracle {
    // ---------------------------------------------------------------- constants

    uint8 public constant HORIZON_COUNT = 3;
    uint16 public constant MIN_CONFIDENCE_BPS = 5000;
    uint16 public constant MAX_CONFIDENCE_BPS = 9900;
    uint16 public constant MAX_SCORE = 10000;
    uint256 public constant MAX_MARKETS = 64;
    uint256 public constant MAX_BATCH = 64;
    uint256 public constant MAX_PAGE = 100;
    uint256 public constant MAX_NAME_BYTES = 32;
    uint256 public constant MAX_URI_BYTES = 200;
    uint8 public constant FEED_DECIMALS = 8;

    // ---------------------------------------------------------------- types

    enum Status {
        None,
        Open,
        Scored,
        Void
    }

    struct Market {
        address feed;
        bytes32 symbol;
    }

    struct Model {
        address owner;
        uint40 registeredAt;
        string name;
        string uri;
    }

    struct Forecast {
        uint64 modelId;
        uint16 marketId;
        uint8 horizon;
        uint16 confidenceBps;
        Status status;
        int8 direction; // 1 up, -1 down, 0 flat: the midpoint of the range against the reference
        bool inRange;
        bool directionHit;
        uint16 score;
        uint40 committedAt;
        uint40 resolvesAt;
        uint80 referenceRound;
        uint80 resolvedRound;
        uint128 low;
        uint128 high;
        uint128 referencePrice;
        uint128 resolvedPrice;
    }

    struct Stats {
        uint64 committed;
        uint64 scored;
        uint64 voided;
        uint64 inRange;
        uint64 directionCalls;
        uint64 directionHits;
        uint128 scoreSum;
        uint40 lastScoredAt;
    }

    struct CommitInput {
        uint16 marketId;
        uint8 horizon;
        uint128 low;
        uint128 high;
        uint16 confidenceBps;
    }

    struct Consensus {
        uint256 live; // open forecasts among the given models
        uint256 up;
        uint256 down;
        uint256 flat;
        uint256 lowAvg;
        uint256 highAvg;
        uint256 confidenceAvg;
        uint256 midMin;
        uint256 midMax;
        uint256 spreadPpm; // (midMax - midMin) relative to the latest reference price, parts per million
    }

    // ---------------------------------------------------------------- storage

    /// Seconds a feed's latest answer may be old when a forecast is committed against it.
    uint256 public maxReferenceAge;

    Market[] internal _markets;
    Model[] internal _models; // model id = index + 1
    Forecast[] internal _forecasts; // forecast id = index + 1

    mapping(uint256 modelId => mapping(uint256 marketId => mapping(uint8 horizon => uint256 forecastId))) public latestId;
    mapping(uint256 modelId => mapping(uint8 horizon => Stats)) internal _stats;
    mapping(address feed => bool) internal _listed;
    mapping(bytes32 symbol => bool) internal _symbolTaken;

    // ---------------------------------------------------------------- events

    event MarketListed(uint256 indexed marketId, address indexed feed, bytes32 symbol);
    event ModelRegistered(uint256 indexed modelId, address indexed owner, string name, string uri);
    event ModelTransferred(uint256 indexed modelId, address indexed from, address indexed to);
    event ModelUriUpdated(uint256 indexed modelId, string uri);
    event ForecastCommitted(
        uint256 indexed forecastId,
        uint256 indexed modelId,
        uint256 indexed marketId,
        uint8 horizon,
        uint128 low,
        uint128 high,
        uint16 confidenceBps,
        uint128 referencePrice,
        uint80 referenceRound,
        uint40 resolvesAt
    );
    event ForecastScored(
        uint256 indexed forecastId,
        uint256 indexed modelId,
        uint80 round,
        uint128 price,
        uint16 score,
        bool inRange,
        bool directionHit
    );
    event ForecastVoided(uint256 indexed forecastId, uint256 indexed modelId, uint80 round);

    // ---------------------------------------------------------------- errors

    error BadMarkets();
    error BadFeed(address feed);
    error BadSymbol(bytes32 symbol);
    error BadReferenceAge();
    error NameLength();
    error UriLength();
    error UnknownModel(uint256 modelId);
    error NotModelOwner(uint256 modelId);
    error ZeroAddress();
    error UnknownMarket(uint256 marketId);
    error UnknownHorizon(uint8 horizon);
    error ConfidenceOutOfRange(uint16 confidenceBps);
    error BadRange();
    error RangeTooFar();
    error StillOpen(uint256 forecastId);
    error FeedAnswerInvalid(address feed);
    error ReferenceTooOld(uint256 updatedAt);
    error UnknownForecast(uint256 forecastId);
    error NotOpen(uint256 forecastId);
    error NotDue(uint256 resolvesAt);
    error WrongRound(uint80 round);
    error BatchSize();
    error ArrayLength();

    // ---------------------------------------------------------------- constructor

    /// @param feeds Chainlink USD feed proxies, one per market (8 decimals each).
    /// @param symbols Ticker for each market, ASCII, left-aligned in bytes32.
    /// @param maxReferenceAge_ Seconds a feed answer may be old at commit time (1 hour to 7 days).
    constructor(address[] memory feeds, bytes32[] memory symbols, uint256 maxReferenceAge_) {
        if (feeds.length == 0 || feeds.length > MAX_MARKETS || feeds.length != symbols.length) revert BadMarkets();
        if (maxReferenceAge_ < 1 hours || maxReferenceAge_ > 7 days) revert BadReferenceAge();
        maxReferenceAge = maxReferenceAge_;
        for (uint256 i; i < feeds.length; ++i) {
            address feed = feeds[i];
            bytes32 symbol = symbols[i];
            if (feed == address(0) || feed.code.length == 0 || _listed[feed]) revert BadFeed(feed);
            if (IPriceFeed(feed).decimals() != FEED_DECIMALS) revert BadFeed(feed);
            if (symbol == bytes32(0) || _symbolTaken[symbol]) revert BadSymbol(symbol);
            _listed[feed] = true;
            _symbolTaken[symbol] = true;
            _markets.push(Market(feed, symbol));
            emit MarketListed(i, feed, symbol);
        }
    }

    // ---------------------------------------------------------------- models

    function registerModel(string calldata name, string calldata uri) external returns (uint256 modelId) {
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME_BYTES) revert NameLength();
        if (bytes(uri).length > MAX_URI_BYTES) revert UriLength();
        _models.push(Model(msg.sender, uint40(block.timestamp), name, uri));
        modelId = _models.length;
        emit ModelRegistered(modelId, msg.sender, name, uri);
    }

    function transferModel(uint256 modelId, address to) external {
        Model storage m = _ownedModel(modelId);
        if (to == address(0)) revert ZeroAddress();
        address from = m.owner;
        m.owner = to;
        emit ModelTransferred(modelId, from, to);
    }

    function updateModelUri(uint256 modelId, string calldata uri) external {
        Model storage m = _ownedModel(modelId);
        if (bytes(uri).length > MAX_URI_BYTES) revert UriLength();
        m.uri = uri;
        emit ModelUriUpdated(modelId, uri);
    }

    // ---------------------------------------------------------------- commit

    function commit(uint256 modelId, CommitInput calldata input) external returns (uint256 forecastId) {
        _ownedModel(modelId);
        forecastId = _commit(modelId, input);
    }

    function commitMany(uint256 modelId, CommitInput[] calldata inputs) external returns (uint256[] memory ids) {
        if (inputs.length == 0 || inputs.length > MAX_BATCH) revert BatchSize();
        _ownedModel(modelId);
        ids = new uint256[](inputs.length);
        for (uint256 i; i < inputs.length; ++i) {
            ids[i] = _commit(modelId, inputs[i]);
        }
    }

    function _commit(uint256 modelId, CommitInput calldata input) internal returns (uint256 forecastId) {
        if (input.marketId >= _markets.length) revert UnknownMarket(input.marketId);
        if (input.horizon >= HORIZON_COUNT) revert UnknownHorizon(input.horizon);
        if (input.confidenceBps < MIN_CONFIDENCE_BPS || input.confidenceBps > MAX_CONFIDENCE_BPS) {
            revert ConfidenceOutOfRange(input.confidenceBps);
        }
        if (input.low == 0 || input.low >= input.high) revert BadRange();

        // One live forecast per model, market and horizon: the next one waits for the last to resolve.
        uint256 previous = latestId[modelId][input.marketId][input.horizon];
        if (previous != 0 && _forecasts[previous - 1].resolvesAt > block.timestamp) revert StillOpen(previous);

        address feed = _markets[input.marketId].feed;
        (uint80 round, int256 answer,, uint256 updatedAt,) = IPriceFeed(feed).latestRoundData();
        if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp) revert FeedAnswerInvalid(feed);
        if (block.timestamp - updatedAt > maxReferenceAge) revert ReferenceTooOld(updatedAt);
        uint256 ref = uint256(answer);
        if (ref > type(uint128).max) revert FeedAnswerInvalid(feed);
        // Ranges far from the market are noise: both ends must sit within a factor of four of the reference.
        if (uint256(input.low) * 4 < ref || uint256(input.high) > ref * 4) revert RangeTooFar();

        uint256 mid = (uint256(input.low) + uint256(input.high)) / 2;
        int8 direction = mid > ref ? int8(1) : mid < ref ? int8(-1) : int8(0);
        uint40 resolvesAt = uint40(block.timestamp + horizonSeconds(input.horizon));

        _forecasts.push(
            Forecast({
                modelId: uint64(modelId),
                marketId: input.marketId,
                horizon: input.horizon,
                confidenceBps: input.confidenceBps,
                status: Status.Open,
                direction: direction,
                inRange: false,
                directionHit: false,
                score: 0,
                committedAt: uint40(block.timestamp),
                resolvesAt: resolvesAt,
                referenceRound: round,
                resolvedRound: 0,
                low: input.low,
                high: input.high,
                referencePrice: uint128(ref),
                resolvedPrice: 0
            })
        );
        forecastId = _forecasts.length;
        latestId[modelId][input.marketId][input.horizon] = forecastId;
        _stats[modelId][input.horizon].committed += 1;
        emit ForecastCommitted(
            forecastId,
            modelId,
            input.marketId,
            input.horizon,
            input.low,
            input.high,
            input.confidenceBps,
            uint128(ref),
            round,
            resolvesAt
        );
    }

    // ---------------------------------------------------------------- score

    /// @notice Scores (or voids) a forecast whose horizon has passed.
    /// @param round The Chainlink round id that was current at the forecast's horizon.
    function score(uint256 forecastId, uint80 round) external returns (Status) {
        Forecast storage f = _forecast(forecastId);
        if (f.status != Status.Open) revert NotOpen(forecastId);
        return _score(forecastId, f, round);
    }

    /// @notice Scores several forecasts; ones that are already settled or not yet due are skipped.
    function scoreMany(uint256[] calldata forecastIds, uint80[] calldata rounds) external returns (uint256 settled) {
        if (forecastIds.length == 0 || forecastIds.length > MAX_BATCH) revert BatchSize();
        if (forecastIds.length != rounds.length) revert ArrayLength();
        for (uint256 i; i < forecastIds.length; ++i) {
            Forecast storage f = _forecast(forecastIds[i]);
            if (f.status != Status.Open || block.timestamp <= f.resolvesAt) continue;
            _score(forecastIds[i], f, rounds[i]);
            ++settled;
        }
    }

    function _score(uint256 forecastId, Forecast storage f, uint80 round) internal returns (Status) {
        if (block.timestamp <= f.resolvesAt) revert NotDue(f.resolvesAt);
        address feed = _markets[f.marketId].feed;
        uint256 price = _priceAt(feed, round, f.resolvesAt);
        if (round < f.referenceRound) revert WrongRound(round);

        Stats storage s = _stats[f.modelId][f.horizon];
        f.resolvedRound = round;
        if (round == f.referenceRound) {
            f.status = Status.Void;
            s.voided += 1;
            emit ForecastVoided(forecastId, f.modelId, round);
            return Status.Void;
        }

        (uint16 points, bool inRange) =
            scoreOf(f.low, f.high, f.confidenceBps, f.referencePrice, price, f.horizon);
        int8 actual = price > f.referencePrice ? int8(1) : price < f.referencePrice ? int8(-1) : int8(0);
        bool hit = f.direction != 0 && actual == f.direction;

        f.status = Status.Scored;
        f.resolvedPrice = uint128(price);
        f.score = points;
        f.inRange = inRange;
        f.directionHit = hit;

        s.scored += 1;
        s.scoreSum += points;
        s.lastScoredAt = uint40(block.timestamp);
        if (inRange) s.inRange += 1;
        if (f.direction != 0) {
            s.directionCalls += 1;
            if (hit) s.directionHits += 1;
        }
        emit ForecastScored(forecastId, f.modelId, round, uint128(price), points, inRange, hit);
        return Status.Scored;
    }

    /// @dev The answer of `round`, after proving it was the feed's current round at time `at`.
    function _priceAt(address feed, uint80 round, uint256 at) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = _roundData(feed, round);
        if (updatedAt == 0 || updatedAt > at || answer <= 0) revert WrongRound(round);
        (bool hasNext, uint256 nextUpdatedAt) = _nextRound(feed, round);
        if (hasNext) {
            if (nextUpdatedAt <= at) revert WrongRound(round);
        } else {
            (uint80 latest,,,,) = IPriceFeed(feed).latestRoundData();
            if (latest != round) revert WrongRound(round);
        }
        if (uint256(answer) > type(uint128).max) revert WrongRound(round);
        return uint256(answer);
    }

    function _roundData(address feed, uint80 round)
        internal
        view
        returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80)
    {
        try IPriceFeed(feed).getRoundData(round) returns (uint80 r, int256 a, uint256 s, uint256 u, uint80 ai) {
            return (r, a, s, u, ai);
        } catch {
            return (0, 0, 0, 0, 0);
        }
    }

    /// @dev The round after `round`: the next one in its phase, else the first of the next phase.
    function _nextRound(address feed, uint80 round) internal view returns (bool, uint256) {
        uint256 phase = uint256(round) >> 64;
        uint256 index = uint256(round) & type(uint64).max;
        if (index < type(uint64).max) {
            (, int256 a,, uint256 u,) = _roundData(feed, uint80(round + 1));
            if (u != 0 && a > 0) return (true, u);
        }
        if (phase < type(uint16).max) {
            (, int256 a2,, uint256 u2,) = _roundData(feed, uint80(((phase + 1) << 64) | 1));
            if (u2 != 0 && a2 > 0) return (true, u2);
        }
        return (false, 0);
    }

    // ---------------------------------------------------------------- pure

    function horizonSeconds(uint8 horizon) public pure returns (uint256) {
        if (horizon == 0) return 1 hours;
        if (horizon == 1) return 1 days;
        if (horizon == 2) return 7 days;
        revert UnknownHorizon(horizon);
    }

    /// Relative interval score (parts per million of the reference price) that scores zero.
    function budgetPpm(uint8 horizon) public pure returns (uint256) {
        if (horizon == 0) return 20_000; // 2 %
        if (horizon == 1) return 60_000; // 6 %
        if (horizon == 2) return 150_000; // 15 %
        revert UnknownHorizon(horizon);
    }

    /// @notice The score a forecast gets when the price at its horizon is `price`.
    function scoreOf(uint256 low, uint256 high, uint16 confidenceBps, uint256 referencePrice, uint256 price, uint8 horizon)
        public
        pure
        returns (uint16 points, bool inRange)
    {
        uint256 alpha = 10000 - uint256(confidenceBps); // > 0 because confidence is at most 99 %
        uint256 interval = high - low;
        if (price < low) {
            interval += ((low - price) * 20000) / alpha;
        } else if (price > high) {
            interval += ((price - high) * 20000) / alpha;
        } else {
            inRange = true;
        }
        uint256 relPpm = (interval * 1e6) / referencePrice;
        uint256 budget = budgetPpm(horizon);
        points = relPpm >= budget ? 0 : uint16(MAX_SCORE - (relPpm * MAX_SCORE) / budget);
    }

    // ---------------------------------------------------------------- views

    function marketCount() external view returns (uint256) {
        return _markets.length;
    }

    function market(uint256 marketId) external view returns (Market memory) {
        if (marketId >= _markets.length) revert UnknownMarket(marketId);
        return _markets[marketId];
    }

    function markets() external view returns (Market[] memory) {
        return _markets;
    }

    function modelCount() external view returns (uint256) {
        return _models.length;
    }

    function model(uint256 modelId) external view returns (Model memory) {
        return _model(modelId);
    }

    function ownerOf(uint256 modelId) external view returns (address) {
        return _model(modelId).owner;
    }

    function forecastCount() external view returns (uint256) {
        return _forecasts.length;
    }

    function getForecast(uint256 forecastId) external view returns (Forecast memory) {
        return _forecast(forecastId);
    }

    /// @notice Up to `count` forecasts starting at id `fromId` (inclusive), oldest first.
    function forecastsFrom(uint256 fromId, uint256 count) external view returns (Forecast[] memory page) {
        if (count > MAX_PAGE) count = MAX_PAGE;
        uint256 total = _forecasts.length;
        if (fromId == 0) fromId = 1;
        if (fromId > total) return new Forecast[](0);
        uint256 end = fromId + count - 1;
        if (end > total) end = total;
        page = new Forecast[](end - fromId + 1);
        for (uint256 id = fromId; id <= end; ++id) {
            page[id - fromId] = _forecasts[id - 1];
        }
    }

    function stats(uint256 modelId, uint8 horizon) external view returns (Stats memory) {
        _model(modelId);
        if (horizon >= HORIZON_COUNT) revert UnknownHorizon(horizon);
        return _stats[modelId][horizon];
    }

    /// @notice Mean score of a model's scored forecasts at one horizon (0 to 10000), and how many there are.
    function averageScore(uint256 modelId, uint8 horizon) external view returns (uint256 average, uint256 scored) {
        if (horizon >= HORIZON_COUNT) revert UnknownHorizon(horizon);
        Stats storage s = _stats[modelId][horizon];
        scored = s.scored;
        average = scored == 0 ? 0 : uint256(s.scoreSum) / scored;
    }

    /// @notice The model's most recent forecast for a market and horizon (status None if it never committed one).
    function latestForecast(uint256 modelId, uint256 marketId, uint8 horizon) external view returns (Forecast memory f) {
        uint256 id = latestId[modelId][marketId][horizon];
        if (id != 0) f = _forecasts[id - 1];
    }

    /// @notice Agreement among the given models' live forecasts for one market and horizon.
    /// The caller picks the models (for example the top of the leaderboard). Each model counts once.
    function consensus(uint256 marketId, uint8 horizon, uint256[] calldata modelIds)
        external
        view
        returns (Consensus memory c)
    {
        if (marketId >= _markets.length) revert UnknownMarket(marketId);
        if (horizon >= HORIZON_COUNT) revert UnknownHorizon(horizon);
        if (modelIds.length > MAX_BATCH) revert BatchSize();
        uint256 lowSum;
        uint256 highSum;
        uint256 confSum;
        uint256 refLatest;
        uint256 refAt;
        for (uint256 i; i < modelIds.length; ++i) {
            bool seen;
            for (uint256 j; j < i; ++j) {
                if (modelIds[j] == modelIds[i]) {
                    seen = true;
                    break;
                }
            }
            if (seen) continue;
            uint256 id = latestId[modelIds[i]][marketId][horizon];
            if (id == 0) continue;
            Forecast storage f = _forecasts[id - 1];
            if (f.status != Status.Open || f.resolvesAt <= block.timestamp) continue;
            c.live += 1;
            if (f.direction > 0) c.up += 1;
            else if (f.direction < 0) c.down += 1;
            else c.flat += 1;
            lowSum += f.low;
            highSum += f.high;
            confSum += f.confidenceBps;
            uint256 mid = (uint256(f.low) + uint256(f.high)) / 2;
            if (c.live == 1 || mid < c.midMin) c.midMin = mid;
            if (mid > c.midMax) c.midMax = mid;
            if (f.committedAt >= refAt) {
                refAt = f.committedAt;
                refLatest = f.referencePrice;
            }
        }
        if (c.live > 0) {
            c.lowAvg = lowSum / c.live;
            c.highAvg = highSum / c.live;
            c.confidenceAvg = confSum / c.live;
            c.spreadPpm = ((c.midMax - c.midMin) * 1e6) / refLatest;
        }
    }

    // ---------------------------------------------------------------- internal

    function _model(uint256 modelId) internal view returns (Model storage) {
        if (modelId == 0 || modelId > _models.length) revert UnknownModel(modelId);
        return _models[modelId - 1];
    }

    function _ownedModel(uint256 modelId) internal view returns (Model storage m) {
        m = _model(modelId);
        if (m.owner != msg.sender) revert NotModelOwner(modelId);
    }

    function _forecast(uint256 forecastId) internal view returns (Forecast storage) {
        if (forecastId == 0 || forecastId > _forecasts.length) revert UnknownForecast(forecastId);
        return _forecasts[forecastId - 1];
    }
}
