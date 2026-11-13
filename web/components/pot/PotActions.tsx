'use client';

import { useRef, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { formatUnits } from 'viem';
import { arcTestnet } from '@/lib/pot/chain';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { postJson } from './api';
import type { Action } from './actions';

const ROUTES: Record<Action, string> = {
  pay: 'pay', refund: 'refund', object: 'object', requestRelease: 'request-release',
  swap: 'swap', finalize: 'finalize', expire: 'expire',
};

type Done = { action: Action; txHash?: string };

export function PotActions({ potId, actions, status, onSettled }: {
  potId: string; actions: Action[]; status: PotStatusRow; onSettled(): void;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [receipt, setReceipt] = useState('');
  const [leaver, setLeaver] = useState('');
  const [replacement, setReplacement] = useState('');
  const share = formatUnits(BigInt(status.share), 18);

  async function run(action: Action, body?: unknown) {
    // The ref blocks a double tap before React re-renders the disabled button.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(action);
    setError(null);
    const res = await postJson<{ transactionHash?: string }>(`/api/pots/${potId}/${ROUTES[action]}`, body);
    pendingRef.current = false;
    setPending(null);
    if (!res.ok) { setError(res.message); return; }
    setDone({ action, txHash: res.data.transactionHash });
    if (action === 'requestRelease') setReceipt('');
    if (action === 'swap') { setLeaver(''); setReplacement(''); }
    onSettled();
  }

  if (done && (done.action === 'pay' || done.action === 'refund')) {
    return <Confirmation done={done} amount={share} onDone={() => setDone(null)} />;
  }

  const busy = pending !== null;
  const label = (a: Action, idle: string, working: string) => (pending === a ? working : idle);
  const receiptTrimmed = receipt.trim();

  return (
    <div className="space-y-4">
      {actions.includes('pay') && (
        <Button size="lg" className="w-full" disabled={busy} onClick={() => run('pay')}>
          {label('pay', `Pay ${share} USDC`, 'Paying…')}
        </Button>
      )}

      {actions.includes('refund') && (
        <Button size="lg" variant="outline" className="w-full" disabled={busy} onClick={() => run('refund')}>
          {label('refund', `Get my ${share} USDC back`, 'Refunding…')}
        </Button>
      )}

      {actions.includes('requestRelease') && (
        <Card>
          <CardContent className="space-y-3">
            <Label htmlFor="receipt">Receipt or booking reference</Label>
            <Textarea id="receipt" maxLength={500} value={receipt} placeholder="Airbnb confirmation HMX123"
              onChange={e => setReceipt(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Members see this and have {formatWindow(status.objection_window_seconds)} to object before the money is released to you.
            </p>
            <Button className="w-full" disabled={busy || receiptTrimmed.length === 0 || receiptTrimmed.length > 500}
              onClick={() => run('requestRelease', { receiptText: receiptTrimmed })}>
              {label('requestRelease', 'Request payout', 'Requesting…')}
            </Button>
          </CardContent>
        </Card>
      )}

      {actions.includes('object') && (
        <Button size="lg" variant="destructive" className="w-full" disabled={busy} onClick={() => run('object')}>
          {label('object', 'Object to this payout', 'Objecting…')}
        </Button>
      )}

      {actions.includes('finalize') && (
        <Button size="lg" className="w-full" disabled={busy} onClick={() => run('finalize')}>
          {label('finalize', 'Finalize payout', 'Finalizing…')}
        </Button>
      )}

      {actions.includes('expire') && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">The organizer didn&apos;t request the payout in time. Expiring the pot opens refunds for everyone who paid.</p>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => run('expire')}>
            {label('expire', 'Expire pot and open refunds', 'Expiring…')}
          </Button>
        </div>
      )}

      {actions.includes('swap') && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Replace a member</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="leaver">Member leaving</Label>
              <Input id="leaver" type="email" value={leaver} onChange={e => setLeaver(e.target.value)} placeholder="leaving@example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="replacement">Replacement</Label>
              <Input id="replacement" type="email" value={replacement} onChange={e => setReplacement(e.target.value)} placeholder="new@example.com" />
            </div>
            <p className="text-xs text-muted-foreground">If the leaving member already paid, they get their share back.</p>
            <Button variant="outline" className="w-full" disabled={busy || !leaver.trim() || !replacement.trim()}
              onClick={() => run('swap', { leaverEmail: leaver.trim().toLowerCase(), replacementEmail: replacement.trim().toLowerCase() })}>
              {label('swap', 'Swap seat', 'Swapping…')}
            </Button>
          </div>
        </details>
      )}

      {done && done.action !== 'pay' && done.action !== 'refund' && (
        <p className="text-sm text-muted-foreground" role="status">Done. The page updates when the chain confirms.</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Confirmation({ done, amount, onDone }: { done: Done; amount: string; onDone(): void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <CircleCheck className="size-12 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{done.action === 'pay' ? 'You paid' : 'Refunded to your wallet'}</p>
        <p className="text-3xl font-semibold tabular-nums">{amount} USDC</p>
        {done.action === 'pay' && <p className="text-sm text-muted-foreground">Your share is locked in the pot until it releases or refunds.</p>}
        {done.txHash && (
          <a className="text-xs text-muted-foreground underline underline-offset-4"
            href={`${arcTestnet.blockExplorers.default.url}/tx/${done.txHash}`} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
        <Button className="mt-2 w-full" onClick={onDone}>Done</Button>
      </CardContent>
    </Card>
  );
}

export function formatWindow(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? '' : 's'}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
  return `${seconds} seconds`;
}
