// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pot} from "src/Pot.sol";
import {IPot} from "src/IPot.sol";

/// @notice Shared fixture: one Pot, an organizer and eight funded members.
abstract contract Base is Test {
    uint256 internal constant N = 8;
    uint256 internal constant SHARE = 300 ether; // native USDC, 18 decimals
    uint256 internal constant TOTAL = 2400 ether; // SHARE * N
    uint256 internal constant WINDOW = 120; // objection window, seconds
    uint256 internal constant REQ_WINDOW = 120; // request window, seconds
    uint256 internal constant THRESHOLD = 5;
    bytes32 internal constant RECEIPT = keccak256("receipt");

    Pot internal pot;
    address internal org;
    address[] internal m;
    uint256 internal deadline;

    function setUp() public virtual {
        pot = new Pot();
        org = makeAddr("org");
        for (uint256 i; i < N; ++i) {
            address member = makeAddr(string.concat("m", vm.toString(i)));
            vm.deal(member, 1000 ether);
            m.push(member);
        }
        deadline = block.timestamp + 1 days;
    }

    /// @dev Organizer creates the default 8-member pot.
    function _create() internal returns (uint256 id) {
        vm.prank(org);
        id = pot.createPot(TOTAL, SHARE, m, deadline, THRESHOLD, WINDOW, REQ_WINDOW);
    }

    /// @dev Every member pays their share. The last payment locks the pot.
    function _payAll(uint256 id) internal {
        for (uint256 i; i < m.length; ++i) {
            vm.prank(m[i]);
            pot.pay{value: SHARE}(id);
        }
    }

    /// @dev Pays everyone in and checks the pot is Locked.
    function _lock(uint256 id) internal {
        _payAll(id);
        assertEq(uint8(pot.getPot(id).state), uint8(IPot.State.Locked), "not locked");
    }

    /// @dev Locks the pot and has the organizer request the payout with RECEIPT.
    function _lockAndRequest(uint256 id) internal {
        _lock(id);
        vm.prank(org);
        pot.requestRelease(id, RECEIPT);
    }
}
