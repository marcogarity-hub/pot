import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { formatDollars, formatDollarsFromUsdc } from './money';

const wei = (usdc: string) => parseUnits(usdc, 18);

describe('formatDollars', () => {
  it('drops cents on whole dollars and groups thousands', () => {
    expect(formatDollars(wei('210'))).toBe('$210');
    expect(formatDollars(wei('1260'))).toBe('$1,260');
    expect(formatDollars('840000000000000000000')).toBe('$840');
  });
  it('keeps two decimals otherwise, truncated', () => {
    expect(formatDollars(wei('12.5'))).toBe('$12.50');
    expect(formatDollars(wei('0.999'))).toBe('$0.99');
  });
  it('says so for sub-cent amounts and zero', () => {
    expect(formatDollars(BigInt('1000000000000000'))).toBe('<$0.01');
    expect(formatDollars(BigInt(0))).toBe('$0');
  });
});

describe('formatDollarsFromUsdc', () => {
  it('reads the decimal strings people type', () => {
    expect(formatDollarsFromUsdc('210')).toBe('$210');
    expect(formatDollarsFromUsdc('33.33')).toBe('$33.33');
  });
});
