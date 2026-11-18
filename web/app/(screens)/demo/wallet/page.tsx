import { Suspense } from 'react';
import { DemoFrame } from '@/components/pot/demo/DemoFrame';
import { PageBody } from '@/components/pot/PageBody';
import { WalletSection } from '@/components/pot/settings/WalletSection';

// The wallet page shows the demo's made-up address and the same "test money" note as the real one.
export default function DemoWalletPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading…</p>}>
      <DemoFrame history={[]}>
        <div className="px-4 pt-6 md:px-8 md:pt-10">
          <PageBody title="Wallet">
            <WalletSection hideHeading />
          </PageBody>
        </div>
      </DemoFrame>
    </Suspense>
  );
}
