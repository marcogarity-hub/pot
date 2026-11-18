import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The demo is for sharing a link, not for search results.
export const metadata: Metadata = {
  title: 'Pot demo',
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
