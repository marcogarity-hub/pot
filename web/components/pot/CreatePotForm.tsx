'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { CreatePotBody } from '@/app/api/pots/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDollarsFromUsdc } from '@/lib/format/money';
import { FaceDot } from './Faces';
import { linkButton } from './linkButton';
import { postJson, type ApiResult } from './api';
import { reconcilePot, TIMEOUT_MESSAGE, type ReconcileInput, type ReconcileOutcome } from './reconcile';
import { DEADLINE_MAX, deriveShare, MAX_MEMBERS, normalizeEmail, validateCreate, type CreateErrors } from './validate';
import { WindowField, type Preset } from './WindowField';

/** Wall-clock time in the YYYY-MM-DDTHH:mm format a datetime-local input uses. */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Field order on the form, with the DOM id focused for each. Member emails focus the first member input. */
const FIELD_FOCUS: Array<[keyof CreateErrors, string]> = [
  ['title', 'title'], ['memberEmails', 'member-0'], ['total', 'total'], ['deadline', 'deadline'],
  ['threshold', 'threshold'], ['objectionWindowSeconds', 'objection-window'], ['requestWindowSeconds', 'request-window'],
];

/** Moves focus to the first field with an error. WindowField's minutes input is absent in preset mode, so its trigger is the fallback. */
function focusFirstInvalid(errors: CreateErrors) {
  const hit = FIELD_FOCUS.find(([key]) => errors[key]);
  if (!hit) return;
  const el = document.getElementById(hit[1]) ?? document.getElementById(`${hit[1]}-trigger`);
  el?.focus();
}

const OBJECTION_PRESETS: Preset[] = [
  { label: '2 minutes (demo)', seconds: 120 },
  { label: '48 hours (production)', seconds: 172800 },
];
const REQUEST_PRESETS: Preset[] = [
  { label: '2 minutes (demo)', seconds: 120 },
  { label: '7 days (production)', seconds: 604800 },
];

/** Window values a new pot starts with: the 2-minute demo windows. The `booking` preset (linked from the dashboard) starts on the production windows instead. */
const DEFAULT_WINDOWS = { objection: 120, request: 120 };
const BOOKING_WINDOWS = { objection: OBJECTION_PRESETS[1].seconds, request: REQUEST_PRESETS[1].seconds };

/** Borderless input for a row inside a white grouped cell. Keeps the focus outline from the base Input. */
const ROW_INPUT = 'h-11 rounded-none border-0 bg-transparent px-0 text-[17px] shadow-none';

export function CreatePotForm({ preset }: { preset?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [emails, setEmails] = useState<string[]>(['']);
  const [deadlineLocal, setDeadlineLocal] = useState('');
  // No max on the server render, so server and client HTML match (the clock differs between them).
  const deadlineMax = useSyncExternalStore(
    () => () => {},
    () => toLocalInput(new Date(Date.now() + DEADLINE_MAX * 1000)),
    () => undefined,
  );
  const [threshold, setThreshold] = useState('1');
  const initialWindows = preset === 'booking' ? BOOKING_WINDOWS : DEFAULT_WINDOWS;
  const [objectionWindowSeconds, setObjection] = useState(initialWindows.objection);
  const [requestWindowSeconds, setRequest] = useState(initialWindows.request);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set while a create or its recovery is in flight. Blocks every second submit, even before React re-renders.
  const submittingRef = useRef(false);
  const [finishing, setFinishing] = useState(false);
  // Set when recovery gave up. The form stays locked: the pot may exist, and a second create could duplicate it.
  const [stuckMessage, setStuckMessage] = useState<string | null>(null);
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  const filled = emails.map(normalizeEmail).filter(Boolean);
  const share = deriveShare(total, filled.length);

  const body = (): CreatePotBody => {
    const d = deadlineLocal ? new Date(deadlineLocal) : null;
    return {
      title: title.trim(),
      total: total.trim(),
      memberEmails: filled,
      deadline: d && !Number.isNaN(d.getTime()) ? d.toISOString() : '',
      threshold: Number(threshold),
      objectionWindowSeconds,
      requestWindowSeconds,
    };
  };

  function release() {
    submittingRef.current = false;
    setSubmitting(false);
    setFinishing(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current || stuckMessage) return;
    setSubmitError(null);
    const input = body();
    const result = validateCreate(input, new Date());
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(result.errors);
      return;
    }
    setErrors({});
    submittingRef.current = true;
    setSubmitting(true);
    const res = await postJson<{ potId: string; inviteToken: string }>('/api/pots', input);
    if (res.ok) { router.push(`/pots/${res.data.potId}`); return; }
    if (res.status === 401) { release(); router.push('/sign-in?next=/new'); return; }
    const pending = recoveryInput(res, input);
    if (!pending) { release(); setSubmitError(res.message); return; }
    setFinishing(true);
    const outcome = await reconcilePot(pending, { isCancelled: () => unmountedRef.current });
    finish(outcome);
  }

  function finish(outcome: ReconcileOutcome) {
    if (outcome.kind === 'created') { router.push(`/pots/${outcome.potId}`); return; }
    if (outcome.kind === 'cancelled') { release(); return; }
    if (outcome.kind === 'not-created') {
      release();
      setSubmitError("The pot wasn't created. You can try again.");
      return;
    }
    // stop or timeout: keep the form locked so the pot can't be created twice.
    setFinishing(false);
    setStuckMessage(outcome.kind === 'stop' ? outcome.message : TIMEOUT_MESSAGE);
  }

  const setEmail = (i: number, v: string) => setEmails(list => list.map((e, j) => (j === i ? v : e)));

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* The sheet. Glass here holds text, so it is the only blur on the page. The submit bar sits outside it: a backdrop filter would trap the bar's fixed position. */}
      <div className="glass-sheet mx-auto min-h-[calc(100dvh-2.5rem)] w-full max-w-xl rounded-t-[38px] px-4 pb-40 pt-2 md:my-12 md:min-h-0 md:rounded-[38px] md:px-6 md:pb-10">
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-black/20" />
        <Link href="/" aria-label="Close" className={linkButton({ variant: 'glass', size: 'icon' })}>
          <X strokeWidth={2} />
        </Link>
        <h1 className="mt-4 font-heading text-[34px] leading-[1.05]">Start a pot</h1>

        <section aria-labelledby="pot-heading" className="mt-6 space-y-2">
          <h2 id="pot-heading" className="px-1 text-[22px] font-semibold tracking-tight">The pot</h2>
          <div className="divide-y divide-border overflow-hidden rounded-group bg-card">
            <Field id="title" label="Name" error={errors.title}>
              <Input id="title" value={title} placeholder="Cabin weekend" maxLength={120}
                className={ROW_INPUT}
                onChange={e => setTitle(e.target.value)} aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'title-error' : undefined} />
            </Field>
            <Field id="total" label="Total ($)" error={errors.total}>
              <Input id="total" inputMode="decimal" value={total} placeholder="2400"
                className={ROW_INPUT}
                onChange={e => setTotal(e.target.value)} aria-invalid={!!errors.total}
                aria-describedby={errors.total ? 'total-error' : undefined} />
            </Field>
            <Field id="deadline" label="Pay-in deadline" error={errors.deadline}>
              <Input id="deadline" type="datetime-local" value={deadlineLocal} max={deadlineMax}
                className={ROW_INPUT}
                onChange={e => setDeadlineLocal(e.target.value)} aria-invalid={!!errors.deadline}
                aria-describedby={errors.deadline ? 'deadline-error' : undefined} />
            </Field>
          </div>
          <p className="px-1 text-[13px] text-muted-foreground">Nobody is in until their money is locked in. If not everyone pays by the deadline, everyone who paid can take their money back.</p>
        </section>

        <MembersPanel
          emails={emails}
          memberError={errors.memberEmails}
          share={share}
          filledCount={filled.length}
          hasTotal={Boolean(total.trim())}
          onEmailChange={setEmail}
          onRemove={i => setEmails(list => list.filter((_, j) => j !== i))}
          onAdd={() => setEmails(list => [...list, ''])}
        />

        <section aria-labelledby="rules-heading" className="mt-8 space-y-2">
          <h2 id="rules-heading" className="px-1 text-[22px] font-semibold tracking-tight">Rules</h2>
          <div className="divide-y divide-border overflow-hidden rounded-group bg-card">
            <Field id="threshold" label="Objections needed to block the payout" error={errors.threshold}>
              <Input id="threshold" type="number" inputMode="numeric" min={1} max={Math.max(filled.length, 1)} className="h-11 w-28 text-[17px]"
                value={threshold} onChange={e => setThreshold(e.target.value)} aria-invalid={!!errors.threshold}
                aria-describedby={errors.threshold ? 'threshold-error' : undefined} />
              <p className="text-[13px] text-muted-foreground">Between 1 and {Math.max(filled.length, 1)} (the number of members).</p>
            </Field>
            <div className="min-w-0 px-4 py-3">
              <WindowField id="objection-window" label="Objection window"
                hint="How long members have to object after you request the payout."
                presets={OBJECTION_PRESETS} seconds={objectionWindowSeconds} onChange={setObjection}
                error={errors.objectionWindowSeconds} />
            </div>
            <div className="min-w-0 px-4 py-3">
              <WindowField id="request-window" label="Payout request window"
                hint="After the pot locks, the organizer should request the payout within this time. After that, anyone can expire the pot so members can get refunds."
                presets={REQUEST_PRESETS} seconds={requestWindowSeconds} onChange={setRequest}
                error={errors.requestWindowSeconds} />
            </div>
          </div>
          <p className="px-1 text-[13px] text-muted-foreground">These are written into the contract and can&apos;t change later.</p>
        </section>

        <div className="mt-6 space-y-3">
          <SubmitStatus
            finishing={finishing}
            hasErrors={Object.keys(errors).length > 0}
            stuckMessage={stuckMessage}
            submitError={submitError}
          />
          <p className="px-1 text-[13px] text-muted-foreground">
            Test money only. <Link href="/privacy" className="underline">Privacy</Link>
          </p>
        </div>
      </div>

      <div className="glass fixed inset-x-0 bottom-0 z-20 pb-safe">
        <div className="mx-auto max-w-xl px-4 pb-3 pt-3 md:px-6">
          <Button type="submit" size="lg" className="w-full" disabled={submitting || stuckMessage !== null}>
            {finishing ? 'Finishing up your pot…' : submitting ? 'Creating pot…' : 'Create pot'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** The member list as grouped rows: a friend preview beside each email, with the live share line under them. Read-only over the form's values. */
export function MembersPanel({ emails, memberError, share, filledCount, hasTotal, onEmailChange, onRemove, onAdd }: {
  emails: string[]; memberError?: string; share: string | null; filledCount: number; hasTotal: boolean;
  onEmailChange(i: number, value: string): void; onRemove(i: number): void; onAdd(): void;
}) {
  return (
    <section aria-labelledby="members-heading" className="mt-8 space-y-2">
      <h2 id="members-heading" className="px-1 text-[22px] font-semibold tracking-tight">Members</h2>
      <div className="overflow-hidden rounded-group bg-card">
        <ul className="divide-y divide-border">
          {emails.map((email, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-1">
              <FaceDot face={{ seat: i + 1, email: email.trim() || null, paid: false }} />
              <Input id={`member-${i}`} type="email" autoComplete="off" aria-label={`Member ${i + 1} email`} placeholder="friend@example.com"
                className={`${ROW_INPUT} min-w-0 flex-1`}
                value={email} onChange={e => onEmailChange(i, e.target.value)} aria-invalid={!!memberError}
                aria-describedby={memberError ? 'member-emails-error' : undefined} />
              {emails.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove member ${i + 1}`} onClick={() => onRemove(i)}>
                  <X strokeWidth={2} />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {memberError && <p id="member-emails-error" className="px-4 pb-2 text-[13px] text-destructive">{memberError}</p>}
        <div className="px-2">
          <Button type="button" variant="ghost" aria-label="Add member"
            disabled={emails.length >= MAX_MEMBERS} onClick={onAdd}>
            <Plus strokeWidth={2} /> Add member
          </Button>
        </div>
        <p className="border-t border-border px-4 py-3 text-[17px]" data-testid="share">
          {share ? <>Each member pays <span className="font-heading money text-[22px]">{formatDollarsFromUsdc(share)}</span></>
            : filledCount > 0 && hasTotal ? 'Total must divide evenly by the number of members'
            : 'Each member pays an equal share'}
        </p>
      </div>
      <p className="px-1 text-[13px] text-muted-foreground">Add each member&apos;s email, including yours if you&apos;re paying a share. Up to {MAX_MEMBERS}.</p>
    </section>
  );
}

/** Status messages above the submit bar. Each keeps its live-region role. */
export function SubmitStatus({ finishing, hasErrors, stuckMessage, submitError }: {
  finishing: boolean; hasErrors: boolean; stuckMessage: string | null; submitError: string | null;
}) {
  return (
    <>
      {finishing && (
        <p role="status" className="text-[15px] text-muted-foreground">
          Your pot is being confirmed on-chain. This can take up to two minutes. Please don&apos;t submit again.
        </p>
      )}
      {hasErrors && <p role="alert" className="text-[15px] text-destructive">Fix the fields with errors, then try again.</p>}
      {stuckMessage && <p role="alert" className="text-[15px] text-destructive">{stuckMessage}</p>}
      {submitError && <p role="alert" className="text-[15px] text-destructive">{submitError}</p>}
    </>
  );
}

/**
 * Create returned a pot that may already exist on-chain. Returns the reconcile request for it, or null
 * when the error is a plain failure the user can retry. Recoverable: a 502 CreatePending with a circle
 * transaction id, any 502 that carries a transaction hash, and the 503 with potId + transactionHash.
 */
function recoveryInput(res: Extract<ApiResult<unknown>, { ok: false }>, input: { title: string; memberEmails: string[] }): ReconcileInput | null {
  const { title, memberEmails } = input;
  if (res.status === 502 && res.body.error === 'CreatePending' && typeof res.body.circleTransactionId === 'string') {
    return { title, memberEmails, circleTransactionId: res.body.circleTransactionId };
  }
  if (res.status === 502 && typeof res.body.transactionHash === 'string' && typeof res.body.circleTransactionId !== 'string') {
    return { title, memberEmails, transactionHash: res.body.transactionHash };
  }
  if (res.status === 503 && typeof res.body.potId === 'string' && typeof res.body.transactionHash === 'string') {
    return { title, memberEmails, transactionHash: res.body.transactionHash };
  }
  return null;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 px-4 py-2">
      <Label htmlFor={id} className="text-[13px] font-normal text-muted-foreground">{label}</Label>
      {children}
      {error && <p id={`${id}-error`} className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
