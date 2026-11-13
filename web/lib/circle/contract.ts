import { isAddress, zeroAddress, type Abi, type Chain, type Hex } from 'viem';

// Lane 1 supplies the generated ABI and verified chain after Task 1.2 lands.
// No production code imports the temporary test fixture.
let contractInterface: { abi: Abi; chain: Chain } | undefined;
export function configurePotInterface(value: { abi: Abi; chain: Chain }) {
  if (value.chain.id !== 5042002) throw new Error('Expected Arc testnet');
  contractInterface = value;
}
export function potInterface() {
  if (!contractInterface) throw new Error('Pot interface unavailable: configure Lane 1 ABI and Arc chain');
  return contractInterface;
}
export function validAddress(value: string): Hex {
  if (!isAddress(value) || value.toLowerCase() === zeroAddress) throw new Error('Invalid or zero address');
  return value.toLowerCase() as Hex;
}
export function potAddress() { return validAddress(process.env.NEXT_PUBLIC_POT_ADDRESS ?? ''); }
