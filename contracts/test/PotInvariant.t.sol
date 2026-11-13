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
///      run takes ~5 min instead of ~30 (R4). The handler is tuned (3 pots of 1-4 members,
///      deadlines 2-24h, windows 1min-6h, warps 1s-6h, pay weighted 3x, actions biased toward
///      pots in the matching state) so the money paths are reached. Measured over 200 runs
///      (share of runs with at least one success): pay 99%, lock 89%, requestRelease 77%,
///      object 59%, Frozen 66%, finalize/Released 36%, expire 38%, refund 55%, swap 59%.
/// forge-config: default.invariant.fail-on-revert = true
/// forge-config: default.invariant.depth = 100
contract PotInvariant is Base {
    PotHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new PotHandler(pot, org, m);

        // Weighted by repetition: pay is listed 3x so pots reach Locked within a run.
        bytes4[] memory selectors = new bytes4[](12);
        selectors[0] = PotHandler.create.selector;
        selectors[1] = PotHandler.pay.selector;
        selectors[2] = PotHandler.pay.selector;
        selectors[3] = PotHandler.pay.selector;
        selectors[4] = PotHandler.refund.selector;
        selectors[5] = PotHandler.swap.selector;
        selectors[6] = PotHandler.requestRelease.selector;
        selectors[7] = PotHandler.object.selector;
        selectors[8] = PotHandler.finalize.selector;
        selectors[9] = PotHandler.expire.selector;
        selectors[10] = PotHandler.warp.selector;
        selectors[11] = PotHandler.object.selector;
        targetSelector(StdInvariant.FuzzSelector({addr: address(handler), selectors: selectors}));
        // Required: without it Foundry also fuzzes the Pot itself (deployed in setUp) directly.
        targetContract(address(handler));
    }

    /// @notice Coverage readout (visible with -vv): how often each action succeeded.
    function afterInvariant() public view {
        string[11] memory names = [
            "create", "pay", "lock", "requestRelease", "object", "finalize", "expire", "refund", "frozen", "swap", "warp"
        ];
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
