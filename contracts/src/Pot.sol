// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPot, MAX_MEMBERS} from "./IPot.sol";

/// @title Pot
/// @notice Holds every pot by potId. See IPot for the lifecycle and events.
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
        PotData storage p = _pots[potId];
        if (msg.sender != p.organizer) revert NotOrganizer();
        if (p.state != State.Funding) revert WrongState();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= p.deadline) revert DeadlinePassed();
        if (!p.isMember[leaver]) revert NotMember();
        if (replacement == address(0)) revert ZeroAddress();
        if (p.isMember[replacement]) revert DuplicateMember();
        if (p.wasMember[replacement]) revert FormerMember();

        // Replacement takes the leaver's slot in members[].
        uint256 n = p.members.length;
        for (uint256 i; i < n; ++i) {
            if (p.members[i] == leaver) {
                p.members[i] = replacement;
                break;
            }
        }
        p.isMember[leaver] = false;
        p.isMember[replacement] = true;
        p.wasMember[replacement] = true;

        uint256 refunded;
        if (p.hasPaid[leaver]) {
            // Paid leaver is refunded; has_paid itself is never cleared.
            p.hasRefunded[leaver] = true;
            --p.paymentsCount;
            refunded = p.share;
        }
        emit SeatSwapped(potId, leaver, replacement, refunded);
        if (refunded != 0) _send(leaver, refunded);
    }

    function refund(uint256 potId) external nonReentrant {
        PotData storage p = _pots[potId];
        State s = p.state;
        if (s != State.Funding && s != State.Frozen) revert WrongState();
        // forge-lint: disable-next-line(block-timestamp)
        if (s == State.Funding && block.timestamp < p.deadline) revert DeadlineNotPassed();
        if (!p.isMember[msg.sender] || !p.hasPaid[msg.sender]) revert NotRefundable();
        if (p.hasRefunded[msg.sender]) revert AlreadyRefunded();

        p.hasRefunded[msg.sender] = true;
        uint256 amount = p.share;
        emit Refunded(potId, msg.sender, amount);
        _send(msg.sender, amount);
    }

    function requestRelease(uint256 potId, bytes32 receiptHash) external nonReentrant {
        PotData storage p = _pots[potId];
        if (msg.sender != p.organizer) revert NotOrganizer();
        if (p.state != State.Locked) revert WrongState();

        p.receiptHash = receiptHash;
        uint256 eligibleAt = block.timestamp + p.objectionWindow;
        p.releaseEligibleAt = eligibleAt;
        p.state = State.PayoutRequested;
        emit PayoutRequested(potId, receiptHash, eligibleAt);
    }

    function object(uint256 potId) external nonReentrant {
        PotData storage p = _pots[potId];
        if (p.state != State.PayoutRequested) revert WrongState();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= p.releaseEligibleAt) revert WindowClosed();
        if (!p.isMember[msg.sender]) revert NotMember();
        if (p.hasObjected[msg.sender]) revert AlreadyObjected();

        p.hasObjected[msg.sender] = true;
        uint256 count = ++p.objectionsCount;
        emit Objected(potId, msg.sender, count);

        if (count >= p.threshold) {
            p.state = State.Frozen;
            emit Frozen(potId);
        }
    }

    function finalizeRelease(uint256 potId) external nonReentrant {
        PotData storage p = _pots[potId];
        if (p.state != State.PayoutRequested) revert WrongState();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < p.releaseEligibleAt) revert WindowOpen();

        p.state = State.Released;
        address organizer = p.organizer;
        uint256 amount = p.total;
        emit Released(potId, organizer, amount);
        _send(organizer, amount);
    }

    function expire(uint256 potId) external nonReentrant {
        PotData storage p = _pots[potId];
        if (p.state != State.Locked) revert WrongState();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < p.lockedAt + p.requestWindow) revert RequestWindowOpen();

        p.state = State.Frozen;
        emit Expired(potId);
    }

    // ---------------------------------------------------------------- views

    function getPot(uint256 potId) external view returns (PotView memory) {
        PotData storage p = _pots[potId];
        PotView memory v;
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
        return v;
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

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
