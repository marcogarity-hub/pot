/** Shown when the sign-in page or join page was reached with `?error=link`: a dead or foreign-browser email link, or a Google/Apple sign-in that was cancelled or failed. */
export function LinkNotice() {
  return (
    <div role="status" className="rounded-xl bg-muted p-3 text-sm text-foreground">
      That sign-in did not finish. Email links expire, work only once, and must be opened in the same browser; a Google or Apple sign-in may also have been cancelled. Try again, or enter the code from your newest email.
    </div>
  );
}
