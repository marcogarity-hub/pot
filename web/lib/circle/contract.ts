import { isAddress, zeroAddress, type Abi, type Chain, type Hex } from 'viem';

import { potAbi, arcTestnet, POT_ADDRESS } from '@/lib/pot';

// Production is ready without setup; tests may inject an alternate interface.
let contractInterface: { abi: Abi; chain: Chain } = { abi: potAbi, chain: arcTestnet };
export class PotConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'PotConfigurationError'; }
}
export function configurePotInterface(value: { abi: Abi; chain: Chain }) {
  if (value.chain.id !== 5042002) throw new Error('Expected Arc testnet');
  contractInterface = value;
}
export function potInterface() {
  return contractInterface;
}
export function validAddress(value: string): Hex {
  if (!isAddress(value) || value.toLowerCase() === zeroAddress) throw new Error('Invalid or zero address');
  return value.toLowerCase() as Hex;
}
export function potAddress() {
  if (!POT_ADDRESS) throw new PotConfigurationError('NEXT_PUBLIC_POT_ADDRESS is not configured.');
  try { return validAddress(POT_ADDRESS); }
  catch { throw new PotConfigurationError('NEXT_PUBLIC_POT_ADDRESS must be a valid nonzero address.'); }
}
