// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPot, MAX_MEMBERS} from "./IPot.sol";

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
        uint256 n = members.length;
        if (
            n == 0 || n > MAX_MEMBERS || share == 0 || total != share * n
                || threshold == 0 || threshold > n || objectionWindow < 60 || objectionWindow > 7 days
                || requestWindow < 60 || requestWindow > 30 days
        ) revert InvalidParams();
        // forge-lint: disable-next-line(block-timestamp)
        if (deadline <= block.timestamp) revert InvalidParams();

        potId = _nextPotId++;
        PotData storage p = _pots[potId];
        p.organizer = msg.sender;
        p.total = total;
        p.share = share;
        p.deadline = deadline;
        p.threshold = threshold;
        p.objectionWindow = objectionWindow;
        p.requestWindow = requestWindow;

        for (uint256 i; i < n; ++i) {
            address member = members[i];
            if (member == address(0)) revert ZeroAddress();
            if (p.isMember[member]) revert DuplicateMember();
            p.isMember[member] = true;
            p.wasMember[member] = true;
            p.members.push(member);
        }

        emit PotCreated(potId, msg.sender, members, total, share, deadline, threshold, objectionWindow, requestWindow);
    }

    function pay(uint256 potId) external payable nonReentrant {
        PotData storage p = _pots[potId];
        if (p.state != State.Funding) revert WrongState();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= p.deadline) revert DeadlinePassed();
        if (!p.isMember[msg.sender]) revert NotMember();
        if (p.hasPaid[msg.sender]) revert AlreadyPaid();
        if (msg.value != p.share) revert WrongAmount();

        p.hasPaid[msg.sender] = true;
        uint256 count = ++p.paymentsCount;
        emit Paid(potId, msg.sender, msg.value);

        if (count == p.members.length) {
            p.state = State.Locked;
            p.lockedAt = block.timestamp;
            emit Locked(potId, block.timestamp);
        }
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

    function getPot(uint256 potId) external view returns (PotView memory v) {
        PotData storage p = _pots[potId];
        v.organizer = p.organizer;
        v.total = p.total;
        v.share = p.share;
        v.deadline = p.deadline;
        v.threshold = p.threshold;
        v.objectionWindow = p.objectionWindow;
        v.requestWindow = p.requestWindow;
        v.lockedAt = p.lockedAt;
        v.state = p.state;
        v.paymentsCount = p.paymentsCount;
        v.objectionsCount = p.objectionsCount;
        v.receiptHash = p.receiptHash;
        v.releaseEligibleAt = p.releaseEligibleAt;
        v.members = p.members;
    }

    function nextPotId() external view returns (uint256) {
        return _nextPotId;
    }

    function hasPaid(uint256 potId, address account) external view returns (bool) {
        return _pots[potId].hasPaid[account];
    }

    function hasObjected(uint256 potId, address account) external view returns (bool) {
        return _pots[potId].hasObjected[account];
    }

    function hasRefunded(uint256 potId, address account) external view returns (bool) {
        return _pots[potId].hasRefunded[account];
    }

    function isMember(uint256 potId, address account) external view returns (bool) {
        return _pots[potId].isMember[account];
    }

    function wasMember(uint256 potId, address account) external view returns (bool) {
        return _pots[potId].wasMember[account];
    }

    // -------------------------------------------------------------- internal

    /// @dev Skeleton only. A conditional revert that reads storage keeps the declared
    ///      mutability warning-free (no "restrict to pure", no unreachable code after
    ///      `nonReentrant`). Remove once every function is implemented.
    function _notImplemented() private view {
        if (_nextPotId == _nextPotId) revert NotImplemented();
    }
}
