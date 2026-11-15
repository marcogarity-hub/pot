import 'server-only';
import { circleClient } from './client';

export type CircleTransactionSnapshot = {
  walletId?: string;
  state?: string;
  txHash?: string;
};

export async function getCircleTransaction(id: string): Promise<CircleTransactionSnapshot | null> {
  const response = await circleClient().getTransaction({ id });
  const tx = response.data?.transaction;
  return tx ? { walletId: tx.walletId, state: tx.state, txHash: tx.txHash } : null;
}
