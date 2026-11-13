// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPot} from "./IPot.sol";

/// @title Pot
/// @notice Skeleton (Task 1.2). Every function reverts NotImplemented; Tasks 1.3-1.5 fill it in.
///         Storage layout below is the intended final layout.
contract Pot is IPot, ReentrancyGuard {
    /// @dev Per-pot storage. Mirrors PotView plus the per-address flags.
    struct PotData {
        address organizer;
        uint256 total;
        uint256 share;
        uint256 deadline;
        uint256 threshold;
        uint256 objectionWindow;
        uint256 requestWindow;
        uint256 lockedAt;
        State state;
        uint256 paymentsCount;
        uint256 objectionsCount;
        bytes32 receiptHash;
        uint256 releaseEligibleAt;
        address[] members;
        mapping(address => bool) isMember;
        mapping(address => bool) wasMember;
        mapping(address => bool) hasPaid;
        mapping(address => bool) hasObjected;
        mapping(address => bool) hasRefunded;
    }

    mapping(uint256 => PotData) internal _pots;
    uint256 internal _nextPotId;

    // ------------------------------------------------------------ mutations

    function createPot(
        uint256 total,
        uint256 share,
        address[] calldata members,
        uint256 deadline,
        uint256 threshold,
        uint256 objectionWindow,
        uint256 requestWindow
    )
        external
        nonReentrant
        returns (uint256 potId)
    {
        (total, share, members, deadline, threshold, objectionWindow, requestWindow); // skeleton: unused
        _notImplemented();
        return 0;
    }

    function pay(uint256 potId) external payable nonReentrant {
        potId; // skeleton: unused
        _notImplemented();
    }

    function swapSeat(uint256 potId, address leaver, address replacement) external nonReentrant {
        (potId, leaver, replacement); // skeleton: unused
        _notImplemented();
    }

    function refund(uint256 potId) external nonReentrant {
        potId; // skeleton: unused
        _notImplemented();
    }

    function requestRelease(uint256 potId, bytes32 receiptHash) external nonReentrant {
        (potId, receiptHash); // skeleton: unused
        _notImplemented();
    }

    function object(uint256 potId) external nonReentrant {
        potId; // skeleton: unused
        _notImplemented();
    }

    function finalizeRelease(uint256 potId) external nonReentrant {
        potId; // skeleton: unused
        _notImplemented();
    }

    function expire(uint256 potId) external nonReentrant {
        potId; // skeleton: unused
        _notImplemented();
    }

    // ---------------------------------------------------------------- views

    function getPot(uint256 potId) external view returns (PotView memory) {
        potId; // skeleton: unused
        PotView memory empty;
        _notImplemented();
        return empty;
    }

    function nextPotId() external view returns (uint256) {
        _notImplemented();
        return 0;
    }

    function hasPaid(uint256 potId, address account) external view returns (bool) {
        (potId, account); // skeleton: unused
        _notImplemented();
        return false;
    }

    function hasObjected(uint256 potId, address account) external view returns (bool) {
        (potId, account); // skeleton: unused
        _notImplemented();
        return false;
    }

    function hasRefunded(uint256 potId, address account) external view returns (bool) {
        (potId, account); // skeleton: unused
        _notImplemented();
        return false;
    }

    function isMember(uint256 potId, address account) external view returns (bool) {
        (potId, account); // skeleton: unused
        _notImplemented();
        return false;
    }

    function wasMember(uint256 potId, address account) external view returns (bool) {
        (potId, account); // skeleton: unused
        _notImplemented();
        return false;
    }

    // -------------------------------------------------------------- internal

    /// @dev Skeleton only. A conditional revert that reads storage keeps the declared
    ///      mutability warning-free (no "restrict to pure", no unreachable code after
    ///      `nonReentrant`). Remove once every function is implemented.
    function _notImplemented() private view {
        if (_nextPotId == _nextPotId) revert NotImplemented();
    }
}
