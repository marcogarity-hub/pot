'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import { arcTestnet } from '@/lib/pot/chain';
import { formatDollars } from '@/lib/format/money';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { Button } from '@/components/ui/button';
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

/** The first of these on offer is the primary action (the one coral button). Everything else is secondary. */
const PRIMARY_ORDER: Action[] = ['pay', 'requestRelease', 'finalize', 'refund', 'expire'];
const TOOLBAR_ORDER: Action[] = ['pay', 'requestRelease', 'finalize', 'refund', 'expire', 'object'];

type Done = { action: Action; txHash?: string; at: Date };

/**
 * The pot's actions. The one primary action per state sits in a floating glass toolbar at the bottom of the
 * screen. Forms, notices and the swap picker stay inline where the page puts them.
 */
export function PotActions({ potId, actions, status, onSettled, onAuthLost, idleText }: {
  potId: string; actions: Action[]; status: PotStatusRow; onSettled(): void;
  /** Called on a 401: the session is gone, so the page should re-check who is signed in. */
  onAuthLost?(): void;
  /** Shown in place of the buttons when nothing is available. */
  idleText?: string;
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
  const share = formatDollars(status.share);

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
    return (
      <>
        <Confirmation done={done} title={status.title ?? `Pot #${status.pot_id}`} amount={share} />
        <Toolbar>
          <Button size="lg" className={TOOLBAR_BUTTON} onClick={() => setDone(null)}>Done</Button>
        </Toolbar>
      </>
    );
  }

  const busy = pending !== null;
  const label = (a: Action, idle: string, working: string) => (pending === a ? working : idle);
  const receiptTrimmed = receipt.trim();
  const primary = PRIMARY_ORDER.find(a => actions.includes(a));
  const variant = (a: Action) => (a === primary ? 'default' : a === 'object' ? 'outline' : 'glass');
  // Once the payout request is on-chain but its receipt failed to save, the request button must not reappear.
  const toolbar = TOOLBAR_ORDER.filter(a => actions.includes(a) && !(a === 'requestRelease' && releaseStuck));

  const buttonFor = (a: Action): ReactNode => {
    const text: Record<Action, [string, string]> = {
      pay: [`Pay ${share}`, 'Paying…'],
      refund: [`Get my ${share} back`, 'Refunding…'],
      requestRelease: ['Request payout', 'Requesting…'],
      object: ['Object', 'Objecting…'],
      finalize: ['Finalize payout', 'Finalizing…'],
      expire: ['Expire pot and open refunds', 'Expiring…'],
      swap: ['Swap seat', 'Swapping…'],
    };
    const [idle, working] = text[a];
    const disabled = busy || (a === 'requestRelease' && (receiptTrimmed.length === 0 || receiptTrimmed.length > 500));
    const className = a === 'object' ? `${TOOLBAR_BUTTON} text-destructive` : TOOLBAR_BUTTON;
    const onClick = () => {
      if (a === 'requestRelease') void run('requestRelease', { receiptText: receiptTrimmed });
      else void run(a);
    };
    return (
      <Button key={a} variant={variant(a)} className={className} disabled={disabled} onClick={onClick}>
        {label(a, idle, working)}
      </Button>
    );
  };

  return (
    <>
      <div className="space-y-4">
        {actions.length === 0 && idleText && <p className="text-[15px] text-muted-foreground">{idleText}</p>}

        {actions.includes('requestRelease') && !releaseStuck && (
          <div className="space-y-3 rounded-group bg-card p-5">
            <Label htmlFor="receipt">Receipt or booking reference</Label>
            <Textarea id="receipt" maxLength={500} value={receipt} placeholder="Airbnb confirmation HMX123"
              onChange={e => setReceipt(e.target.value)} />
            <p className="text-[15px] text-muted-foreground">
              Members see this and have {formatWindow(status.objection_window_seconds)} to object before the money is released to you.
            </p>
          </div>
        )}

        {actions.includes('expire') && (
          <p className="text-[15px] text-muted-foreground">The request window has ended. Expiring the pot opens refunds for everyone who paid. Until someone expires it, the organizer can still request the payout.</p>
        )}

        {actions.includes('swap') && (
          <details className="rounded-group bg-card p-5 text-[15px]">
            <summary className="cursor-pointer font-semibold">Replace a member</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="leaver">Member leaving</Label>
                <Input id="leaver" type="email" value={leaver} onChange={e => setLeaver(e.target.value)} placeholder="leaving@example.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="replacement">Replacement</Label>
                <Input id="replacement" type="email" value={replacement} onChange={e => setReplacement(e.target.value)} placeholder="new@example.com" />
              </div>
              <p className="text-[13px] text-muted-foreground">If the leaving member already paid, they get their share back.</p>
              <Button variant="outline" className={BIG} disabled={busy || !leaver.trim() || !replacement.trim()}
                onClick={() => run('swap', { leaverEmail: leaver.trim().toLowerCase(), replacementEmail: replacement.trim().toLowerCase() })}>
                {label('swap', 'Swap seat', 'Swapping…')}
              </Button>
            </div>
          </details>
        )}

        {releaseStuck && <p role="status" className="text-[15px] font-medium">{releaseStuck}</p>}

        {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}
      </div>

      {toolbar.length > 0 && <Toolbar>{toolbar.map(buttonFor)}</Toolbar>}
    </>
  );
}

const BIG = 'h-12 w-full text-base';
const TOOLBAR_BUTTON = 'h-[52px] min-w-0 flex-1 rounded-full px-4 text-[17px]';

/**
 * The floating glass bar at the bottom of the screen. It is safe-area aware and centred on desktop.
 * Only the bar takes pointer events, so the content above it stays scrollable.
 */
function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-safe md:px-6">
      <div role="group" aria-label="Pot actions" className="glass pointer-events-auto mx-auto mb-4 flex max-w-2xl items-center gap-2 rounded-full p-1.5">
        {children}
      </div>
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
 * Receipt for a settled action, as a calm confirmation: a pine check, the headline, and the amount where one
 * applies. The date and the transaction link (a hash, so only here in the details list) sit at the end.
 */
function Confirmation({ done, title, amount }: { done: Done; title: string; amount: string }) {
  const pay = done.action === 'pay';
  const explorer = `${arcTestnet.blockExplorers.default.url}/tx/${done.txHash}`;
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cardRef.current?.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);
  return (
    <section ref={cardRef} aria-label="Confirmation" className="flex flex-col items-center gap-5 pt-4 text-center">
      <span aria-hidden className="grid size-20 place-items-center rounded-full bg-pine text-white shadow-[0_8px_24px_rgba(31,77,58,0.25)]">
        <CircleCheck className="size-10" strokeWidth={2} />
      </span>
      <div className="space-y-2">
        <p role="status" className="text-[15px] font-medium text-muted-foreground">{HEADING[done.action]}</p>
        <h2 className="font-heading text-[34px] leading-[1.05] tracking-tight">{pay ? 'You’re in' : title}</h2>
        {pay && (
          <p className="text-[17px] text-muted-foreground">
            <span className="money font-semibold text-foreground">{amount}</span> is held until everyone has paid, for <span className="font-medium text-foreground">{title}</span>.
          </p>
        )}
        {done.action === 'refund' && <p className="money text-[17px] font-semibold">{amount}</p>}
        {pay && <p className="text-[15px] text-muted-foreground">Your share is locked in the pot until it releases or refunds.</p>}
      </div>

      <dl aria-label="Details" className="w-full divide-y divide-border overflow-hidden rounded-group bg-card text-left text-[17px]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="text-right">{formatWhen(done.at)}</dd>
        </div>
        {done.txHash && (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">Transaction</dt>
            <dd>
              <a className="font-mono text-[15px] font-medium underline underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
                {shortHash(done.txHash)}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </section>
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
