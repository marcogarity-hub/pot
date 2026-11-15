import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { safeNext } from '@/components/pot/auth';
import { Screen } from '@/components/pot/Screen';
import { SignInForm } from '@/components/pot/SignInForm';
import { SignInFormSkeleton } from '@/components/pot/SignInFormSkeleton';

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Sign in to Pot</CardTitle>
          <CardDescription>We&apos;ll email you a link. Use the address your organizer invited.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* searchParams are runtime data under Cache Components. The fallback must not be interactive. */}
          <Suspense fallback={<SignInFormSkeleton />}>
            {searchParams.then(sp => <SignInForm next={safeNext(typeof sp.next === 'string' ? sp.next : null)} />)}
          </Suspense>
        </CardContent>
      </Card>
    </Screen>
  );
}
