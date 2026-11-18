import { formatUnits, parseUnits } from 'viem';

const ZERO = BigInt(0);
/** 0.01 USDC in 18-decimal units. */
const ONE_CENT = BigInt('10000000000000000');

/**
 * Money the way people say it: "$210", "$1,260", "$12.50". Amounts are USDC in 18-decimal units (a bigint, or the
 * decimal string the database stores). 1 USDC shows as $1; the app says elsewhere that this is test money.
 * Whole dollars drop the cents; sub-cent amounts say so instead of rounding to zero.
 */
export function formatDollars(amount: bigint | string): string {
  const wei = typeof amount === 'bigint' ? amount : BigInt(amount);
  if (wei > ZERO && wei < ONE_CENT) return '<$0.01';
  const [whole, frac = ''] = formatUnits(wei, 18).split('.');
  const cents = (frac + '00').slice(0, 2);
  const dollars = BigInt(whole).toLocaleString('en-US');
  return cents === '00' ? `$${dollars}` : `$${dollars}.${cents}`;
}

/** Same, from a human USDC amount such as the create form's "210" or "12.5". */
export function formatDollarsFromUsdc(usdc: string): string {
  return formatDollars(parseUnits(usdc, 18));
}
