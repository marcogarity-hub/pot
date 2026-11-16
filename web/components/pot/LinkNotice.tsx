/** Shown when the sign-in page or join page was reached with `?error=link` (a dead or foreign-browser link). */
export function LinkNotice() {
  return (
    <div role="status" className="rounded-xl bg-muted p-3 text-sm text-foreground">
      That sign-in link has expired, was already used, or was opened in a different browser. Enter the code from your newest email, or request a new one.
    </div>
  );
}
