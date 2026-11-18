/** Starting points for a new pot. Windows are in seconds and sit inside the contract limits. First drafts: the owner refines them. */
export type PotTemplate = {
  label: string;
  /** Shown as the Name field's placeholder. The name itself stays empty so the organizer types it. */
  titlePlaceholder: string;
  objectionWindow: number;
  requestWindow: number;
};

const HOUR = 3600;
const DAY = 24 * HOUR;

export const TEMPLATES = {
  trip: { label: 'Weekend trip', titlePlaceholder: 'Cabin weekend', objectionWindow: 2 * DAY, requestWindow: 7 * DAY },
  dinner: { label: 'Group dinner', titlePlaceholder: 'Friday dinner', objectionWindow: HOUR, requestWindow: DAY },
  'group-order': { label: 'Group order', titlePlaceholder: 'Lunch order', objectionWindow: HOUR, requestWindow: DAY },
  rent: { label: 'Rent', titlePlaceholder: 'June rent', objectionWindow: 2 * DAY, requestWindow: 7 * DAY },
  gift: { label: 'Group gift', titlePlaceholder: 'Birthday gift', objectionWindow: 2 * DAY, requestWindow: 7 * DAY },
  tickets: { label: 'Event tickets', titlePlaceholder: 'Concert tickets', objectionWindow: DAY, requestWindow: 7 * DAY },
} satisfies Record<string, PotTemplate>;

export type TemplateId = keyof typeof TEMPLATES;

/** The template for an id from the URL, or undefined for anything unknown. */
export function templateById(id: string): PotTemplate | undefined {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, id) ? TEMPLATES[id as TemplateId] : undefined;
}
