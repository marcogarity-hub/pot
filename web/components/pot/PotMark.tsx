/** The Pot mark: four friends, one of them filled in. It is the whole product in four circles. */
export function PotMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <circle cx="6.25" cy="6.25" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.75" cy="6.25" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.25" cy="17.75" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.75" cy="17.75" r="4.5" className="fill-foreground stroke-foreground" strokeWidth="1.5" />
    </svg>
  );
}
