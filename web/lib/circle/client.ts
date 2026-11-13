import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
export function circleClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error('Circle credentials unavailable');
  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}
