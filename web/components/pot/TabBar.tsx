import Link from 'next/link';
import { Bell, House, User, type LucideIcon } from 'lucide-react';

const TABS: Array<{ label: string; href: string; icon: LucideIcon; current?: boolean }> = [
  { label: 'Trips', href: '/', icon: House, current: true },
  { label: 'Activity', href: '#activity', icon: Bell },
  { label: 'You', href: '#you', icon: User },
];

/**
 * The phone's floating tab bar: a glass pill fixed above the home indicator. Phones only; from md up the
 * header carries the controls. Black and white only, with 44px+ targets. The current tab is marked with
 * aria-current and a solid black fill, so the state is not carried by colour alone.
 */
export function TabBar() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 z-40 px-4 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
      <ul className="glass mx-auto flex max-w-sm list-none items-stretch gap-1 rounded-full p-1.5">
        {TABS.map(({ label, href, icon: Icon, current }) => (
          <li key={label} className="flex-1">
            <Link
              href={href}
              aria-current={current ? 'page' : undefined}
              className={`flex h-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${current ? 'bg-foreground text-card' : 'text-foreground hover:bg-foreground/5'}`}
            >
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
