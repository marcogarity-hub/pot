'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { CreatePotBody } from '@/app/api/pots/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { postJson, type ApiResult } from './api';
import { reconcilePot, TIMEOUT_MESSAGE, type ReconcileInput, type ReconcileOutcome } from './reconcile';
import { deriveShare, MAX_MEMBERS, normalizeEmail, validateCreate, type CreateErrors } from './validate';
import { WindowField, type Preset } from './WindowField';

const OBJECTION_PRESETS: Preset[] = [
  { label: '2 minutes (demo)', seconds: 120 },
  { label: '48 hours (production)', seconds: 172800 },
];
const REQUEST_PRESETS: Preset[] = [
  { label: '2 minutes (demo)', seconds: 120 },
  { label: '7 days (production)', seconds: 604800 },
];

export function CreatePotForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [emails, setEmails] = useState<string[]>(['']);
  const [deadlineLocal, setDeadlineLocal] = useState('');
  const [threshold, setThreshold] = useState('1');
  const [objectionWindowSeconds, setObjection] = useState(120);
  const [requestWindowSeconds, setRequest] = useState(120);
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
    if (!result.ok) { setErrors(result.errors); return; }
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
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <StepLabel n={1} />
          <CardTitle className="font-heading text-xl">What&apos;s the pot for?</CardTitle>
          <CardDescription>Nobody is in until their money is locked in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="title" label="Name" error={errors.title}>
            <Input id="title" value={title} placeholder="Cabin weekend" maxLength={120}
              onChange={e => setTitle(e.target.value)} aria-invalid={!!errors.title} />
          </Field>
          <Field id="total" label="Total (USDC)" error={errors.total}>
            <Input id="total" inputMode="decimal" value={total} placeholder="2400"
              onChange={e => setTotal(e.target.value)} aria-invalid={!!errors.total} />
            <p className="text-sm text-muted-foreground" data-testid="share">
              {share ? <>Each member pays <span className="font-medium text-foreground">{share} USDC</span></>
                : filled.length > 0 && total.trim() ? 'Total must divide evenly by the number of members'
                : 'Each member pays an equal share'}
            </p>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <StepLabel n={2} />
          <CardTitle className="font-heading text-xl">Who&apos;s in?</CardTitle>
          <CardDescription>Add each member&apos;s email, including yours if you&apos;re paying a share. Up to {MAX_MEMBERS}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {emails.map((email, i) => (
            <div key={i} className="flex gap-2">
              <Input type="email" autoComplete="off" aria-label={`Member ${i + 1} email`} placeholder="friend@example.com"
                value={email} onChange={e => setEmail(i, e.target.value)} aria-invalid={!!errors.memberEmails} />
              {emails.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove member ${i + 1}`}
                  onClick={() => setEmails(list => list.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              )}
            </div>
          ))}
          {errors.memberEmails && <p className="text-sm text-destructive">{errors.memberEmails}</p>}
          <Button type="button" variant="outline" size="sm" disabled={emails.length >= MAX_MEMBERS}
            onClick={() => setEmails(list => [...list, ''])}>
            <Plus /> Add member
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <StepLabel n={3} />
          <CardTitle className="font-heading text-xl">Rules</CardTitle>
          <CardDescription>These are written into the contract and can&apos;t change later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="deadline" label="Pay-in deadline" error={errors.deadline}>
            <Input id="deadline" type="datetime-local" value={deadlineLocal}
              onChange={e => setDeadlineLocal(e.target.value)} aria-invalid={!!errors.deadline} />
            <p className="text-xs text-muted-foreground">If not everyone pays by then, everyone who paid can take their money back.</p>
          </Field>
          <Field id="threshold" label="Objections needed to block the payout" error={errors.threshold}>
            <Input id="threshold" type="number" inputMode="numeric" min={1} max={Math.max(filled.length, 1)} className="w-28"
              value={threshold} onChange={e => setThreshold(e.target.value)} aria-invalid={!!errors.threshold} />
            <p className="text-xs text-muted-foreground">Between 1 and {Math.max(filled.length, 1)} (the number of members).</p>
          </Field>
          <Separator />
          <WindowField id="objection-window" label="Objection window"
            hint="How long members have to object after you request the payout."
            presets={OBJECTION_PRESETS} seconds={objectionWindowSeconds} onChange={setObjection}
            error={errors.objectionWindowSeconds} />
          <WindowField id="request-window" label="Payout request window"
            hint="After the pot locks, you must request the payout within this time, or members can get refunds."
            presets={REQUEST_PRESETS} seconds={requestWindowSeconds} onChange={setRequest}
            error={errors.requestWindowSeconds} />
        </CardContent>
      </Card>

      {finishing && (
        <p role="status" className="text-sm text-muted-foreground">
          Your pot is being confirmed on-chain. This can take up to two minutes. Please don&apos;t submit again.
        </p>
      )}
      {stuckMessage && <p role="alert" className="text-sm text-destructive">{stuckMessage}</p>}
      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={submitting || stuckMessage !== null}>
        {finishing ? 'Finishing up your pot…' : submitting ? 'Creating pot…' : 'Create pot'}
      </Button>
    </form>
  );
}

/**
 * Create returned a pot that may already exist on-chain. Returns the reconcile request for it, or null
 * when the error is a plain failure the user can retry. Only Lane 2's CreatePending (502) and the
 * 503 with potId + transactionHash are recoverable this way.
 */
function recoveryInput(res: Extract<ApiResult<unknown>, { ok: false }>, input: { title: string; memberEmails: string[] }): ReconcileInput | null {
  const { title, memberEmails } = input;
  if (res.status === 502 && res.body.error === 'CreatePending' && typeof res.body.circleTransactionId === 'string') {
    return { title, memberEmails, circleTransactionId: res.body.circleTransactionId };
  }
  if (res.status === 503 && typeof res.body.potId === 'string' && typeof res.body.transactionHash === 'string') {
    return { title, memberEmails, transactionHash: res.body.transactionHash };
  }
  return null;
}

function StepLabel({ n }: { n: number }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step {n} of 3</p>;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
