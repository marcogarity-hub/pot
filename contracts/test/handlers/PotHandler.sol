// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Pot} from "src/Pot.sol";
import {IPot} from "src/IPot.sol";

/// @notice Invariant handler for Pot. Drives every state-changing function with bounded
///         inputs and keeps per-pot money ghosts.
/// @dev    Every Pot call is wrapped in try/catch. Only the custom errors that a CORRECT Pot
///         may raise for that action (the R3 check orders) are swallowed; anything else
///         (NotImplemented, TransferFailed, panics, plain reverts) is re-raised with its
///         original data, so `fail-on-revert` turns it into a failed run.
///
///         Money ghosts are measured, not assumed: inOf += msg.value of a successful pay;
///         outOf += the recipient's balance increase across a successful refund / swap /
///         finalize. Forge's default gas price is 0, so balance deltas are exact.
contract PotHandler is CommonBase, StdCheats, StdUtils {
    uint256 public constant MAX_POTS = 3;
    uint256 internal constant MAX_POT_MEMBERS = 4; // of a 13-actor pool, so outsiders exist

    Pot public immutable pot;
    address public immutable org;

    /// @dev Pool = the fixture's m[0..7], the organizer (so it is sometimes also a member), plus
    ///      four outsiders/replacements.
    address[] internal actors;

    // ------------------------------------------------------------- ghosts

    uint256[] internal _ids;
    mapping(uint256 => uint256) public inOf; // native USDC paid in
    mapping(uint256 => uint256) public outOf; // refunds (incl. swap refunds) + payout
    mapping(uint256 => uint256) public payoutOf; // amount the organizer received on Released
    mapping(uint256 => uint256) public totalOf; // `total` passed to createPot
    mapping(uint256 => uint256) public shareOf;
    /// @dev Seats that paid and have not been refunded (by refund or swapSeat). Zero means
    ///      every payment into the pot has been returned ("fully refunded").
    mapping(uint256 => uint256) public openPayments;
    mapping(uint256 => mapping(address => bool)) internal _paidOpen;
    mapping(uint256 => address[]) internal _membersOf; // current members, for biased picks

    /// @dev Call counters, for eyeballing coverage (`forge test -vv` + a log in the test).
    mapping(bytes32 => uint256) public calls;

    // Test-only: the fixture never passes address(0).
    // forge-lint: disable-next-line(missing-zero-check)
    constructor(Pot pot_, address org_, address[] memory fixtureMembers) {
        pot = pot_;
        org = org_;
        for (uint256 i; i < fixtureMembers.length; ++i) {
            actors.push(fixtureMembers[i]);
        }
        actors.push(org_);
        actors.push(makeAddr("outsider0"));
        actors.push(makeAddr("outsider1"));
        actors.push(makeAddr("outsider2"));
        actors.push(makeAddr("outsider3"));
    }

    // ------------------------------------------------------------ actions

    /// @notice Organizer creates a pot with valid, bounded parameters. Never expected to revert.
    function create(
        uint256 nSeed,
        uint256 startSeed,
        uint256 shareSeed,
        uint256 deadlineSeed,
        uint256 thresholdSeed,
        uint256 objectionSeed,
        uint256 requestSeed
    ) external {
        if (_ids.length >= MAX_POTS) return;
        uint256 n = bound(nSeed, 1, MAX_POT_MEMBERS);
        uint256 start = startSeed % actors.length;
        address[] memory members = new address[](n);
        for (uint256 i; i < n; ++i) {
            members[i] = actors[(start + i) % actors.length]; // distinct: n <= pool size
        }
        uint256 share = bound(shareSeed, 1, 500 ether);
        uint256 total = share * n;
        // Narrower than the contract allows so that deadlines and windows actually elapse
        // within a depth-100 run (warps are 1s..6h); still inside the valid ranges.
        uint256 dl = block.timestamp + bound(deadlineSeed, 2 hours, 24 hours);
        uint256 threshold = bound(thresholdSeed, 1, n);
        uint256 objectionWindow = bound(objectionSeed, 60, 6 hours);
        uint256 requestWindow = bound(requestSeed, 60, 6 hours);

        vm.prank(org);
        try pot.createPot(total, share, members, dl, threshold, objectionWindow, requestWindow) returns (
            uint256 id
        ) {
            calls["create"]++;
            _ids.push(id);
            totalOf[id] = total;
            shareOf[id] = share;
            _membersOf[id] = members;
        } catch (bytes memory reason) {
            _reraise(reason);
        }
    }

    /// @notice Someone pays into a pot. Mostly a current member, mostly the exact share.
    function pay(uint256 potSeed, uint256 actorSeed, uint256 amountSeed) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPotIn(potSeed, IPot.State.Funding);
        address who = _pickUnpaidBiased(id, actorSeed);
        uint256 share = shareOf[id];
        uint256 amount = share;
        if (amountSeed % 16 == 0) amount = share + 1;
        else if (amountSeed % 16 == 1) amount = share - 1; // share >= 1
        vm.deal(who, who.balance + amount);

        vm.prank(who);
        try pot.pay{value: amount}(id) {
            calls["pay"]++;
            if (pot.getPot(id).state == IPot.State.Locked) calls["lock"]++;
            inOf[id] += amount;
            if (!_paidOpen[id][who]) {
                _paidOpen[id][who] = true;
                openPayments[id]++;
            }
        } catch (bytes memory reason) {
            bytes4[5] memory ok = [
                IPot.WrongState.selector,
                IPot.DeadlinePassed.selector,
                IPot.NotMember.selector,
                IPot.AlreadyPaid.selector,
                IPot.WrongAmount.selector
            ];
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice Someone asks for a refund.
    function refund(uint256 potSeed, uint256 actorSeed) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPot(potSeed);
        address who = _pickMemberBiased(id, actorSeed);
        uint256 before = who.balance;
        // A Frozen pot, or a Funding pot at/after its deadline, must refund every current member
        // with an open payment. If Pot says otherwise (NotRefundable, WrongState,
        // DeadlineNotPassed, ...) that is a bug: re-raise instead of swallowing.
        IPot.PotView memory pv = pot.getPot(id);
        bool refundable = pv.state == IPot.State.Frozen
            // forge-lint: disable-next-line(block-timestamp)
            || (pv.state == IPot.State.Funding && block.timestamp >= pv.deadline);
        bool mustSucceed = refundable && pot.isMember(id, who) && _paidOpen[id][who];

        vm.prank(who);
        try pot.refund(id) {
            calls["refund"]++;
            outOf[id] += who.balance - before;
            _closeSeat(id, who);
        } catch (bytes memory reason) {
            bytes4[4] memory ok = [
                IPot.WrongState.selector,
                IPot.DeadlineNotPassed.selector,
                IPot.NotRefundable.selector,
                IPot.AlreadyRefunded.selector
            ];
            if (mustSucceed) _reraise(reason);
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice Organizer (usually) swaps a leaver for a replacement.
    function swap(uint256 potSeed, uint256 callerSeed, uint256 leaverSeed, uint256 replacementSeed) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPot(potSeed);
        address caller = callerSeed % 8 == 0 ? _pickActor(callerSeed >> 8) : org;
        address leaver = _pickMemberBiased(id, leaverSeed);
        address replacement = replacementSeed % 16 == 0 ? address(0) : _pickActor(replacementSeed >> 8);
        uint256 before = leaver.balance;

        vm.prank(caller);
        try pot.swapSeat(id, leaver, replacement) {
            calls["swap"]++;
            outOf[id] += leaver.balance - before;
            _closeSeat(id, leaver);
            address[] storage cur = _membersOf[id];
            for (uint256 i; i < cur.length; ++i) {
                if (cur[i] == leaver) {
                    cur[i] = replacement;
                    break;
                }
            }
        } catch (bytes memory reason) {
            bytes4[7] memory ok = [
                IPot.NotOrganizer.selector,
                IPot.WrongState.selector,
                IPot.DeadlinePassed.selector,
                IPot.NotMember.selector,
                IPot.ZeroAddress.selector,
                IPot.DuplicateMember.selector,
                IPot.FormerMember.selector
            ];
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice Organizer (usually) requests the payout.
    function requestRelease(uint256 potSeed, uint256 callerSeed, bytes32 receipt) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPotIn(potSeed, IPot.State.Locked);
        address caller = callerSeed % 8 == 0 ? _pickActor(callerSeed >> 8) : org;
        if (receipt == bytes32(0)) receipt = keccak256("receipt");

        vm.prank(caller);
        try pot.requestRelease(id, receipt) {
            calls["requestRelease"]++;
        } catch (bytes memory reason) {
            bytes4[2] memory ok = [IPot.NotOrganizer.selector, IPot.WrongState.selector];
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice A member (usually) objects to the payout.
    function object(uint256 potSeed, uint256 actorSeed) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPotIn(potSeed, IPot.State.PayoutRequested);
        address who = _pickMemberBiased(id, actorSeed);

        vm.prank(who);
        try pot.object(id) {
            calls["object"]++;
            if (pot.getPot(id).state == IPot.State.Frozen) calls["frozen"]++;
        } catch (bytes memory reason) {
            bytes4[4] memory ok = [
                IPot.WrongState.selector,
                IPot.WindowClosed.selector,
                IPot.NotMember.selector,
                IPot.AlreadyObjected.selector
            ];
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice Anyone finalizes the payout; the organizer receives it.
    function finalize(uint256 potSeed, uint256 callerSeed) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPotIn(potSeed, IPot.State.PayoutRequested);
        address caller = _pickActor(callerSeed);
        uint256 before = org.balance;
        // An eligible finalize (PayoutRequested and the window elapsed) must succeed.
        IPot.PotView memory pv = pot.getPot(id);
        // forge-lint: disable-next-line(block-timestamp)
        bool mustSucceed = pv.state == IPot.State.PayoutRequested && block.timestamp >= pv.releaseEligibleAt;

        vm.prank(caller);
        try pot.finalizeRelease(id) {
            calls["finalize"]++;
            uint256 paid = org.balance - before;
            payoutOf[id] += paid;
            outOf[id] += paid;
        } catch (bytes memory reason) {
            bytes4[2] memory ok = [IPot.WrongState.selector, IPot.WindowOpen.selector];
            if (mustSucceed) _reraise(reason);
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice Anyone expires a pot whose organizer never requested the payout.
    function expire(uint256 potSeed, uint256 callerSeed) external {
        if (_ids.length == 0) return;
        uint256 id = _pickPotIn(potSeed, IPot.State.Locked);
        address caller = _pickActor(callerSeed);
        // A Locked pot whose request window has elapsed must be expirable by anyone. If Pot
        // reverts here that is a bug: re-raise instead of swallowing.
        IPot.PotView memory pv = pot.getPot(id);
        bool mustSucceed = pv.state == IPot.State.Locked
            // forge-lint: disable-next-line(block-timestamp)
            && block.timestamp >= pv.lockedAt + pv.requestWindow;

        vm.prank(caller);
        try pot.expire(id) {
            calls["expire"]++;
            calls["frozen"]++;
        } catch (bytes memory reason) {
            bytes4[2] memory ok = [IPot.WrongState.selector, IPot.RequestWindowOpen.selector];
            if (mustSucceed) _reraise(reason);
            _swallowOr(reason, _list(ok));
        }
    }

    /// @notice Time passes.
    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + bound(secondsSeed, 1, 6 hours));
        calls["warp"]++;
    }

    // -------------------------------------------------------------- views

    function potCount() external view returns (uint256) {
        return _ids.length;
    }

    function potIdAt(uint256 i) external view returns (uint256) {
        return _ids[i];
    }

    /// @notice Sum over every pot of (inOf - outOf): what the contract must still hold.
    function outstanding() external view returns (uint256 sum) {
        for (uint256 i; i < _ids.length; ++i) {
            uint256 id = _ids[i];
            sum += inOf[id] - outOf[id];
        }
    }

    // ------------------------------------------------------------ helpers

    function _pickPot(uint256 seed) internal view returns (uint256) {
        return _ids[seed % _ids.length];
    }

    /// @dev 3 in 4: a pot currently in `want` (scanning from the seeded index); otherwise,
    ///      or if none is in that state, any pot. Keeps the money paths reachable.
    function _pickPotIn(uint256 seed, IPot.State want) internal view returns (uint256) {
        uint256 n = _ids.length;
        if (seed % 4 != 0) {
            uint256 start = (seed >> 8) % n;
            for (uint256 i; i < n; ++i) {
                uint256 id = _ids[(start + i) % n];
                if (pot.getPot(id).state == want) return id;
            }
        }
        return _ids[(seed >> 8) % n];
    }

    /// @dev 3 in 4: a current member of the pot that has not paid yet; otherwise as
    ///      _pickMemberBiased.
    function _pickUnpaidBiased(uint256 id, uint256 seed) internal view returns (address) {
        address[] storage cur = _membersOf[id];
        if (seed % 4 != 0) {
            uint256 start = (seed >> 8) % cur.length;
            for (uint256 i; i < cur.length; ++i) {
                address a = cur[(start + i) % cur.length];
                if (!pot.hasPaid(id, a)) return a;
            }
        }
        return _pickMemberBiased(id, seed);
    }

    function _pickActor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    /// @dev 3 in 4: a current member of the pot. Otherwise anyone in the pool (outsider,
    ///      former member, or a member of another pot).
    function _pickMemberBiased(uint256 id, uint256 seed) internal view returns (address) {
        address[] storage cur = _membersOf[id];
        if (seed % 4 != 0 && cur.length > 0) return cur[(seed >> 8) % cur.length];
        return _pickActor(seed >> 8);
    }

    function _closeSeat(uint256 id, address who) internal {
        if (_paidOpen[id][who]) {
            _paidOpen[id][who] = false;
            openPayments[id]--;
        }
    }

    function _list(bytes4[2] memory a) internal pure returns (bytes4[] memory out) {
        out = new bytes4[](2);
        for (uint256 i; i < 2; ++i) out[i] = a[i];
    }

    function _list(bytes4[4] memory a) internal pure returns (bytes4[] memory out) {
        out = new bytes4[](4);
        for (uint256 i; i < 4; ++i) out[i] = a[i];
    }

    function _list(bytes4[5] memory a) internal pure returns (bytes4[] memory out) {
        out = new bytes4[](5);
        for (uint256 i; i < 5; ++i) out[i] = a[i];
    }

    function _list(bytes4[7] memory a) internal pure returns (bytes4[] memory out) {
        out = new bytes4[](7);
        for (uint256 i; i < 7; ++i) out[i] = a[i];
    }

    /// @dev Swallow `reason` if it is exactly one of the `ok` custom errors (4-byte, no
    ///      args); otherwise re-raise it unchanged.
    function _swallowOr(bytes memory reason, bytes4[] memory ok) internal pure {
        if (reason.length == 4) {
            // Safe: length is exactly 4, so nothing is truncated.
            // forge-lint: disable-next-line(unsafe-typecast)
            bytes4 sel = bytes4(reason);
            for (uint256 i; i < ok.length; ++i) {
                if (sel == ok[i]) return;
            }
        }
        _reraise(reason);
    }

    function _reraise(bytes memory reason) internal pure {
        assembly ("memory-safe") {
            revert(add(reason, 32), mload(reason))
        }
    }
}
