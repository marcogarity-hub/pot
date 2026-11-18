import { Suspense } from 'react';
import Link from 'next/link';
import { DemoFrame } from '@/components/pot/demo/DemoFrame';
import { PageBody } from '@/components/pot/PageBody';
import { linkButton } from '@/components/pot/linkButton';

// Starting a plan needs an account and a wallet, so the demo explains that instead of showing a form that cannot save.
export default function DemoNewPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <DemoFrame history={[]}>
        <div className="px-4 pt-6 md:px-8 md:pt-10">
          <PageBody title="Start a plan">
            <div className="space-y-5 rounded-group bg-card p-5 md:p-8">
              <p className="text-[17px]">Plans can&apos;t be started in the demo, because starting one takes an account.</p>
              <p className="text-[15px] text-muted-foreground">
                Sign in with your email to start a real plan with your friends. It uses test money, so nothing real is at stake.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/sign-in?next=/new" className={linkButton({ size: 'lg', className: 'w-full sm:w-auto' })}>Sign in to start a plan</Link>
                <Link href="/demo" className={linkButton({ size: 'lg', variant: 'outline', className: 'w-full sm:w-auto' })}>Back to the demo</Link>
              </div>
            </div>
          </PageBody>
        </div>
      </DemoFrame>
    </Suspense>
  );
}
