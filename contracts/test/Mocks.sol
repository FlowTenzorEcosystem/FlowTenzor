// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Chainlink-style proxy with phases: round id = phase << 64 | index. Missing rounds revert.
contract MockFeed {
    struct Round {
        int256 answer;
        uint256 updatedAt;
    }

    uint8 public decimals = 8;
    uint16 public phase = 1;
    mapping(uint16 => uint64) public lastIndex;
    mapping(uint80 => Round) internal _rounds;
    bool public zeroForMissing; // some aggregators answer zeros instead of reverting

    function setDecimals(uint8 d) external {
        decimals = d;
    }

    function setZeroForMissing(bool v) external {
        zeroForMissing = v;
    }

    function push(int256 answer, uint256 updatedAt) public returns (uint80 id) {
        uint64 next = lastIndex[phase] + 1;
        lastIndex[phase] = next;
        id = uint80((uint256(phase) << 64) | next);
        _rounds[id] = Round(answer, updatedAt);
    }

    /// Pushes at the current block time.
    function pushNow(int256 answer) external returns (uint80) {
        return push(answer, block.timestamp);
    }

    function newPhase() external {
        phase += 1;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        uint80 id = uint80((uint256(phase) << 64) | lastIndex[phase]);
        Round memory r = _rounds[id];
        require(r.updatedAt != 0, "No data present");
        return (id, r.answer, r.updatedAt, r.updatedAt, id);
    }

    function getRoundData(uint80 id) external view returns (uint80, int256, uint256, uint256, uint80) {
        Round memory r = _rounds[id];
        if (r.updatedAt == 0) {
            if (zeroForMissing) return (id, 0, 0, 0, 0);
            revert("No data present");
        }
        return (id, r.answer, r.updatedAt, r.updatedAt, id);
    }
}

contract MockToken is ERC20 {
    uint8 internal _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Burns 1 % of every transfer: the contracts must refuse it.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

/// Owner registry stand-in for ModelBond tests.
contract MockOwners {
    mapping(uint256 => address) public owners;

    function set(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        address o = owners[id];
        require(o != address(0), "unknown");
        return o;
    }
}
