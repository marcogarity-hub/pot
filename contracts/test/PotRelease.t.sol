// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {Base} from "./Base.t.sol";
import {IPot} from "src/IPot.sol";

/// @notice Tests 02, 11, 14-19, 21-23: requestRelease, object, finalizeRelease, expire.
contract PotReleaseTest is Base {
    address internal stranger;

    function setUp() public override {
        super.setUp();
        stranger = makeAddr("stranger");
    }

    function _state(uint256 id) internal view returns (IPot.State) {
        return pot.getPot(id).state;
    }

    function _object(uint256 id, uint256 count) internal {
        for (uint256 i; i < count; ++i) {
            vm.prank(m[i]);
            pot.object(id);
        }
    }

    // ------------------------------------------------------- requestRelease

    function test_21_OnlyOrganizer_AfterLock() public {
        uint256 id = _create();
        _lock(id);

        vm.prank(m[0]);
        vm.expectRevert(IPot.NotOrganizer.selector);
        pot.requestRelease(id, RECEIPT);

        vm.prank(stranger);
        vm.expectRevert(IPot.NotOrganizer.selector);
        pot.requestRelease(id, RECEIPT);

        // Organizer before lock (Funding): WrongState.
        vm.prank(org);
        uint256 id2 = pot.createPot(TOTAL, SHARE, m, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
        vm.prank(org);
        vm.expectRevert(IPot.WrongState.selector);
        pot.requestRelease(id2, RECEIPT);

        vm.expectEmit(true, false, false, true, address(pot));
        emit IPot.PayoutRequested(id, RECEIPT, block.timestamp + WINDOW);
        vm.prank(org);
        pot.requestRelease(id, RECEIPT);

        IPot.PotView memory v = pot.getPot(id);
        assertEq(uint8(v.state), uint8(IPot.State.PayoutRequested));
        assertEq(v.receiptHash, RECEIPT);
        assertEq(v.releaseEligibleAt, block.timestamp + WINDOW);
    }

    function test_21_RequestTwice_WrongState() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.prank(org);
        vm.expectRevert(IPot.WrongState.selector);
        pot.requestRelease(id, RECEIPT);
    }

    /// @dev R5: requestRelease stays allowed after the request window until expire is called.
    function test_21_RequestAfterRequestWindow_UntilExpire() public {
        uint256 id = _create();
        _lock(id);
        vm.warp(pot.getPot(id).lockedAt + REQ_WINDOW + 1);
        vm.prank(org);
        pot.requestRelease(id, RECEIPT);
        assertEq(uint8(_state(id)), uint8(IPot.State.PayoutRequested));
    }

    function test_21_RequestAfterExpire_WrongState() public {
        uint256 id = _create();
        _lock(id);
        vm.warp(pot.getPot(id).lockedAt + REQ_WINDOW);
        pot.expire(id);
        vm.prank(org);
        vm.expectRevert(IPot.WrongState.selector);
        pot.requestRelease(id, RECEIPT);
    }

    // ------------------------------------------------------ finalizeRelease

    function test_14_PayoutAfterWindow_ZeroObjections() public {
        uint256 id = _create();
        _lockAndRequest(id);
        uint256 eligible = pot.getPot(id).releaseEligibleAt;
        uint256 before = org.balance;

        vm.warp(eligible);
        vm.expectEmit(true, true, false, true, address(pot));
        emit IPot.Released(id, org, TOTAL);
        vm.prank(stranger);
        pot.finalizeRelease(id);

        assertEq(org.balance - before, TOTAL);
        assertEq(org.balance - before, 2400 ether);
        assertEq(uint8(_state(id)), uint8(IPot.State.Released));
    }

    function test_02_ExactlyTotal() public {
        uint256 id = _create();
        _lockAndRequest(id);
        assertEq(address(pot).balance, TOTAL);
        uint256 before = org.balance;

        vm.warp(pot.getPot(id).releaseEligibleAt);
        pot.finalizeRelease(id);

        assertEq(org.balance - before, TOTAL);
        assertEq(address(pot).balance, 0);
    }

    function test_finalize_Twice_WrongState() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.warp(pot.getPot(id).releaseEligibleAt);
        pot.finalizeRelease(id);
        vm.expectRevert(IPot.WrongState.selector);
        pot.finalizeRelease(id);
    }

    function test_16_NoFinalizeBeforeWindow() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.warp(pot.getPot(id).releaseEligibleAt - 1);
        vm.expectRevert(IPot.WindowOpen.selector);
        pot.finalizeRelease(id);
    }

    function test_11_OrganizerCantWithdrawEarly() public {
        uint256 id = _create();
        uint256 before = org.balance;

        // Funding
        vm.prank(org);
        vm.expectRevert(IPot.WrongState.selector);
        pot.finalizeRelease(id);

        // Locked
        _lock(id);
        vm.prank(org);
        vm.expectRevert(IPot.WrongState.selector);
        pot.finalizeRelease(id);

        assertEq(org.balance, before);
        assertEq(address(pot).balance, TOTAL);
    }

    function test_finalize_BelowThreshold() public {
        uint256 id = _create();
        _lockAndRequest(id);
        _object(id, THRESHOLD - 1);
        assertEq(uint8(_state(id)), uint8(IPot.State.PayoutRequested));

        uint256 before = org.balance;
        vm.warp(pot.getPot(id).releaseEligibleAt);
        pot.finalizeRelease(id);
        assertEq(org.balance - before, TOTAL);
        assertEq(uint8(_state(id)), uint8(IPot.State.Released));
    }

    // --------------------------------------------------------------- object

    function test_15_ThresholdBlocksPayout() public {
        uint256 id = _create();
        _lockAndRequest(id);
        _object(id, THRESHOLD - 1);

        vm.expectEmit(true, true, false, true, address(pot));
        emit IPot.Objected(id, m[THRESHOLD - 1], THRESHOLD);
        vm.expectEmit(true, false, false, true, address(pot));
        emit IPot.Frozen(id);
        vm.prank(m[THRESHOLD - 1]);
        pot.object(id);

        assertEq(uint8(_state(id)), uint8(IPot.State.Frozen));
        assertEq(pot.getPot(id).objectionsCount, THRESHOLD);

        vm.warp(pot.getPot(id).releaseEligibleAt);
        vm.expectRevert(IPot.WrongState.selector);
        pot.finalizeRelease(id);
    }

    function test_object_BelowThreshold_EmitsObjectedOnly() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.expectEmit(true, true, false, true, address(pot));
        emit IPot.Objected(id, m[0], 1);
        vm.recordLogs();
        vm.prank(m[0]);
        pot.object(id);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "only Objected expected");
        for (uint256 i; i < logs.length; ++i) {
            assertTrue(logs[i].topics[0] != IPot.Frozen.selector, "Frozen must not be emitted");
        }
        assertTrue(pot.hasObjected(id, m[0]));
        assertEq(pot.getPot(id).objectionsCount, 1);
        assertEq(uint8(_state(id)), uint8(IPot.State.PayoutRequested));
    }

    function test_17_NoDoubleObjection() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.prank(m[0]);
        pot.object(id);
        vm.prank(m[0]);
        vm.expectRevert(IPot.AlreadyObjected.selector);
        pot.object(id);
        assertEq(pot.getPot(id).objectionsCount, 1);
    }

    function test_18_NonMemberCantObject() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.prank(stranger);
        vm.expectRevert(IPot.NotMember.selector);
        pot.object(id);
        vm.prank(org);
        vm.expectRevert(IPot.NotMember.selector);
        pot.object(id);
    }

    function test_object_AtWindowEnd_Reverts() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.warp(pot.getPot(id).releaseEligibleAt);
        vm.prank(m[0]);
        vm.expectRevert(IPot.WindowClosed.selector);
        pot.object(id);
    }

    function test_object_LastSecond_Works() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.warp(pot.getPot(id).releaseEligibleAt - 1);
        vm.prank(m[0]);
        pot.object(id);
        assertEq(pot.getPot(id).objectionsCount, 1);
    }

    function test_object_WrongState() public {
        uint256 id = _create();
        // Funding
        vm.prank(m[0]);
        vm.expectRevert(IPot.WrongState.selector);
        pot.object(id);
        // Locked
        _lock(id);
        vm.prank(m[0]);
        vm.expectRevert(IPot.WrongState.selector);
        pot.object(id);
    }

    function test_object_AfterFrozen_WrongState() public {
        uint256 id = _create();
        _lockAndRequest(id);
        _object(id, THRESHOLD);
        vm.prank(m[THRESHOLD]);
        vm.expectRevert(IPot.WrongState.selector);
        pot.object(id);
    }

    // ------------------------------------------------------ refund / frozen

    function test_19_RefundAfterBlockedPayout() public {
        uint256 id = _create();
        _lockAndRequest(id);
        _object(id, THRESHOLD);
        assertEq(uint8(_state(id)), uint8(IPot.State.Frozen));

        for (uint256 i; i < N; ++i) {
            uint256 before = m[i].balance;
            vm.expectEmit(true, true, false, true, address(pot));
            emit IPot.Refunded(id, m[i], SHARE);
            vm.prank(m[i]);
            pot.refund(id);
            assertEq(m[i].balance - before, 300 ether);
            assertTrue(pot.hasRefunded(id, m[i]));
        }
        assertEq(address(pot).balance, 0);
    }

    function test_19_ObjectorCanRefundInFrozen() public {
        uint256 id = _create();
        _lockAndRequest(id);
        _object(id, THRESHOLD);
        assertTrue(pot.hasObjected(id, m[0]));
        uint256 before = m[0].balance;
        vm.prank(m[0]);
        pot.refund(id);
        assertEq(m[0].balance - before, SHARE);
        assertTrue(pot.hasPaid(id, m[0]), "has_paid is never cleared");
        // Second refund blocked.
        vm.prank(m[0]);
        vm.expectRevert(IPot.AlreadyRefunded.selector);
        pot.refund(id);
    }

    // --------------------------------------------------------------- expire

    function test_22_Expire_AfterRequestWindow() public {
        uint256 id = _create();
        _lock(id);
        uint256 lockedAt = pot.getPot(id).lockedAt;

        vm.warp(lockedAt + REQ_WINDOW);
        vm.expectEmit(true, false, false, true, address(pot));
        emit IPot.Expired(id);
        vm.prank(stranger);
        pot.expire(id);

        assertEq(uint8(_state(id)), uint8(IPot.State.Frozen));

        for (uint256 i; i < N; ++i) {
            uint256 before = m[i].balance;
            vm.prank(m[i]);
            pot.refund(id);
            assertEq(m[i].balance - before, SHARE);
        }
        assertEq(address(pot).balance, 0);
    }

    function test_23_Expire_TooEarly() public {
        uint256 id = _create();
        _lock(id);
        vm.warp(pot.getPot(id).lockedAt + REQ_WINDOW - 1);
        vm.expectRevert(IPot.RequestWindowOpen.selector);
        pot.expire(id);
    }

    function test_23_Expire_WrongState_Funding() public {
        uint256 id = _create();
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(IPot.WrongState.selector);
        pot.expire(id);
    }

    function test_23_Expire_WrongState_PayoutRequested() public {
        uint256 id = _create();
        _lockAndRequest(id);
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(IPot.WrongState.selector);
        pot.expire(id);
    }

    function test_23_Expire_Twice_WrongState() public {
        uint256 id = _create();
        _lock(id);
        vm.warp(pot.getPot(id).lockedAt + REQ_WINDOW);
        pot.expire(id);
        vm.expectRevert(IPot.WrongState.selector);
        pot.expire(id);
    }
}
