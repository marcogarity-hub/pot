import Link from 'next/link';
import { linkButton } from './linkButton';

/** Shown when the sign-in page or join page was reached with `?error=link`: a dead or foreign-browser email link, or a Google/Apple sign-in that was cancelled or failed. */
export function LinkNotice() {
  return (
    <div role="status" className="min-w-0 space-y-4 border border-border bg-card p-5 md:p-6">
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight">That sign-in did not finish.</h2>
        <p className="text-base text-foreground">
          Email links expire, work only once, and must be opened in the same browser; a Google or Apple sign-in may also have been cancelled. Try again, or enter the code from your newest email.
        </p>
      </div>
      <Link href="/sign-in" className={linkButton({ className: 'w-full sm:w-auto' })}>Back to sign in</Link>
    </div>
  );
}
