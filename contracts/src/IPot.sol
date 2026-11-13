// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Most members a single pot can hold. File-level so tests and Pot share it
// (interfaces cannot declare constants). Import with `import {MAX_MEMBERS} from "src/IPot.sol";`.
uint256 constant MAX_MEMBERS = 20;

/// @title IPot
/// @notice One contract holds every pot, keyed by potId. Members pay `share` in native USDC
///         (18 decimals, msg.value). When everyone has paid the pot locks; the organizer can
///         then request a payout, which members may object to during the objection window.
interface IPot {
    // ---------------------------------------------------------------- types

    enum State {
        Funding, // 0
        Locked, // 1
        PayoutRequested, // 2
        Released, // 3 (terminal)
        Frozen // 4 (terminal; paid members can refund)
    }

    struct PotView {
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
    }

    // --------------------------------------------------------------- events

    event PotCreated(
        uint256 indexed potId,
        address indexed organizer,
        address[] members,
        uint256 total,
        uint256 share,
        uint256 deadline,
        uint256 threshold,
        uint256 objectionWindow,
        uint256 requestWindow
    );
    event Paid(uint256 indexed potId, address indexed member, uint256 amount);
    event Locked(uint256 indexed potId, uint256 lockedAt);
    event SeatSwapped(uint256 indexed potId, address indexed leaver, address indexed replacement, uint256 refunded);
    event Refunded(uint256 indexed potId, address indexed member, uint256 amount);
    event PayoutRequested(uint256 indexed potId, bytes32 receiptHash, uint256 releaseEligibleAt);
    event Objected(uint256 indexed potId, address indexed member, uint256 objectionsCount);
    event Released(uint256 indexed potId, address indexed organizer, uint256 amount);
    event Expired(uint256 indexed potId);
    event Frozen(uint256 indexed potId);

    // --------------------------------------------------------------- errors

    error InvalidParams();
    error ZeroAddress();
    error DuplicateMember();
    error NotMember();
    error NotOrganizer();
    error WrongState();
    error WrongAmount();
    error AlreadyPaid();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NotRefundable();
    error AlreadyRefunded();
    error AlreadyObjected();
    error WindowOpen();
    error WindowClosed();
    error RequestWindowOpen();
    error FormerMember();
    error TransferFailed();
    error NotImplemented();

    // ------------------------------------------------------------ mutations

    function createPot(
        uint256 total,
        uint256 share,
        address[] calldata members,
        uint256 deadline,
        uint256 threshold,
        uint256 objectionWindow,
        uint256 requestWindow
    ) external returns (uint256 potId);

    function pay(uint256 potId) external payable;

    function swapSeat(uint256 potId, address leaver, address replacement) external;

    function refund(uint256 potId) external;

    function requestRelease(uint256 potId, bytes32 receiptHash) external;

    function object(uint256 potId) external;

    function finalizeRelease(uint256 potId) external;

    function expire(uint256 potId) external;

    // ---------------------------------------------------------------- views

    function getPot(uint256 potId) external view returns (PotView memory);

    function nextPotId() external view returns (uint256);

    function hasPaid(uint256 potId, address account) external view returns (bool);

    function hasObjected(uint256 potId, address account) external view returns (bool);

    function hasRefunded(uint256 potId, address account) external view returns (bool);

    function isMember(uint256 potId, address account) external view returns (bool);

    function wasMember(uint256 potId, address account) external view returns (bool);
}
