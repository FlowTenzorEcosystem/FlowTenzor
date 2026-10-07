// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Test-only Chainlink-style feed for local fork tests: its runtime code is placed over a real feed
/// address with anvil_setCode, so it keeps its state in its own, explicitly initialised slots.
contract E2EFeed {
    struct Round {
        int256 answer;
        uint256 updatedAt;
    }

    bytes32 private constant BASE = keccak256("flowtenzor.e2e.feed");

    function _s() private pure returns (mapping(uint80 => Round) storage r) {
        bytes32 slot = BASE;
        assembly {
            r.slot := slot
        }
    }

    function _last() private view returns (uint80 id) {
        bytes32 slot = bytes32(uint256(BASE) + 1);
        assembly {
            id := sload(slot)
        }
    }

    function _setLast(uint80 id) private {
        bytes32 slot = bytes32(uint256(BASE) + 1);
        assembly {
            sstore(slot, id)
        }
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "E2E / USD";
    }

    /// Appends a round (phase 1) with the given answer and timestamp.
    function push(int256 answer, uint256 updatedAt) external returns (uint80 id) {
        uint80 last = _last();
        id = last == 0 ? uint80((uint256(1) << 64) | 1) : last + 1;
        _s()[id] = Round(answer, updatedAt);
        _setLast(id);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        uint80 id = _last();
        Round memory r = _s()[id];
        require(r.updatedAt != 0, "No data present");
        return (id, r.answer, r.updatedAt, r.updatedAt, id);
    }

    function getRoundData(uint80 id) external view returns (uint80, int256, uint256, uint256, uint80) {
        Round memory r = _s()[id];
        require(r.updatedAt != 0, "No data present");
        return (id, r.answer, r.updatedAt, r.updatedAt, id);
    }
}
