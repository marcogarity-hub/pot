import { Suspense } from 'react';
import { FramedPage } from '@/components/pot/FramedPage';
import { PageBody } from '@/components/pot/PageBody';
import { WalletSection } from '@/components/pot/settings/WalletSection';

// The session cookie is read inside FramedPage, so the page renders behind Suspense.
// The wallet needs an account: signed-out visitors are sent to sign-in and brought back here.
export default function WalletPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <FramedPage path="/wallet" requireSignIn>
        <PageBody title="Wallet">
          <WalletSection hideHeading />
        </PageBody>
      </FramedPage>
    </Suspense>
  );
}
