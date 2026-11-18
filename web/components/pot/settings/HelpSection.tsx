'use client';

import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from 'cn';
import { HELP_FAQ, HELP_INTRO, HELP_TITLE } from '@/lib/help/content';

/** Help for people new to blockchains: a short explanation, then questions that open with a plus. */
export function HelpSection() {
  const base = useId();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-[22px] font-semibold">{HELP_TITLE}</h2>
        {HELP_INTRO.map(paragraph => (
          <p key={paragraph} className="text-[17px] leading-relaxed text-foreground">{paragraph}</p>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-[17px] font-semibold">Common questions</h3>
        <ul className="divide-y divide-border rounded-group bg-card">
          {HELP_FAQ.map((item, i) => {
            const isOpen = open === i;
            const panelId = `${base}-panel-${i}`;
            return (
              <li key={item.question}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-14 w-full items-center justify-between gap-4 rounded-group px-4 py-3 text-left text-[17px] font-medium"
                >
                  <span>{item.question}</span>
                  {isOpen ? <Minus aria-hidden className="size-5 shrink-0 text-muted-foreground" /> : <Plus aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
                </button>
                <div id={panelId} role="region" hidden={!isOpen} className={cn('px-4 pb-4 text-[15px] leading-relaxed text-muted-foreground')}>
                  {item.answer}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
