import type { CreatePotInitial } from './CreatePotForm';
import { templateById } from '@/lib/templates';

type SearchParams = Record<string, string | string[] | undefined>;

export type NewPotStart = { initial?: CreatePotInitial; titlePlaceholder?: string };

const first = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/**
 * What the new-pot form starts from. `?from=<potId>` runs a past pot again (an unknown or foreign pot gives an empty form);
 * otherwise `?template=<id>` starts from a template, with the name left empty to show its placeholder.
 */
export async function newPotStart(
  sp: SearchParams,
  loadPot: (potId: string) => Promise<CreatePotInitial | null>,
): Promise<NewPotStart> {
  const from = first(sp.from);
  if (from !== undefined) {
    const initial = await loadPot(from);
    return initial ? { initial } : {};
  }
  const template = templateById(first(sp.template) ?? '');
  if (!template) return {};
  return {
    initial: { objectionWindow: template.objectionWindow, requestWindow: template.requestWindow },
    titlePlaceholder: template.titlePlaceholder,
  };
}
