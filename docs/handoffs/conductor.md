# Handoffs: conductor

## 2026-11-13 — Spikes (Tasks 1.1 and 2.1 / A14 gate), run by the conductor

**Spike 1 (Task 1.1): `PAYMENT_PATH=native`.**
- Throwaway `Receiver` (payable `pay()`) deployed by the deployer to `0x69a38e0645E45dE5893af0FC87E3b6f8b9250451` (tx `0x3392a2bbffdee61066f398dae514a831a7d4849591f44ecbcfd2be12db1ce5c8`). Source kept outside the repo.
- `arc-cast send pay() --value 1ether` → status 1, tx `0x789faf00a7af3ab39e329dd2e2616b37d9a3bf7023e9127a93a13e2ed4edf568`; receiver native balance `1000000000000000000` (18 decimals).
- USDC ERC-20 interface `0x3600000000000000000000000000000000000000` (Arc docs): `decimals() = 6`; `balanceOf(receiver) = 1000000`.
- Arc emits an ERC-20 `Transfer` log from system address `0xfffffffffffffffffffffffffffffffffffffffe` on native value transfers. The Pot Stream filters on the Pot address, so it's unaffected.
- Gas: `gas-price` 25 gwei, base fee 20 gwei; effective price paid 27.5 gwei.

**Spike 2 (Task 2.1, A14 gate): `WALLET_PATH=circle`, `ACCOUNT_TYPE=EOA`. A14 gate passed; no switch to SCA.**
- Circle created an `EOA` wallet on `ARC-TESTNET` (`0xdd28c47f5271daaff91638f09ded30a147c6fcb4`, LIVE), and also the treasury (`0x9f7402e58eb01dcaa221e0bdb413984595830c07`).
- Treasury → spike wallet native transfer of 0.5 USDC via `createTransaction({ tokenAddress: "", blockchain: "ARC-TESTNET", amount: ["0.5"] })`: states `INITIATED → SENT → COMPLETE`; balance `500000000000000000`.
- Payable contract call via `createContractExecutionTransaction({ abiFunctionSignature: "pay()", amount: "0.01" })`: states `INITIATED → SENT → COMPLETE`; receiver delta exactly `10000000000000000`; receipt `success`; effective gas price 36.1 gwei with `feeLevel: MEDIUM` (above the 20 gwei floor).
- **Never saw `CONFIRMED`:** Arc goes straight to `COMPLETE`. Waiters must treat `COMPLETE` as terminal success.
- **Reverts fail at Circle's estimation step:** state `FAILED`, `errorReason: ESTIMATION_ERROR`, `errorDetails: "execution reverted"`, no txHash and **no revert data**. So custom-error decoding (`PotRevertError`) can't rely on Circle; the server must simulate the call first (viem `simulateContract`/`eth_call` from the wallet's address) to get the custom error, then submit through Circle.

**For Lane 2:** (1) confirm `callPot`/prefund waiters treat `COMPLETE` as success and `FAILED`/`CANCELLED`/`DENIED` as failure; (2) add a pre-flight `simulateContract` from the caller's address so contract errors map to `PotRevertError` codes; (3) native transfers use `tokenAddress: ""` + `blockchain: "ARC-TESTNET"`.

## 2026-11-13 — Task 1.6: Pot deployed and verified (conductor)
- **Pot:** `0xf842F699128A2e575d20BcC92F0472C7ad59e5C8` on Arc testnet (5042002), deploy tx `0x7e2eeff353da1b43eed74297f5d5a1472d5434c55a94cdc8e9cce19457c15f63`, **block 72173814**. Deployed from main at 724e47c (`arc-forge create src/Pot.sol:Pot`) by the local deployer `0xe38E…862A`.
- **Verified:** `arc-forge verify-contract … --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/` → "Pass - Verified". Explorer: https://explorer.testnet.arc.io/address/0xf842F699128A2e575d20BcC92F0472C7ad59e5C8
- **web/.env.local:** `NEXT_PUBLIC_POT_ADDRESS` and `POT_DEPLOY_BLOCK` set. **Marco must add both to Vercel.**
- **Live smoke test (pot 0, 1 member, 0.01 USDC, 60 s windows):** createPot ✓ → pay ✓ (pot balance 1e16) → Locked → requestRelease ✓ (state 2) → finalize 17 s early correctly refused (WindowOpen).
- **Revert data:** `eth_call` of `pay` on the locked pot returned `0xde4168ba` = `WrongState()`. Arc's RPC returns custom-error data, so Lane 2's pre-flight simulation works.
- **Smoke test complete:** finalizeRelease at releaseEligibleAt succeeded → state 3 (Released), pot balance 0, payout to organizer. Full happy path verified on the live contract.
