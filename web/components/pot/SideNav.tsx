import Link from 'next/link';
import { Bell, House, Plus, User, type LucideIcon } from 'lucide-react';
import { linkButton } from './linkButton';
import { PotMark } from './PotMark';
import { FaceDot, type Face } from './Faces';

export type SidePot = { id: string; title: string };

const SECTIONS: Array<{ label: string; href: string; icon: LucideIcon; current?: boolean }> = [
  { label: 'Trips', href: '/', icon: House, current: true },
  { label: 'Activity', href: '#activity', icon: Bell },
  { label: 'You', href: '#you', icon: User },
];

const ITEM = 'flex min-h-11 items-center gap-3 rounded-full px-3 text-[15px] transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * The desktop app shell: a floating glass sidebar with the wordmark, the three sections, the viewer's
 * pots as a short list (one dot each), the coral New pot action and the viewer at the bottom.
 * Desktop only (md and up); the phone uses the header and TabBar instead.
 */
export function SideNav({ pots, name, email }: { pots: SidePot[]; name: string | null; email: string }) {
  const face: Face = { seat: 1, name, email, paid: true };
  return (
    <aside aria-label="Sidebar" className="glass hidden rounded-group p-4 md:fixed md:inset-y-4 md:left-4 md:z-30 md:flex md:w-[232px] md:flex-col">
      <Link href="/" className="flex items-center gap-2 px-3 pb-4 pt-1 text-[17px] font-bold tracking-tight">
        <PotMark />
        Pot
      </Link>
      <nav aria-label="Sections">
        <ul className="space-y-1">
          {SECTIONS.map(({ label, href, icon: Icon, current }) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`${ITEM} font-medium ${current ? 'bg-foreground/5' : ''}`}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {pots.length > 0 && (
        <nav aria-label="Your trips" className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[13px] text-muted-foreground">Your trips</p>
          <ul className="space-y-1">
            {pots.map((p, i) => (
              <li key={p.id}>
                <Link href={`/pots/${p.id}`} className={ITEM}>
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--face-${(i % 6) + 1})` }} />
                  <span className="truncate">{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="mt-auto space-y-3 pt-6">
        <Link href="/new" className={linkButton({ size: 'lg', className: 'w-full' })}>
          <Plus className="size-5" strokeWidth={2} aria-hidden />
          New pot
        </Link>
        <Link href="#you" className={ITEM}>
          <FaceDot face={face} size="sm" />
          <span className="truncate">{name ?? email}</span>
        </Link>
      </div>
    </aside>
  );
}
