import { cn } from 'cn';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { PotState } from '@/lib/pot/chain';
import { formatRemaining } from './Countdown';
import { stateInfo } from './potState';

export type LifecycleStep = {
  label: string;
  status: 'done' | 'current' | 'next' | 'end';
  /** Short plain line under the current stage: the countdown in that stage. */
  detail: string | null;
};

const STAGES = ['Funding', 'Locked', 'Payout requested', 'Released'] as const;
const CURRENT: Partial<Record<number, number>> = { [PotState.Funding]: 0, [PotState.Locked]: 1, [PotState.PayoutRequested]: 2, [PotState.Released]: 3 };

/**
 * The four stages with the current one's countdown. A Frozen or Expired pot keeps the stages it reached
 * and replaces the rest with one end stage (labelled Expired or Frozen from stateInfo).
 */
export function lifecycleSteps(status: PotStatusRow, nowMs: number): LifecycleStep[] {
  const info = stateInfo(status);
  if (status.state === PotState.Frozen) {
    // Expire only runs from Locked, so an expired pot reached two stages; a frozen one reached three.
    const reached = info.label === 'Expired' ? 2 : 3;
    return [
      ...STAGES.slice(0, reached).map(label => ({ label, status: 'done' as const, detail: null })),
      { label: info.label, status: 'end', detail: null },
    ];
  }
  const current = CURRENT[status.state] ?? 0;
  const released = status.state === PotState.Released;
  return STAGES.map((label, i) => {
    if (i < current || (i === current && released)) return { label, status: 'done', detail: null };
    if (i === current) return { label, status: 'current', detail: detailFor(status, nowMs) };
    return { label, status: 'next', detail: null };
  });
}

function detailFor(status: PotStatusRow, nowMs: number): string | null {
  let prefix: string | null = null;
  let target = NaN;
  if (status.state === PotState.Funding) { prefix = 'Deadline in'; target = Date.parse(status.deadline); }
  else if (status.state === PotState.Locked && status.locked_at) {
    prefix = 'Request within';
    target = Date.parse(status.locked_at) + status.request_window_seconds * 1000;
  } else if (status.state === PotState.PayoutRequested && status.release_eligible_at) {
    prefix = 'Objections close in';
    target = Date.parse(status.release_eligible_at);
  }
  const remaining = target - nowMs;
  return prefix && remaining > 0 ? `${prefix} ${formatRemaining(remaining)}` : null;
}

/** Vertical ruler on phones, horizontal from md. Squares are joined by a 1px hairline. */
export function PotLifecycle({ steps }: { steps: LifecycleStep[] }) {
  return (
    <ol aria-label="Pot lifecycle" className="md:grid md:grid-cols-4">
      {steps.map((step, i) => (
        <li
          key={`${i}-${step.label}`}
          aria-current={step.status === 'current' ? 'step' : undefined}
          className={cn(
            'relative flex min-w-0 items-start gap-4 pb-6 last:pb-0 md:block md:pb-0',
            // The hairline runs from this square to the next one.
            'after:absolute after:left-[11px] after:top-6 after:bottom-0 after:w-px after:bg-border last:after:hidden',
            'md:after:left-6 md:after:right-0 md:after:top-[11px] md:after:bottom-auto md:after:h-px md:after:w-auto',
          )}
        >
          <span className="relative z-10 flex size-6 shrink-0 items-center justify-center bg-card md:mb-3 md:justify-start">
            <Marker status={step.status} />
          </span>
          <div className="min-w-0 space-y-1">
            <p className={cn('font-semibold', step.status === 'next' && 'text-muted-foreground', step.status === 'end' && 'text-destructive')}>
              {step.label}
              <span className="sr-only">{SR[step.status]}</span>
            </p>
            {step.detail && <p className="text-sm text-muted-foreground">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const SR: Record<LifecycleStep['status'], string> = {
  done: ' (done)', current: ' (current)', next: ' (not reached)', end: ' (ended)',
};

function Marker({ status }: { status: LifecycleStep['status'] }) {
  if (status === 'current') return <span aria-hidden className="block size-6 border-2 border-primary bg-primary shadow-[inset_0_0_0_3px_var(--card)]" />;
  if (status === 'done') return <span aria-hidden className="block size-4 bg-primary" />;
  if (status === 'end') return <span aria-hidden className="block size-4 bg-destructive" />;
  return <span aria-hidden className="block size-4 border border-input bg-card" />;
}
