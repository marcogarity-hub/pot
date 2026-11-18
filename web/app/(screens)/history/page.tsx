import { Suspense } from 'react';
import { FramedPage } from '@/components/pot/FramedPage';
import { PageBody } from '@/components/pot/PageBody';
import { PaymentsSection } from '@/components/pot/settings/PaymentsSection';

// The session cookie is read inside FramedPage, so the page renders behind Suspense.
// History needs an account: signed-out visitors are sent to sign-in and brought back here.
export default function HistoryPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <FramedPage path="/history" requireSignIn>
        <PageBody title="History">
          <PaymentsSection hideHeading />
        </PageBody>
      </FramedPage>
    </Suspense>
  );
}
