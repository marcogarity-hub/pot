import { defineChain } from "viem";
import type { potAbi } from "./abi";

/** Arc testnet. Native gas token is USDC with 18 decimals (the ERC-20 view at
 *  0x3600…0000 reports 6). Verified against docs.arc.io and viem's arcTestnet. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

/**
 * Deployed Pot address. Undefined at runtime until NEXT_PUBLIC_POT_ADDRESS is set (Task 1.6
 * deploys). The cast only satisfies the type; callers must check it before use.
 */
export const POT_ADDRESS = process.env.NEXT_PUBLIC_POT_ADDRESS as `0x${string}`;

/** Block the Pot was deployed in; the earliest block worth scanning for logs. */
export const POT_DEPLOY_BLOCK: bigint = BigInt(process.env.POT_DEPLOY_BLOCK ?? "0");

/** Mirrors IPot.State (uint8 on the wire). */
export enum PotState {
  Funding = 0,
  Locked = 1,
  PayoutRequested = 2,
  Released = 3,
  Frozen = 4,
}

/** Every event Pot emits, derived from the generated ABI:
 *  PotCreated | Paid | Locked | SeatSwapped | Refunded | PayoutRequested |
 *  Objected | Released | Expired | Frozen. */
export type PotEventName = Extract<(typeof potAbi)[number], { type: "event" }>["name"];
