import Link from 'next/link';
import { linkButton } from './linkButton';
import { TEMPLATES } from '@/lib/templates';

/** One tap from a template into the create form. Secondary styling: the coral action stays with the strip. */
export function QuickStart() {
  return (
    <section aria-labelledby="quick-start" className="space-y-3">
      <h2 id="quick-start" className="text-[22px] font-semibold">Start something new</h2>
      <ul className="flex flex-wrap gap-2">
        {Object.entries(TEMPLATES).map(([id, template]) => (
          <li key={id}>
            <Link href={`/new?template=${id}`} className={linkButton({ variant: 'secondary' })}>{template.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
