// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {IPot} from "src/IPot.sol";

/// @notice Task 1.4: refund and swapSeat (tests 04-07b plus refund edge cases).
contract PotRefundSwap is Base {
    event Refunded(uint256 indexed potId, address indexed member, uint256 amount);
    event SeatSwapped(uint256 indexed potId, address indexed leaver, address indexed replacement, uint256 refunded);

    address internal repl;

    function setUp() public override {
        super.setUp();
        repl = makeAddr("replacement");
        vm.deal(repl, 1000 ether);
    }

    function _pay(uint256 id, address who) internal {
        vm.prank(who);
        pot.pay{value: SHARE}(id);
    }

    // -------------------------------------------------------------- refund

    function test_04_RefundAfterDeadline_NotFull() public {
        uint256 id = _create();
        for (uint256 i; i < 3; ++i) _pay(id, m[i]);
        vm.warp(deadline);
        uint256 before = m[0].balance;
        vm.expectEmit(true, true, false, true, address(pot));
        emit Refunded(id, m[0], SHARE);
        vm.prank(m[0]);
        pot.refund(id);
        assertEq(m[0].balance, before + 300e18);
        assertTrue(pot.hasRefunded(id, m[0]));
        assertTrue(pot.hasPaid(id, m[0]));
        assertEq(pot.getPot(id).paymentsCount, 3);
        assertEq(address(pot).balance, 600 ether);
    }

    function test_05_NoRefundBeforeDeadline() public {
        uint256 id = _create();
        _pay(id, m[0]);
        vm.warp(deadline - 1);
        vm.prank(m[0]);
        vm.expectRevert(IPot.DeadlineNotPassed.selector);
        pot.refund(id);
    }

    function test_06_NoDoubleRefund() public {
        uint256 id = _create();
        _pay(id, m[0]);
        vm.warp(deadline);
        vm.prank(m[0]);
        pot.refund(id);
        vm.prank(m[0]);
        vm.expectRevert(IPot.AlreadyRefunded.selector);
        pot.refund(id);
    }

    function test_refund_NonPayer() public {
        uint256 id = _create();
        _pay(id, m[0]);
        vm.warp(deadline);
        vm.prank(m[1]); // member, never paid
        vm.expectRevert(IPot.NotRefundable.selector);
        pot.refund(id);
        vm.prank(repl); // not a member
        vm.expectRevert(IPot.NotRefundable.selector);
        pot.refund(id);
    }

    function test_refund_Locked() public {
        uint256 id = _create();
        _lock(id);
        vm.warp(deadline + 1);
        vm.prank(m[0]);
        vm.expectRevert(IPot.WrongState.selector);
        pot.refund(id);
    }

    // ------------------------------------------------------------ swapSeat

    function test_07_SeatSwap() public {
        uint256 id = _create();
        _pay(id, m[0]);
        uint256 countBefore = pot.getPot(id).paymentsCount;
        uint256 before = m[0].balance;

        vm.expectEmit(true, true, true, true, address(pot));
        emit SeatSwapped(id, m[0], repl, SHARE);
        vm.prank(org);
        pot.swapSeat(id, m[0], repl);

        assertEq(m[0].balance, before + 300e18);
        assertFalse(pot.isMember(id, m[0]));
        assertTrue(pot.wasMember(id, m[0]));
        assertTrue(pot.hasRefunded(id, m[0]));
        assertTrue(pot.hasPaid(id, m[0])); // has_paid is never cleared
        assertTrue(pot.isMember(id, repl));
        assertTrue(pot.wasMember(id, repl));
        IPot.PotView memory p = pot.getPot(id);
        assertEq(p.paymentsCount, countBefore - 1);
        assertEq(p.members[0], repl); // takes m[0]'s index
        assertEq(p.members[1], m[1]);
        assertEq(p.members.length, N);

        _pay(id, repl);
        for (uint256 i = 1; i < N; ++i) _pay(id, m[i]);
        assertEq(uint8(pot.getPot(id).state), uint8(IPot.State.Locked));
        assertEq(address(pot).balance, TOTAL);
    }

    function test_07_SeatSwap_UnpaidLeaver() public {
        uint256 id = _create();
        _pay(id, m[1]);
        uint256 before = m[0].balance;
        vm.expectEmit(true, true, true, true, address(pot));
        emit SeatSwapped(id, m[0], repl, 0);
        vm.prank(org);
        pot.swapSeat(id, m[0], repl);
        assertEq(m[0].balance, before);
        assertEq(pot.getPot(id).paymentsCount, 1);
        assertFalse(pot.hasRefunded(id, m[0]));
        assertFalse(pot.isMember(id, m[0]));
        assertTrue(pot.wasMember(id, m[0]));
        assertEq(pot.getPot(id).members[0], repl);
    }

    function test_07_FormerMemberCantRejoin() public {
        uint256 id = _create();
        vm.startPrank(org);
        pot.swapSeat(id, m[0], repl);
        vm.expectRevert(IPot.FormerMember.selector);
        pot.swapSeat(id, m[1], m[0]);
        vm.stopPrank();
    }

    function test_07b_SeatSwap_Reverts_NotOrganizer() public {
        uint256 id = _create();
        vm.prank(m[0]);
        vm.expectRevert(IPot.NotOrganizer.selector);
        pot.swapSeat(id, m[0], repl);
    }

    function test_07b_SeatSwap_Reverts_AfterLock() public {
        uint256 id = _create();
        _lock(id);
        vm.prank(org);
        vm.expectRevert(IPot.WrongState.selector);
        pot.swapSeat(id, m[0], repl);
    }

    function test_07b_SeatSwap_Reverts_AtDeadline() public {
        uint256 id = _create();
        vm.warp(deadline);
        vm.prank(org);
        vm.expectRevert(IPot.DeadlinePassed.selector);
        pot.swapSeat(id, m[0], repl);
    }

    function test_07b_SeatSwap_Reverts_ZeroReplacement() public {
        uint256 id = _create();
        vm.prank(org);
        vm.expectRevert(IPot.ZeroAddress.selector);
        pot.swapSeat(id, m[0], address(0));
    }

    function test_07b_SeatSwap_Reverts_ReplacementIsMember() public {
        uint256 id = _create();
        vm.prank(org);
        vm.expectRevert(IPot.DuplicateMember.selector);
        pot.swapSeat(id, m[0], m[1]);
    }

    function test_07b_SeatSwap_Reverts_LeaverNotMember() public {
        uint256 id = _create();
        vm.prank(org);
        vm.expectRevert(IPot.NotMember.selector);
        pot.swapSeat(id, repl, makeAddr("other"));
    }

    function test_SwappedOutPayer_CantRefund() public {
        uint256 id = _create();
        _pay(id, m[0]);
        vm.prank(org);
        pot.swapSeat(id, m[0], repl);
        vm.warp(deadline);
        vm.prank(m[0]);
        vm.expectRevert(IPot.NotRefundable.selector);
        pot.refund(id);
    }
}
