// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {IPot} from "src/IPot.sol";

interface IUSDCDecimals {
    function decimals() external view returns (uint8);
}

/// @notice Tasks 1.3: createPot and pay (tests 00, 01, 03, 08, 09, 10, 12, 20 plus validation).
contract PotFunding is Base {
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;

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

    // ------------------------------------------------------------- helpers

    function _createWith(
        uint256 total,
        uint256 share,
        address[] memory members,
        uint256 dl,
        uint256 threshold,
        uint256 objWindow,
        uint256 reqWindow
    ) internal returns (uint256) {
        vm.prank(org);
        return pot.createPot(total, share, members, dl, threshold, objWindow, reqWindow);
    }

    function _members(uint256 n) internal returns (address[] memory a) {
        a = new address[](n);
        for (uint256 i; i < n; ++i) {
            a[i] = makeAddr(string.concat("x", vm.toString(i)));
        }
    }

    // --------------------------------------------------------------- tests

    function test_00_Decimals() public {
        // Local half: native USDC, 18 decimals.
        uint256 id = _create();
        vm.prank(m[0]);
        pot.pay{value: 300 ether}(id);
        assertEq(pot.getPot(id).share, 300e18);
        assertEq(address(pot).balance, 300e18);

        // Fork half: ERC-20 interface of Arc USDC reports 6 decimals (native is 18). Skip if no RPC.
        try vm.createSelectFork("arc_testnet") {
            assertEq(IUSDCDecimals(ARC_USDC).decimals(), 6);
        } catch {
            emit log("test_00_Decimals: arc_testnet fork unavailable, fork half skipped");
        }
    }

    function test_01_AllPay_Locks() public {
        uint256 id = _create();
        _payAll(id);
        IPot.PotView memory p = pot.getPot(id);
        assertEq(uint8(p.state), uint8(IPot.State.Locked));
        assertEq(p.paymentsCount, 8);
        assertEq(p.lockedAt, block.timestamp);
    }

    function test_03_Pay300Records300() public {
        uint256 id = _create();
        vm.prank(m[0]);
        pot.pay{value: SHARE}(id);
        assertTrue(pot.hasPaid(id, m[0]));
        assertEq(pot.getPot(id).paymentsCount, 1);
        assertEq(address(pot).balance, 300 ether);
        assertEq(m[0].balance, 700 ether);
    }

    function test_08_PayTwice() public {
        uint256 id = _create();
        vm.startPrank(m[0]);
        pot.pay{value: SHARE}(id);
        vm.expectRevert(IPot.AlreadyPaid.selector);
        pot.pay{value: SHARE}(id);
        vm.stopPrank();
    }

    function test_09_WrongAmount() public {
        uint256 id = _create();
        vm.prank(m[0]);
        vm.expectRevert(IPot.WrongAmount.selector);
        pot.pay{value: 299 ether}(id);
    }

    function test_10_NonMember() public {
        uint256 id = _create();
        address stranger = makeAddr("stranger");
        vm.deal(stranger, 1000 ether);
        vm.prank(stranger);
        vm.expectRevert(IPot.NotMember.selector);
        pot.pay{value: SHARE}(id);
    }

    function test_12_PayAfterLock() public {
        uint256 id = _create();
        _payAll(id);
        vm.prank(m[0]);
        vm.expectRevert(IPot.WrongState.selector);
        pot.pay{value: SHARE}(id);
    }

    function test_pay_AtDeadline_Reverts() public {
        uint256 id = _create();
        vm.warp(deadline);
        vm.prank(m[0]);
        vm.expectRevert(IPot.DeadlinePassed.selector);
        pot.pay{value: SHARE}(id);
    }

    function test_pay_JustBefore_Ok() public {
        uint256 id = _create();
        vm.warp(deadline - 1);
        vm.prank(m[0]);
        pot.pay{value: SHARE}(id);
        assertTrue(pot.hasPaid(id, m[0]));
    }

    function test_20_LastPayment_EmitsPaidAndLocked() public {
        uint256 id = _create();
        for (uint256 i; i < 7; ++i) {
            vm.prank(m[i]);
            pot.pay{value: SHARE}(id);
        }
        vm.expectEmit(true, true, false, true, address(pot));
        emit Paid(id, m[7], SHARE);
        vm.expectEmit(true, false, false, true, address(pot));
        emit Locked(id, block.timestamp);
        vm.prank(m[7]);
        pot.pay{value: SHARE}(id);
    }

    function test_PotCreated_Emitted() public {
        assertEq(pot.nextPotId(), 0);
        vm.expectEmit(true, true, false, true, address(pot));
        emit PotCreated(0, org, m, TOTAL, SHARE, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
        uint256 id0 = _create();
        assertEq(id0, 0);
        assertEq(pot.nextPotId(), 1);

        vm.expectEmit(true, true, false, true, address(pot));
        emit PotCreated(1, org, m, TOTAL, SHARE, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
        uint256 id1 = _create();
        assertEq(id1, 1);
        assertEq(pot.nextPotId(), 2);

        IPot.PotView memory p = pot.getPot(id0);
        assertEq(p.organizer, org);
        assertEq(p.members.length, 8);
        assertEq(p.total, TOTAL);
        assertEq(p.threshold, THRESHOLD);
        assertEq(uint8(p.state), uint8(IPot.State.Funding));
        for (uint256 i; i < 8; ++i) {
            assertEq(p.members[i], m[i]);
            assertTrue(pot.isMember(id0, m[i]));
            assertTrue(pot.wasMember(id0, m[i]));
        }
    }

    // ------------------------------------------------- createPot validation

    function test_create_TotalMismatch_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL + 1, SHARE, m, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
    }

    function test_create_ShareZero_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(0, 0, m, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
    }

    function test_create_21Members_Reverts() public {
        address[] memory a = _members(21);
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(21 * SHARE, SHARE, a, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
    }

    function test_create_20Members_Ok() public {
        address[] memory a = _members(20);
        uint256 id = _createWith(20 * SHARE, SHARE, a, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
        assertEq(pot.getPot(id).members.length, 20);
    }

    function test_create_ZeroMembers_Reverts() public {
        address[] memory a = new address[](0);
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(0, SHARE, a, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
    }

    function test_create_Threshold0_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, deadline, 0, WINDOW, REQ_WINDOW);
    }

    function test_create_Threshold9_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, deadline, 9, WINDOW, REQ_WINDOW);
    }

    function test_create_DeadlineNow_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, block.timestamp, THRESHOLD, WINDOW, REQ_WINDOW);
    }

    function test_create_ObjWindow59_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, deadline, THRESHOLD, 59, REQ_WINDOW);
    }

    function test_create_ObjWindowTooLong_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, deadline, THRESHOLD, 7 days + 1, REQ_WINDOW);
    }

    function test_create_ReqWindow59_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, deadline, THRESHOLD, WINDOW, 59);
    }

    function test_create_ReqWindowTooLong_Reverts() public {
        vm.expectRevert(IPot.InvalidParams.selector);
        _createWith(TOTAL, SHARE, m, deadline, THRESHOLD, WINDOW, 30 days + 1);
    }

    function test_create_WindowBoundaries_Ok() public {
        _createWith(TOTAL, SHARE, m, deadline, THRESHOLD, 60, 60);
        _createWith(TOTAL, SHARE, m, deadline, THRESHOLD, 7 days, 30 days);
    }

    function test_create_ZeroAddressMember_Reverts() public {
        address[] memory a = _members(3);
        a[1] = address(0);
        vm.expectRevert(IPot.ZeroAddress.selector);
        _createWith(3 * SHARE, SHARE, a, deadline, 2, WINDOW, REQ_WINDOW);
    }

    function test_create_DuplicateMember_Reverts() public {
        address[] memory a = _members(3);
        a[2] = a[0];
        vm.expectRevert(IPot.DuplicateMember.selector);
        _createWith(3 * SHARE, SHARE, a, deadline, 2, WINDOW, REQ_WINDOW);
    }
}
