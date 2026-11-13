'use client';

import { useEffect, useState } from 'react';

/** Current time, re-rendered every `intervalMs`. Only call from client-rendered trees. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

export function Countdown({ target, now, label, doneLabel }: { target: string; now: Date; label: string; doneLabel: string }) {
  const remaining = Date.parse(target) - now.getTime();
  return (
    <p className="text-sm text-muted-foreground">
      {remaining > 0
        ? <>{label} <span className="font-medium tabular-nums text-foreground">{formatRemaining(remaining)}</span></>
        : doneLabel}
    </p>
  );
}
