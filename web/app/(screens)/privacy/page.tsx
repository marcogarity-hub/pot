import type { Metadata } from 'next';
import Link from 'next/link';
import { linkButton } from '@/components/pot/linkButton';
import { Screen } from '@/components/pot/Screen';

export const metadata: Metadata = { title: 'Privacy – Pot', description: 'What Pot collects, why, and who handles it.' };

const UPDATED = 'November 16, 2026';

/** Optional contact address, set in Vercel as NEXT_PUBLIC_CONTACT_EMAIL. Kept out of the repo on purpose. */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

export default function PrivacyPage() {
  return (
    <Screen width="wide">
      <article className="min-w-0 space-y-8 rounded-group border border-border bg-card p-6 text-base leading-relaxed md:mx-auto md:max-w-3xl md:p-12">
        <header className="space-y-2 pb-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Privacy</h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        </header>
          <p>
            Pot is a hackathon demo of group payments on a <strong>test network</strong> (Arc testnet). It uses test USDC, which has no
            real-world value. Please don&apos;t use it for real money.
          </p>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="font-heading text-xl font-semibold tracking-tight">What we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Your email address.</strong> You give it when you sign in, or a plan organizer types it to invite you.</li>
              <li>
                <strong>If you sign in with Google:</strong> the email address on your Google account. Google also sends your name and
                profile picture, which our sign-in provider stores with your account. We only use your email address; we do not copy your Google
                name into Pot. We never read your Google mail, contacts, files or anything else.
              </li>
              <li>
                <strong>A display name, if you choose to set one.</strong> The other members of your plans see it instead of your email address.
                Only a plan&apos;s organizer sees the email addresses they invited. You can change or remove your name any time.
              </li>
              <li><strong>A wallet we create for you.</strong> Each member gets a wallet address tied to their email, so you never handle keys or gas.</li>
              <li><strong>Plan records:</strong> plan titles, amounts, deadlines, the member list, payments and actions (pay, object, refund, release), and any receipt text an organizer enters.</li>
              <li><strong>A sign-in cookie</strong> that keeps you signed in. We use no advertising or tracking cookies and no analytics.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="font-heading text-xl font-semibold tracking-tight">How we use it</h2>
            <p>Only to run plans: to sign you in, show you your plans, move the test money, and send your sign-in code. We don&apos;t sell your information and we don&apos;t use it for advertising.</p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="font-heading text-xl font-semibold tracking-tight">What is public</h2>
            <p>
              Payments, wallet addresses and plan IDs are written to a public blockchain. Anyone can see them, and they can&apos;t be edited or
              deleted by us or anyone else. Your email address is not written to the blockchain.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="font-heading text-xl font-semibold tracking-tight">Who handles it for us</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Supabase:</strong> accounts, sign-in and our database.</li>
              <li><strong>Circle:</strong> creates and signs for member wallets.</li>
              <li><strong>Vercel:</strong> hosts the app.</li>
              <li><strong>QuickNode:</strong> delivers public blockchain events to the app.</li>
              <li><strong>Google:</strong> only if you choose Sign in with Google.</li>
              <li><strong>Our email sender:</strong> delivers sign-in codes.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="font-heading text-xl font-semibold tracking-tight">Deleting your data</h2>
            <p>
              This is a demo, so we keep account and plan records only as long as the demo runs. To ask us to delete yours,{' '}
              {CONTACT_EMAIL
                ? <>email <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>
                : <>open an issue on the project&apos;s GitHub page.</>}{' '}
              Records already on the blockchain can&apos;t be removed.
            </p>
          </section>

          <div className="border-t border-border pt-6"><Link href="/" className={linkButton({ variant: 'outline' })}>Back to Pot</Link></div>
      </article>
    </Screen>
  );
}
