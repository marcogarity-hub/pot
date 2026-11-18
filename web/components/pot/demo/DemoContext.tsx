'use client';

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import type { HistoryItem } from '../historyModel';

/** What the demo feeds to the screens that normally load their own data. */
export type DemoContextValue = { history: HistoryItem[]; wallet: string; email: string };

const DemoContext = createContext<DemoContextValue | null>(null);

/** Wraps a page in demo mode. Outside it, `useDemo()` is null and every screen behaves as the real app. */
export function DemoProvider({ value, children }: { value: DemoContextValue; children: ReactNode }) {
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** The demo's data, or null in the real app. */
export function useDemo(): DemoContextValue | null {
  return useContext(DemoContext);
}

const DEMO_PAGES = new Set(['/history', '/wallet', '/help']);

/**
 * Where a real route lives inside the demo. `/` is the demo dashboard, `/pots/<id>` a demo plan, `/new`
 * (with any query) the demo's "can't start a plan here" page. Anything else (sign-in, privacy, `#anchors`)
 * is left alone.
 */
export function demoPath(path: string): string {
  const end = path.search(/[?#]/);
  const pathname = end === -1 ? path : path.slice(0, end);
  if (pathname === '/') return '/demo';
  if (pathname.startsWith('/pots/')) return `/demo${pathname}`;
  if (pathname === '/new') return '/demo/new';
  if (DEMO_PAGES.has(pathname)) return `/demo${path}`;
  return path;
}

/** Maps a real route to its demo twin inside the demo, and returns it unchanged in the real app. */
export function useHref(): (path: string) => string {
  const demo = useContext(DemoContext);
  return demo ? demoPath : identity;
}

const identity = (path: string): string => path;

/** A `Link` that stays inside the demo while in it. Same as `Link` everywhere else. */
export function AppLink({ href, ...props }: ComponentProps<typeof Link>) {
  const toHref = useHref();
  return <Link href={typeof href === 'string' ? toHref(href) : href} {...props} />;
}
