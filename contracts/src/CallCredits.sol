// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CallCredits
/// @notice Prepaid calls for the forecast API, paid in a stablecoin (USDG on Robinhood Chain).
///
/// A buyer pays for whole packs of calls. The payment goes straight to the treasury in the same
/// transaction; this contract never holds funds. The API reads `callsPurchased(account)` and counts
/// each call against it, so the purchase record is public and cannot be edited by anyone.
///
/// There is no owner, no admin key, no pause and no upgrade path. The payment token, the treasury,
/// the pack size and the pack price are fixed at deployment. Purchases are final.
contract CallCredits is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public paymentToken;
    address public treasury;
    /// Calls in one pack.
    uint256 public callsPerPack;
    /// Price of one pack in payment-token base units.
    uint256 public packPrice;

    mapping(address account => uint256) public callsPurchased;
    mapping(address account => uint256) public amountPaid;
    uint256 public totalPaid;

    event Purchased(address indexed payer, address indexed account, uint256 packs, uint256 calls, uint256 amount);

    error ZeroAddress();
    error BadTerms();
    error ZeroPacks();
    error TransferShortfall(uint256 expected, uint256 received);

    constructor(IERC20 paymentToken_, address treasury_, uint256 callsPerPack_, uint256 packPrice_) {
        if (address(paymentToken_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (address(paymentToken_).code.length == 0 || treasury_ == address(this)) revert BadTerms();
        if (callsPerPack_ == 0 || callsPerPack_ > 1e9 || packPrice_ == 0 || packPrice_ > 1e30) revert BadTerms();
        paymentToken = paymentToken_;
        treasury = treasury_;
        callsPerPack = callsPerPack_;
        packPrice = packPrice_;
    }

    /// @notice Buys `packs` packs of calls for `account` (often the caller's own address).
    function buy(address account, uint256 packs) external nonReentrant returns (uint256 calls) {
        if (account == address(0)) revert ZeroAddress();
        if (packs == 0) revert ZeroPacks();
        uint256 amount = packs * packPrice;
        calls = packs * callsPerPack;

        // The treasury must receive the full amount: tokens that skim a fee on transfer are refused.
        uint256 before = paymentToken.balanceOf(treasury);
        paymentToken.safeTransferFrom(msg.sender, treasury, amount);
        uint256 received = paymentToken.balanceOf(treasury) - before;
        if (received != amount) revert TransferShortfall(amount, received);

        callsPurchased[account] += calls;
        amountPaid[account] += amount;
        totalPaid += amount;
        emit Purchased(msg.sender, account, packs, calls, amount);
    }

    /// @notice What `packs` packs cost, in payment-token base units.
    function quote(uint256 packs) external view returns (uint256 amount, uint256 calls) {
        return (packs * packPrice, packs * callsPerPack);
    }
}
