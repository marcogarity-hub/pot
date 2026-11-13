import { createHash } from 'node:crypto';
import { circleClient } from './client';
import { validAddress } from './contract';
export function walletIdempotencyKey(email: string) {
  const bytes = createHash('sha256').update(`pot:wallet:arc-testnet:${process.env.CIRCLE_WALLET_SET_ID}:${email.trim().toLowerCase()}`).digest().subarray(0,16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function createWallet(email: string) {
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  if (!walletSetId) throw new Error('CIRCLE_WALLET_SET_ID unavailable');
  const response = await circleClient().createWallets({ walletSetId, accountType: 'EOA', blockchains: ['ARC-TESTNET'], count: 1, idempotencyKey: walletIdempotencyKey(email) });
  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) throw new Error('Circle returned no wallet');
  return { walletId: wallet.id, address: validAddress(wallet.address) };
}
