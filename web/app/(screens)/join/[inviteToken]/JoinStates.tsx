import type { ReactNode } from 'react';
import Link from 'next/link';
import { linkButton } from '@/components/pot/linkButton';
import { LinkNotice } from '@/components/pot/LinkNotice';
import { SignInForm } from '@/components/pot/SignInForm';
import { SignOutButton } from '@/components/pot/SignOutButton';

/** One white module on the grid. Every join state that is not the pot preview sits in one. */
export function InviteModule({ children }: { children: ReactNode }) {
  return <section className="min-w-0 space-y-6 border border-border bg-card p-5 md:p-8">{children}</section>;
}

export function SignedOutInvite({ title, linkFailed, next }: { title: string | null; linkFailed: boolean; next: string }) {
  return (
    <InviteModule>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">You&apos;re invited{title ? ` to ${title}` : ''}</h1>
        <p className="text-sm text-muted-foreground">Sign in with the email your organizer invited to see the pot and pay your share.</p>
      </div>
      {linkFailed && <LinkNotice />}
      <SignInForm next={next} />
    </InviteModule>
  );
}

export function WrongEmail({ email }: { email: string }) {
  return (
    <InviteModule>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">This invite isn&apos;t for your email</h1>
        <p className="text-sm text-muted-foreground">You&apos;re signed in as {email}. Ask the organizer to add this address, or sign in with the one they invited.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SignOutButton />
        <Link href="/" className={linkButton({ variant: 'outline', size: 'sm' })}>Go home</Link>
      </div>
    </InviteModule>
  );
}

export function NoLongerMember() {
  return (
    <InviteModule>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">You&apos;re no longer in this pot.</h1>
        <p className="text-sm text-muted-foreground">Your seat was given to someone else. Ask the organizer if you think this is a mistake.</p>
      </div>
      <Link href="/" className={linkButton({ variant: 'outline' })}>Go home</Link>
    </InviteModule>
  );
}

export function InviteNotFound() {
  return (
    <InviteModule>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">Invite not found</h1>
        <p className="text-sm text-muted-foreground">This link may be mistyped or the pot may still be confirming. Ask the organizer to send it again.</p>
      </div>
      <Link href="/" className={linkButton({ variant: 'outline' })}>Go home</Link>
    </InviteModule>
  );
}
