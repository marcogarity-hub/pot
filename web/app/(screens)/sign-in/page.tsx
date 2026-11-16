import { Suspense } from 'react';
import { safeNext } from '@/components/pot/auth';
import { Screen } from '@/components/pot/Screen';
import { PotMark } from '@/components/pot/PotMark';
import { LinkNotice } from '@/components/pot/LinkNotice';
import { SignInForm } from '@/components/pot/SignInForm';
import { SignInFormSkeleton } from '@/components/pot/SignInFormSkeleton';

const GUARANTEES = [
  ['Nobody is paid early.', 'The organizer can only request the money after everyone has paid.'],
  ['Members can object.', 'Enough objections during the window freeze the payout.'],
  ['Refund if it does not fill.', 'Miss the deadline and everyone who paid takes their share back.'],
];

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <Screen width="wide">
      <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-12">
        <section className="min-w-0 bg-card p-6 md:order-2 md:col-span-5 md:p-10">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Sign in to Pot</h1>
          <p className="mb-6 mt-2 text-base text-muted-foreground">Sign in with the email address your organizer invited.</p>
          {/* searchParams are runtime data under Cache Components. The fallback must not be interactive. */}
          <Suspense fallback={<SignInFormSkeleton />}>
            {searchParams.then(sp => (
              <>
                {sp.error === 'link' && <div className="mb-6"><LinkNotice /></div>}
                <SignInForm next={safeNext(typeof sp.next === 'string' ? sp.next : null)} />
              </>
            ))}
          </Suspense>
        </section>
        <div className="min-w-0 space-y-8 bg-card p-6 md:order-1 md:col-span-7 md:p-10">
          <div className="space-y-4">
            <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              Nobody is in until their money is locked in.
            </h2>
            <p className="max-w-[52ch] text-base text-muted-foreground">
              Sign in with Google or an emailed code. Pot creates your wallet for you.
            </p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {GUARANTEES.map(([head, body]) => (
              <li key={head} className="flex gap-3 py-3">
                <PotMark className="mt-0.5 size-5 shrink-0" />
                <p className="text-sm"><span className="font-semibold">{head}</span> <span className="text-muted-foreground">{body}</span></p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Screen>
  );
}
