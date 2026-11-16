// @vitest-environment node
import { describe, expect, it } from 'vitest';
import allEventsFixture from './__fixtures__/arc-logs.json';
import { decodePotLogs } from './decode';
import { abi, address } from './test-support';

const logs = allEventsFixture.data[0][0];
const twoLogs = logs.slice(0, 2);
const expected = decodePotLogs({ data: [twoLogs] }, abi, address);

describe('decodePotLogs payload shapes', () => {
  it('decodes a bare top-level array of logs to the same events as {data: [...]}', () => {
    expect(expected).toHaveLength(2);
    expect(decodePotLogs(twoLogs, abi, address)).toEqual(expected);
  });

  it('decodes {data: {data: [...]}, metadata} to the same events', () => {
    const wrapped = { data: { data: twoLogs }, metadata: { network: 'arc-testnet', chain_id: 5042002 } };
    expect(decodePotLogs(wrapped, abi, address)).toEqual(expected);
  });

  it('keeps the existing {data: [...]} and nested-array shapes working', () => {
    expect(decodePotLogs({ data: twoLogs }, abi, address)).toEqual(expected);
    expect(decodePotLogs({ data: [[[twoLogs[0]]], [[twoLogs[1]]]] }, abi, address)).toEqual(expected);
    expect(decodePotLogs(allEventsFixture, abi, address)).toHaveLength(22);
    expect(decodePotLogs(twoLogs.map(log => [log]), abi, address)).toEqual(expected);
  });

  it('accepts empty batches in every accepted shape', () => {
    expect(decodePotLogs({ data: [] }, abi, address)).toEqual([]);
    expect(decodePotLogs([], abi, address)).toEqual([]);
    expect(decodePotLogs({ data: { data: [] } }, abi, address)).toEqual([]);
  });

  it('skips logs from other addresses in bare and wrapped shapes', () => {
    const other = { ...twoLogs[0], address: '0x1111111111111111111111111111111111111111' };
    expect(decodePotLogs([other, twoLogs[0]], abi, address)).toEqual(expected.slice(0, 1));
    expect(decodePotLogs({ data: { data: [other] } }, abi, address)).toEqual([]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string body', ''],
    ['non-empty string', 'logs'],
    ['number', 42],
    ['boolean', true],
    ['empty object', {}],
    ['data as string', { data: 'logs' }],
    ['data as object without array', { data: { logs: twoLogs } }],
    ['nested data as string', { data: { data: 'logs' } }],
    ['nested data as null', { data: { data: null } }],
    ['bare log object', twoLogs[0]],
    ['array containing null', [null]],
    ['array containing a string', ['logs']],
    ['array containing an empty object', [{}]],
    ['array containing a log with bad encoding', [{ ...twoLogs[0], topics: [] }]],
  ])('throws for garbage payload: %s', (_name, payload) => {
    expect(() => decodePotLogs(payload, abi, address)).toThrow();
  });

  it('still rejects removed logs and invalid identities in bare arrays', () => {
    expect(() => decodePotLogs([{ ...twoLogs[0], removed: true }], abi, address)).toThrow('Removed logs require canonical backfill');
    expect(() => decodePotLogs([{ ...twoLogs[0], transactionHash: '0x12' }], abi, address)).toThrow('Invalid log identity');
  });
});
