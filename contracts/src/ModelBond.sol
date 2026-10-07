// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IModelOwners {
    function ownerOf(uint256 modelId) external view returns (address);
}

/// @title ModelBond
/// @notice A refundable bond of the project token behind a model in the ForecastOracle.
///
/// Registering a model is free, so anyone could register thousands and show only the lucky ones.
/// A bond puts a fixed amount of the token behind one model. The leaderboard marks bonded models,
/// and follow mode only lists bonded leaders. The bond earns nothing and is never slashed: the
/// poster asks to exit, waits the exit delay, and takes the full amount back.
///
/// Bonds are kept per (model, poster). A model counts as bonded only while its current owner has an
/// active bond, so a model that changes hands is not bonded by its previous owner's tokens.
///
/// There is no owner, no admin key, no fee, no pause and no upgrade path. The token, the oracle, the
/// bond amount and the exit delay are fixed at deployment.
contract ModelBond is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Bond {
        uint128 amount;
        uint40 postedAt;
        uint40 exitAt; // 0 while active
    }

    IERC20 public token;
    IModelOwners public oracle;
    uint256 public bondAmount;
    uint256 public exitDelay;

    mapping(uint256 modelId => mapping(address poster => Bond)) internal _bonds;
    uint256 public totalBonded;

    event Bonded(uint256 indexed modelId, address indexed poster, uint256 amount);
    event ExitRequested(uint256 indexed modelId, address indexed poster, uint256 exitAt);
    event Withdrawn(uint256 indexed modelId, address indexed poster, uint256 amount);

    error ZeroAddress();
    error BadTerms();
    error NotModelOwner(uint256 modelId);
    error AlreadyBonded(uint256 modelId);
    error NoBond(uint256 modelId);
    error ExitPending(uint256 modelId);
    error ExitNotRequested(uint256 modelId);
    error TooEarly(uint256 exitAt);
    error TransferShortfall(uint256 expected, uint256 received);

    constructor(IERC20 token_, IModelOwners oracle_, uint256 bondAmount_, uint256 exitDelay_) {
        if (address(token_) == address(0) || address(oracle_) == address(0)) revert ZeroAddress();
        if (address(token_).code.length == 0 || address(oracle_).code.length == 0) revert BadTerms();
        if (bondAmount_ == 0 || bondAmount_ > type(uint128).max) revert BadTerms();
        if (exitDelay_ < 1 days || exitDelay_ > 90 days) revert BadTerms();
        token = token_;
        oracle = oracle_;
        bondAmount = bondAmount_;
        exitDelay = exitDelay_;
    }

    /// @notice Posts the bond for a model the caller owns in the oracle.
    function bond(uint256 modelId) external nonReentrant {
        if (oracle.ownerOf(modelId) != msg.sender) revert NotModelOwner(modelId);
        Bond storage b = _bonds[modelId][msg.sender];
        if (b.amount != 0) revert AlreadyBonded(modelId);

        uint256 amount = bondAmount;
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != amount) revert TransferShortfall(amount, received);

        b.amount = uint128(amount);
        b.postedAt = uint40(block.timestamp);
        b.exitAt = 0;
        totalBonded += amount;
        emit Bonded(modelId, msg.sender, amount);
    }

    /// @notice Starts the exit delay. The model stops counting as bonded right away.
    function requestExit(uint256 modelId) external {
        Bond storage b = _bonds[modelId][msg.sender];
        if (b.amount == 0) revert NoBond(modelId);
        if (b.exitAt != 0) revert ExitPending(modelId);
        uint256 exitAt = block.timestamp + exitDelay;
        b.exitAt = uint40(exitAt);
        emit ExitRequested(modelId, msg.sender, exitAt);
    }

    /// @notice Returns the full bond once the exit delay has passed.
    function withdraw(uint256 modelId) external nonReentrant {
        Bond storage b = _bonds[modelId][msg.sender];
        uint256 amount = b.amount;
        if (amount == 0) revert NoBond(modelId);
        if (b.exitAt == 0) revert ExitNotRequested(modelId);
        if (block.timestamp < b.exitAt) revert TooEarly(b.exitAt);
        delete _bonds[modelId][msg.sender];
        totalBonded -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(modelId, msg.sender, amount);
    }

    function bondOf(uint256 modelId, address poster) external view returns (Bond memory) {
        return _bonds[modelId][poster];
    }

    /// @notice True while the model's current owner has an active bond (posted, no exit requested).
    function isBonded(uint256 modelId) public view returns (bool) {
        address owner;
        try oracle.ownerOf(modelId) returns (address o) {
            owner = o;
        } catch {
            return false;
        }
        Bond storage b = _bonds[modelId][owner];
        return b.amount != 0 && b.exitAt == 0;
    }

    /// @notice isBonded for several models at once.
    function bondedMany(uint256[] calldata modelIds) external view returns (bool[] memory out) {
        out = new bool[](modelIds.length);
        for (uint256 i; i < modelIds.length; ++i) {
            out[i] = isBonded(modelIds[i]);
        }
    }
}
