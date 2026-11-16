/** The Pot mark: a 2 x 2 grid of seats, one of them filled. It is the whole product in four squares. */
export function PotMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="13.5" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="13.5" width="9" height="9" className="fill-primary stroke-primary" strokeWidth="1.5" />
    </svg>
  );
}
