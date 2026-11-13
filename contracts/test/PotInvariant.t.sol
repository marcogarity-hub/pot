// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";
import {Base} from "./Base.t.sol";
import {PotHandler} from "./handlers/PotHandler.sol";
import {IPot} from "src/IPot.sol";

/// @notice Test 13 and friends: money conservation across every pot the handler creates.
/// @dev Any revert the handler does not expect (it swallows only the R3 custom errors) fails
///      the run, so an unexpected error in Pot is caught here too.
///      Runs stay at 10000 (foundry.toml). Depth is 100 instead of the default 500 so a full
///      run takes ~5-6 min instead of ~30 (R4); every action still succeeds within a run.
/// forge-config: default.invariant.fail-on-revert = true
/// forge-config: default.invariant.depth = 100
contract PotInvariant is Base {
    PotHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new PotHandler(pot, org, m);

        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = PotHandler.create.selector;
        selectors[1] = PotHandler.pay.selector;
        selectors[2] = PotHandler.refund.selector;
        selectors[3] = PotHandler.swap.selector;
        selectors[4] = PotHandler.requestRelease.selector;
        selectors[5] = PotHandler.object.selector;
        selectors[6] = PotHandler.finalize.selector;
        selectors[7] = PotHandler.expire.selector;
        selectors[8] = PotHandler.warp.selector;
        targetSelector(StdInvariant.FuzzSelector({addr: address(handler), selectors: selectors}));
        // Required: without it Foundry also fuzzes the Pot itself (deployed in setUp) directly.
        targetContract(address(handler));
    }

    /// @notice Coverage readout (visible with -vv): how often each action succeeded.
    function afterInvariant() public view {
        string[9] memory names =
            ["create", "pay", "refund", "swap", "requestRelease", "object", "finalize", "expire", "warp"];
        for (uint256 i; i < names.length; ++i) {
            console.log(names[i], handler.calls(bytes32(bytes(names[i]))));
        }
    }

    /// @notice For every pot, money out never exceeds money in; once the pot is Released or
    ///         every payment has been returned, out equals in exactly.
    function invariant_13_PerPotConservation() public view {
        uint256 count = handler.potCount();
        for (uint256 i; i < count; ++i) {
            uint256 id = handler.potIdAt(i);
            uint256 inAmt = handler.inOf(id);
            uint256 outAmt = handler.outOf(id);
            assertLe(outAmt, inAmt, "pot paid out more than it took in");
            bool released = pot.getPot(id).state == IPot.State.Released;
            if (released || handler.openPayments(id) == 0) {
                assertEq(outAmt, inAmt, "settled pot did not return everything");
            }
        }
    }

    /// @notice The contract holds at least what every pot still owes. `>=` because native
    ///         USDC can arrive unsolicited (e.g. selfdestruct / coinbase).
    function invariant_Solvency() public view {
        assertGe(address(pot).balance, handler.outstanding(), "insolvent");
    }

    /// @notice A Released pot paid its organizer exactly its total.
    function invariant_ReleasedPaysExactlyTotal() public view {
        uint256 count = handler.potCount();
        for (uint256 i; i < count; ++i) {
            uint256 id = handler.potIdAt(i);
            IPot.PotView memory p = pot.getPot(id);
            if (p.state == IPot.State.Released) {
                assertEq(handler.payoutOf(id), p.total, "payout != total");
                assertEq(p.total, handler.totalOf(id), "total changed");
            }
        }
    }
}
