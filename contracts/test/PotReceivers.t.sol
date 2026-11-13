// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base} from "./Base.t.sol";
import {Pot} from "src/Pot.sol";
import {IPot} from "src/IPot.sol";

/// @dev Member that can pay and refund through itself but refuses native value.
contract RejectingMember {
    function pay(Pot pot, uint256 id) external payable {
        pot.pay{value: msg.value}(id);
    }

    function callRefund(Pot pot, uint256 id) external {
        pot.refund(id);
    }

    receive() external payable {
        revert("no thanks");
    }
}

/// @dev Organizer that can drive the pot through itself but refuses native value.
contract RejectingOrganizer {
    function create(
        Pot pot,
        uint256 total,
        uint256 share,
        address[] calldata members,
        uint256 dl,
        uint256 threshold,
        uint256 objectionWindow,
        uint256 requestWindow
    ) external returns (uint256) {
        return pot.createPot(total, share, members, dl, threshold, objectionWindow, requestWindow);
    }

    function request(Pot pot, uint256 id, bytes32 receipt) external {
        pot.requestRelease(id, receipt);
    }

    receive() external payable {
        revert("no thanks");
    }
}

/// @dev Member whose receive() re-enters the pot. With `swallow` false the inner revert
///      propagates; with `swallow` true it is recorded and receive() succeeds.
contract ReentrantMember {
    Pot internal immutable POT;
    uint256 internal id;
    uint256 internal otherId;
    bool public swallow;
    bool public entered;
    bool public refundReentryOk;
    bool public payReentryOk;
    bytes public refundReentryRet;
    bytes public payReentryRet;

    constructor(Pot pot_) {
        POT = pot_;
    }

    function setSwallow(bool v) external {
        swallow = v;
    }

    function pay(uint256 id_) external payable {
        POT.pay{value: msg.value}(id_);
    }

    function callRefund(uint256 id_, uint256 otherId_) external {
        id = id_;
        otherId = otherId_;
        POT.refund(id_);
    }

    receive() external payable {
        if (entered) return;
        entered = true;
        if (!swallow) {
            POT.refund(id); // inner revert propagates, so the outer send fails
            return;
        }
        (refundReentryOk, refundReentryRet) = address(POT).call(abi.encodeCall(Pot.refund, (id)));
        (payReentryOk, payReentryRet) = address(POT).call{value: msg.value}(abi.encodeCall(Pot.pay, (otherId)));
    }
}

/// @notice Adversarial receivers: contracts that reject or re-enter on native transfers.
contract PotReceivers is Base {
    function _pair(address a) internal view returns (address[] memory two) {
        two = new address[](2);
        two[0] = a;
        two[1] = m[0];
    }

    function _createFor(address a) internal returns (uint256 id) {
        vm.prank(org);
        id = pot.createPot(2 * SHARE, SHARE, _pair(a), deadline, 1, WINDOW, REQ_WINDOW);
    }

    // ------------------------------------------------- (a) rejecting member

    function test_RejectingMember_RefundReverts() public {
        RejectingMember rm = new RejectingMember();
        vm.deal(address(rm), SHARE);
        uint256 id = _createFor(address(rm));
        rm.pay{value: SHARE}(pot, id);
        vm.warp(deadline);

        vm.expectRevert(IPot.TransferFailed.selector);
        rm.callRefund(pot, id);

        assertFalse(pot.hasRefunded(id, address(rm)), "refund flag must roll back");
        assertEq(address(pot).balance, SHARE, "no funds moved");
    }

    function test_RejectingMember_SwapSeatReverts() public {
        RejectingMember rm = new RejectingMember();
        vm.deal(address(rm), SHARE);
        uint256 id = _createFor(address(rm));
        rm.pay{value: SHARE}(pot, id);

        address replacement = makeAddr("replacement");
        vm.prank(org);
        vm.expectRevert(IPot.TransferFailed.selector);
        pot.swapSeat(id, address(rm), replacement);

        assertTrue(pot.isMember(id, address(rm)), "swap must roll back");
        assertFalse(pot.isMember(id, replacement));
        assertEq(pot.getPot(id).paymentsCount, 1);
        assertEq(address(pot).balance, SHARE, "no funds moved");
    }

    // ----------------------------------------------- (b) rejecting organizer

    /// @dev Documents a known liveness gap: an organizer that cannot receive native value
    ///      can never be paid, so the pot stays PayoutRequested forever (members cannot
    ///      refund from it either). See docs/handoffs/contract.md.
    function test_RejectingOrganizer_FinalizeReverts_KnownGap() public {
        RejectingOrganizer ro = new RejectingOrganizer();
        uint256 id = ro.create(pot, TOTAL, SHARE, m, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
        _lock(id);
        ro.request(pot, id, RECEIPT);
        vm.warp(pot.getPot(id).releaseEligibleAt);

        vm.expectRevert(IPot.TransferFailed.selector);
        pot.finalizeRelease(id);

        assertEq(uint8(pot.getPot(id).state), uint8(IPot.State.PayoutRequested), "stays PayoutRequested");
        assertEq(address(pot).balance, TOTAL, "no funds moved");
    }

    // ---------------------------------------------------- (c) reentrant member

    function test_ReentrantMember_PropagatingReentry_RefundFailsClean() public {
        ReentrantMember rm = new ReentrantMember(pot);
        vm.deal(address(rm), 2 * SHARE);
        uint256 id = _createFor(address(rm));
        rm.pay{value: SHARE}(id);
        vm.warp(deadline);
        uint256 before = address(rm).balance;

        // Inner refund hits ReentrancyGuard and reverts, receive() reverts, the outer
        // call() returns false, so the outer refund reverts TransferFailed.
        vm.expectRevert(IPot.TransferFailed.selector);
        rm.callRefund(id, id);

        assertFalse(pot.hasRefunded(id, address(rm)));
        assertEq(address(pot).balance, SHARE, "no funds moved");
        assertEq(address(rm).balance, before, "member balance unchanged");
    }

    function test_ReentrantMember_SwallowedReentry_BlockedAndPaidOnce() public {
        ReentrantMember rm = new ReentrantMember(pot);
        rm.setSwallow(true);
        vm.deal(address(rm), 2 * SHARE);
        uint256 id = _createFor(address(rm));
        // A second pot where re-entry via pay() would otherwise succeed.
        vm.prank(org);
        uint256 otherId = pot.createPot(2 * SHARE, SHARE, _pair(address(rm)), deadline + 1 days, 1, WINDOW, REQ_WINDOW);
        rm.pay{value: SHARE}(id);
        vm.warp(deadline);
        uint256 before = address(rm).balance;

        rm.callRefund(id, otherId);

        bytes memory guard = abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertTrue(rm.entered(), "receive() ran");
        assertFalse(rm.refundReentryOk(), "re-entrant refund blocked");
        assertEq(rm.refundReentryRet(), guard);
        assertFalse(rm.payReentryOk(), "re-entrant pay blocked");
        assertEq(rm.payReentryRet(), guard);

        // Outer refund completed exactly once; the pay attempt moved nothing.
        assertTrue(pot.hasRefunded(id, address(rm)));
        assertFalse(pot.hasPaid(otherId, address(rm)));
        assertEq(address(pot).balance, 0, "exactly one share paid out");
        assertEq(address(rm).balance, before + SHARE, "member got exactly its share back");
    }
}
