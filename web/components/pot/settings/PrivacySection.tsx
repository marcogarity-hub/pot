import Link from 'next/link';

/** Who sees what, in plain words. The full notice is on the privacy page. */
export function PrivacySection() {
  return (
    <div className="space-y-6">
      <h2 className="text-[28px] font-semibold">Privacy</h2>
      <div className="space-y-3 text-[15px] leading-relaxed">
        <p>Other members of your plans see the name you set. If you have not set one, they see a neutral &quot;Member&quot; label with a number, never your email address.</p>
        <p>Only a plan&apos;s organizer sees the email addresses they invited, and you always see your own.</p>
      </div>
      <Link href="/privacy" className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Read the full privacy notice
      </Link>
    </div>
  );
}
