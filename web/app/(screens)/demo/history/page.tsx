import { Suspense } from 'react';
import { connection } from 'next/server';
import { DemoFrame } from '@/components/pot/demo/DemoFrame';
import { PageBody } from '@/components/pot/PageBody';
import { PaymentsSection } from '@/components/pot/settings/PaymentsSection';
import { demoAtRequest } from '@/lib/demo/data';

export default function DemoHistoryPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <DemoHistoryContent />
    </Suspense>
  );
}

async function DemoHistoryContent() {
  await connection();
  const demo = demoAtRequest();
  return (
    <DemoFrame history={demo.history}>
      <div className="px-4 pt-6 md:px-8 md:pt-10">
        <PageBody title="History">
          <PaymentsSection hideHeading />
        </PageBody>
      </div>
    </DemoFrame>
  );
}
