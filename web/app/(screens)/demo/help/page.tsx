import { Suspense } from 'react';
import { DemoFrame } from '@/components/pot/demo/DemoFrame';
import { PageBody } from '@/components/pot/PageBody';
import { HelpSection } from '@/components/pot/settings/HelpSection';

export default function DemoHelpPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <DemoFrame history={[]}>
        <div className="px-4 pt-6 md:px-8 md:pt-10">
          <PageBody title="Help">
            <HelpSection hideHeading />
          </PageBody>
        </div>
      </DemoFrame>
    </Suspense>
  );
}
