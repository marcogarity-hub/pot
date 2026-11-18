import { Suspense } from 'react';
import { safeNext } from '@/components/pot/auth';
import { Screen } from '@/components/pot/Screen';
import { PotMark } from '@/components/pot/PotMark';
import { TripCover } from '@/components/pot/TripCover';
import { LinkNotice } from '@/components/pot/LinkNotice';
import { SignInForm } from '@/components/pot/SignInForm';
import { SignInFormSkeleton } from '@/components/pot/SignInFormSkeleton';

const GUARANTEES = [
  ['Nobody is paid early.', 'The organizer can only request the money after everyone has paid.'],
  ['Members can object.', 'Enough objections during the window freeze the payout.'],
  ['Refund if it does not fill.', 'Miss the deadline and everyone who paid takes their share back.'],
];

/** Sign in as a glass sheet rising over the trip cover. The sheet holds text, so it gets the opaque glass. */
export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <Screen width="wide">
      <TripCover potId="sign-in" className="h-44 rounded-group md:h-[28rem]" />
      {/* Desktop: the sheet rises over the middle of the cover at one sheet-width column. */}
      <section className="glass-sheet relative -mt-12 space-y-6 rounded-sheet p-6 md:mx-auto md:-mt-72 md:max-w-md md:p-8">
        <div className="space-y-2">
          <h1 className="font-heading text-[34px] leading-[1.05]">Sign in to Pot</h1>
          <p className="text-[17px] text-muted-foreground">Sign in with the email address your organizer invited.</p>
        </div>
        {/* searchParams are runtime data under Cache Components. The fallback must not be interactive. */}
        <Suspense fallback={<SignInFormSkeleton />}>
          {searchParams.then(sp => (
            <>
              {sp.error === 'link' && <LinkNotice />}
              <SignInForm next={safeNext(typeof sp.next === 'string' ? sp.next : null)} />
            </>
          ))}
        </Suspense>
        <ul className="divide-y divide-border rounded-group bg-card px-4">
          {GUARANTEES.map(([head, body]) => (
            <li key={head} className="flex gap-3 py-3">
              <PotMark className="mt-0.5 size-5 shrink-0" />
              <p className="text-[15px]"><span className="font-semibold">{head}</span> <span className="text-muted-foreground">{body}</span></p>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
