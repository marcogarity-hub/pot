import { cn } from 'cn';

export type Face = {
  /** Stable key; also picks the pastel fill, so a person keeps one colour (use the seat number). */
  seat: number;
  /** Display name, falling back to the email. The initial is taken from whichever exists. */
  name?: string | null;
  email?: string | null;
  paid: boolean;
};

const SIZES = {
  sm: { box: 'size-7 text-[12px]', badge: 'size-3', step: '-ml-2' },
  md: { box: 'size-10 text-[15px]', badge: 'size-4', step: '-ml-3' },
  lg: { box: 'size-14 text-[22px]', badge: 'size-5', step: '-ml-4' },
} as const;

/** First letter of the name (or the email's first letter); the seat number if neither is known. */
export function initialOf(face: Pick<Face, 'seat' | 'name' | 'email'>): string {
  const source = (face.name?.trim() || face.email?.trim() || '').replace(/^[^\p{L}\p{N}]+/u, '');
  const first = Array.from(source)[0];
  return first ? first.toLocaleUpperCase() : String(face.seat);
}

/** One friend: a pastel circle with an ink initial when paid, a white dashed circle when not yet. */
export function FaceDot({ face, size = 'md', showCheck = false, className }: {
  face: Face; size?: keyof typeof SIZES; showCheck?: boolean; className?: string;
}) {
  const s = SIZES[size];
  const fill = `var(--face-${(((face.seat - 1) % 6) + 6) % 6 + 1})`;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden
        style={face.paid ? { background: fill } : undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-full font-bold text-face-ink',
          s.box,
          face.paid ? 'ring-2 ring-background' : 'border border-dashed border-[var(--face-empty-border)] bg-card text-muted-foreground',
        )}
      >
        {initialOf(face)}
      </span>
      {showCheck && face.paid && (
        <span aria-hidden className={cn('absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-pine text-white ring-2 ring-background', s.badge)}>
          <svg viewBox="0 0 12 12" className="size-[60%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5 5 9l4.5-5.5" /></svg>
        </span>
      )}
    </span>
  );
}

/**
 * A row of overlapping friends that fills in as people pay. It is announced as one picture
 * ("4 of 6 paid"); the names and states live in the list next to it. With `max`, extra friends
 * collapse into a "+N" chip so a big group never pushes the amount out of its card.
 */
export function Faces({ faces, size = 'md', max, className }: { faces: Face[]; size?: keyof typeof SIZES; max?: number; className?: string }) {
  const paid = faces.filter(f => f.paid).length;
  const shown = max && faces.length > max ? faces.slice(0, max - 1) : faces;
  const extra = faces.length - shown.length;
  const s = SIZES[size];
  return (
    <span role="img" aria-label={`${paid} of ${faces.length} paid`} className={cn('inline-flex items-center', className)}>
      {shown.map((face, i) => (
        <FaceDot key={face.seat} face={face} size={size} className={i > 0 ? s.step : undefined} />
      ))}
      {extra > 0 && (
        <span aria-hidden className={cn('inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background', s.box, s.step)}>
          +{extra}
        </span>
      )}
    </span>
  );
}
