import { Suspense } from 'react';
import { FramedPage } from '@/components/pot/FramedPage';
import { PageBody } from '@/components/pot/PageBody';
import { HelpSection } from '@/components/pot/settings/HelpSection';

// Help is public: signed-out visitors read it in the plain Screen, signed-in visitors in the frame.
export default function HelpPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <FramedPage path="/help">
        <PageBody title="Help">
          <HelpSection hideHeading />
        </PageBody>
      </FramedPage>
    </Suspense>
  );
}
