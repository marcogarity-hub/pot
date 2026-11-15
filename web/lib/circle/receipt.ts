import 'server-only';
import { createPublicClient, http, type Hex } from 'viem';
import { potInterface } from './contract';

export async function getPotReceipt(hash: Hex) {
  const { chain } = potInterface();
  const client = createPublicClient({ chain, transport: http() });
  try { return await client.getTransactionReceipt({ hash }); }
  catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'TransactionReceiptNotFoundError') return null;
    throw error;
  }
}
