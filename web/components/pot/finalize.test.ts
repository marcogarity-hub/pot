import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizePot } from './finalize';

function deferred() {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>(r => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllGlobals());

describe('finalizePot', () => {
  it('shares one in-flight request between the auto tick and the button', async () => {
    const d = deferred();
    const fetchMock = vi.fn().mockReturnValue(d.promise);
    vi.stubGlobal('fetch', fetchMock);

    const auto = finalizePot('11');
    const button = finalizePot('11');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    d.resolve(new Response(JSON.stringify({ transactionHash: '0xf1' }), { status: 200 }));
    const [a, b] = await Promise.all([auto, button]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ ok: true, data: { transactionHash: '0xf1' } });
  });

  it('posts again once the previous request has settled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await finalizePot('12');
    await finalizePot('12');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/pots/12/finalize', expect.objectContaining({ method: 'POST' }));
  });

  it('does not block a different pot', async () => {
    const d = deferred();
    const fetchMock = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const first = finalizePot('13');
    await finalizePot('14');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    d.resolve(new Response('{}', { status: 200 }));
    await first;
  });
});
