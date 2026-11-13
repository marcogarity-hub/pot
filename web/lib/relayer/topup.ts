import { pathToFileURL } from 'node:url';
import { parseUnits } from 'viem';
import { validAddress } from '../circle/contract';
import { fundDemoPrincipal } from './index';
export async function topup(address: string, usdc: string) {
  if (!/^\d+(\.\d{1,18})?$/.test(usdc)) throw new Error('Use a positive USDC decimal amount');
  return fundDemoPrincipal(validAddress(address), parseUnits(usdc,18));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [address, amount] = process.argv.slice(2);
  if (!address || !amount) throw new Error('Usage: topup.ts <address> <usdc>');
  topup(address, amount).then(console.log).catch(() => { console.error('Top-up failed; inspect configuration and reconcile treasury before retrying.'); process.exitCode = 1; });
}
