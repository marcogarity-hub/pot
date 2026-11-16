'use client';

import { useEffect, useRef, useState } from 'react';
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
import { finalizePot } from './finalize';

const ROUTES: Record<Action, string> = {
  pay: 'pay', refund: 'refund', object: 'object', requestRelease: 'request-release',
  swap: 'swap', finalize: 'finalize', expire: 'expire',
};

const BIG = 'h-12 w-full rounded-xl text-base';

type Done = { action: Action; txHash?: string; at: Date };

export function PotActions({ potId, actions, status, onSettled, onAuthLost }: {
  potId: string; actions: Action[]; status: PotStatusRow; onSettled(): void;
  /** Called on a 401: the session is gone, so the page should re-check who is signed in. */
  onAuthLost?(): void;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [receipt, setReceipt] = useState('');
  // Set when request-release confirmed on-chain but its metadata save failed. The request form is hidden
  // so the organizer can't submit the same receipt again; this holds the server's recovery text.
  const [releaseStuck, setReleaseStuck] = useState<string | null>(null);
  const [leaver, setLeaver] = useState('');
  const [replacement, setReplacement] = useState('');
  const share = formatUnits(BigInt(status.share), 18);

  async function run(action: Action, body?: unknown) {
    // The ref blocks a double tap before React re-renders the disabled button.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(action);
    setError(null);
    // Finalize shares its in-flight request with the status page's auto tick.
    const res = action === 'finalize'
      ? await finalizePot(potId)
      : await postJson<{ transactionHash?: string }>(`/api/pots/${potId}/${ROUTES[action]}`, body);
    pendingRef.current = false;
    setPending(null);
    if (!res.ok) {
      if (res.status === 401) onAuthLost?.();
      if (action === 'requestRelease' && res.status === 503) {
        setReceipt('');
        setReleaseStuck(res.message);
      } else {
        setError(res.message);
      }
      onSettled();
      return;
    }
    setDone({ action, txHash: res.data.transactionHash, at: new Date() });
    if (action === 'requestRelease') setReceipt('');
    if (action === 'swap') { setLeaver(''); setReplacement(''); }
    onSettled();
  }

  if (done) {
    return <Confirmation done={done} title={status.title ?? `Pot #${status.pot_id}`} amount={share} onDone={() => setDone(null)} />;
  }

  const busy = pending !== null;
  const label = (a: Action, idle: string, working: string) => (pending === a ? working : idle);
  const receiptTrimmed = receipt.trim();

  return (
    <div className="space-y-4">
      {actions.includes('pay') && (
        <Button size="lg" className={BIG} disabled={busy} onClick={() => run('pay')}>
          {label('pay', `Pay ${share} USDC`, 'Paying…')}
        </Button>
      )}

      {actions.includes('refund') && (
        <Button size="lg" variant="outline" className={BIG} disabled={busy} onClick={() => run('refund')}>
          {label('refund', `Get my ${share} USDC back`, 'Refunding…')}
        </Button>
      )}

      {actions.includes('requestRelease') && !releaseStuck && (
        <Card>
          <CardContent className="space-y-3">
            <Label htmlFor="receipt">Receipt or booking reference</Label>
            <Textarea id="receipt" maxLength={500} value={receipt} placeholder="Airbnb confirmation HMX123"
              onChange={e => setReceipt(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Members see this and have {formatWindow(status.objection_window_seconds)} to object before the money is released to you.
            </p>
            <Button className={BIG} disabled={busy || receiptTrimmed.length === 0 || receiptTrimmed.length > 500}
              onClick={() => run('requestRelease', { receiptText: receiptTrimmed })}>
              {label('requestRelease', 'Request payout', 'Requesting…')}
            </Button>
          </CardContent>
        </Card>
      )}

      {actions.includes('object') && (
        <Button size="lg" variant="destructive" className={BIG} disabled={busy} onClick={() => run('object')}>
          {label('object', 'Object to this payout', 'Objecting…')}
        </Button>
      )}

      {actions.includes('finalize') && (
        <Button size="lg" className={BIG} disabled={busy} onClick={() => run('finalize')}>
          {label('finalize', 'Finalize payout', 'Finalizing…')}
        </Button>
      )}

      {actions.includes('expire') && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">The request window has ended. Expiring the pot opens refunds for everyone who paid. Until someone expires it, the organizer can still request the payout.</p>
          <Button variant="outline" className={BIG} disabled={busy} onClick={() => run('expire')}>
            {label('expire', 'Expire pot and open refunds', 'Expiring…')}
          </Button>
        </div>
      )}

      {actions.includes('swap') && (
        <details className="rounded-2xl border bg-card p-4 text-sm">
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
            <Button variant="outline" className={BIG} disabled={busy || !leaver.trim() || !replacement.trim()}
              onClick={() => run('swap', { leaverEmail: leaver.trim().toLowerCase(), replacementEmail: replacement.trim().toLowerCase() })}>
              {label('swap', 'Swap seat', 'Swapping…')}
            </Button>
          </div>
        </details>
      )}

      {releaseStuck && <p role="status" className="text-sm font-medium">{releaseStuck}</p>}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const HEADING: Record<Action, string> = {
  pay: 'You paid',
  refund: 'Refunded to your wallet',
  requestRelease: 'Payout requested',
  object: 'Objection recorded',
  finalize: 'Payout finalized',
  expire: 'Refunds are open',
  swap: 'Seat swapped',
};

/**
 * Receipt for a settled action. Amount and pot name come from the pot; the time is when this page
 * received the result; the code is the transaction hash, and it is omitted if the server sent none.
 */
function Confirmation({ done, title, amount, onDone }: { done: Done; title: string; amount: string; onDone(): void }) {
  const hasAmount = done.action === 'pay' || done.action === 'refund';
  const explorer = `${arcTestnet.blockExplorers.default.url}/tx/${done.txHash}`;
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cardRef.current?.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);
  return (
    <Card ref={cardRef}>
      <CardContent className="flex flex-col items-center gap-5 px-5 py-8 text-center">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-9" />
        </span>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground" role="status">{HEADING[done.action]}</p>
          {hasAmount && <p className="money font-heading text-5xl font-semibold tracking-tight">{`${amount} USDC`}</p>}
          <p className="text-sm">
            {hasAmount && (done.action === 'pay' ? 'to ' : 'from ')}
            <span className="font-medium">{title}</span>
          </p>
        </div>

        <dl className="w-full divide-y rounded-2xl border text-left text-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="money text-right">{formatWhen(done.at)}</dd>
          </div>
          {done.txHash && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Confirmation</dt>
              <dd>
                <a className="money font-mono font-medium underline underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
                  {shortHash(done.txHash)}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {done.action === 'pay' && <p className="text-sm text-muted-foreground">Your share is locked in the pot until it releases or refunds.</p>}
        <Button size="lg" className={BIG} onClick={onDone}>Done</Button>
      </CardContent>
    </Card>
  );
}

const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

const formatWhen = (d: Date) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(d);

export function formatWindow(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? '' : 's'}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
  return `${seconds} seconds`;
}
