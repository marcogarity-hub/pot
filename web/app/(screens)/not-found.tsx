import Link from 'next/link';
import { linkButton } from '@/components/pot/linkButton';
import { PotMark } from '@/components/pot/PotMark';
import { Screen } from '@/components/pot/Screen';

export default function NotFound() {
  return (
    <Screen>
      <section className="min-w-0 space-y-6 border border-border bg-card p-5 md:p-8">
        <PotMark className="size-8 text-primary" />
        <div className="space-y-3">
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">Page not found</h1>
          <p className="text-base text-muted-foreground">This page doesn&apos;t exist or has moved.</p>
        </div>
        <Link href="/" className={linkButton({ size: 'lg' })}>Go home</Link>
      </section>
    </Screen>
  );
}
