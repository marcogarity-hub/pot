#!/usr/bin/env node
// Removes end-to-end test data from Supabase before a demo.
//
// Usage:
//   node scripts/cleanup-test-data.mjs --pots 0,1,3 [--include-email <address>]... [--yes]
//
// DRY RUN unless --yes is passed. Deletes ONLY:
//   * auth users and `users` rows whose email ends with @pot-e2e.test (plus any --include-email you list),
//   * database rows (pot_events, pot_members, pot_invites, pot_meta, pots) for the pot ids you list with --pots.
// Nothing else. It never touches Circle wallets, the chain, prefund_ledger or any other table, and it never
// prints email addresses (counts only). The pot ids must be listed explicitly: there is no "delete all".
// Deleting a pot's rows is safe for test pots, because nothing re-delivers old events. Do NOT list a pot that
// a live demo or a QA run still needs.
//
// Tests: node --test scripts/*.test.mjs

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEST_DOMAIN = '@pot-e2e.test';
const POT_TABLES_CHILDREN_FIRST = ['pot_events', 'pot_members', 'pot_invites', 'pot_meta', 'pots'];
const USAGE = 'Usage: node scripts/cleanup-test-data.mjs --pots 0,1,3 [--include-email <address>]... [--yes]';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..', 'web');
const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

export function isTestEmail(email, extra = []) {
  const e = String(email ?? '').trim().toLowerCase();
  return e.endsWith(TEST_DOMAIN) || extra.map(x => x.trim().toLowerCase()).includes(e);
}

export function parseArgs(argv) {
  const args = { pots: [], includeEmails: [], yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
      i += 1;
      return next;
    };
    switch (flag) {
      case '--pots': {
        const raw = value();
        for (const part of raw.split(',')) {
          if (!/^\d+$/.test(part.trim())) throw new Error(`Invalid pot id "${part}": use whole numbers like 0,1,3`);
          args.pots.push(part.trim());
        }
        break;
      }
      case '--include-email':
        args.includeEmails.push(value());
        break;
      case '--yes':
        args.yes = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  args.pots = [...new Set(args.pots)];
  return args;
}

/** Splits rows into those that will be deleted and those that are kept, by email rule. Pure, for tests. */
export function planUsers(emails, includeEmails = []) {
  const doomed = [];
  const kept = [];
  for (const email of emails) (isTestEmail(email, includeEmails) ? doomed : kept).push(email);
  return { doomed, kept };
}

function loadEnv() {
  requireFromWeb('@next/env').loadEnvConfig(webDir);
}

async function countRows(db, table, column, values) {
  if (values.length === 0) return 0;
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true }).in(column, values);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function listAuthUsers(db) {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`auth users: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 200) break;
  }
  return all;
}

export async function run(argv) {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.log(USAGE);
      return 0;
    }
    if (args.pots.length === 0 && args.includeEmails.length === 0) {
      console.log('Nothing selected. Test accounts (@pot-e2e.test) are always included; add --pots to list pots.');
    }
    loadEnv();
    const { createClient } = requireFromWeb('@supabase/supabase-js');
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

    const authUsers = await listAuthUsers(db);
    const authPlan = planUsers(authUsers.map(u => u.email ?? ''), args.includeEmails);
    const rows = await db.from('users').select('id,email');
    if (rows.error) throw new Error(`users: ${rows.error.message}`);
    const rowPlan = planUsers(rows.data.map(r => r.email), args.includeEmails);

    console.log(args.yes ? 'DELETING' : 'DRY RUN (nothing will be deleted)');
    console.log(`auth users:   ${authPlan.doomed.length} to delete, ${authPlan.kept.length} kept`);
    console.log(`users rows:   ${rowPlan.doomed.length} to delete, ${rowPlan.kept.length} kept`);
    const counts = {};
    for (const table of POT_TABLES_CHILDREN_FIRST) {
      counts[table] = await countRows(db, table, 'pot_id', args.pots);
      console.log(`${table.padEnd(12)}  ${counts[table]} row(s) for pots [${args.pots.join(',')}]`);
    }
    if (!args.yes) {
      console.log('Re-run with --yes to delete exactly what is listed above.');
      return 0;
    }

    for (const table of POT_TABLES_CHILDREN_FIRST) {
      if (args.pots.length === 0) break;
      const { error } = await db.from(table).delete().in('pot_id', args.pots);
      if (error) throw new Error(`delete ${table}: ${error.message}`);
      console.log(`deleted ${table}`);
    }
    const doomedRowIds = rows.data.filter(r => isTestEmail(r.email, args.includeEmails)).map(r => r.id);
    if (doomedRowIds.length) {
      const { error } = await db.from('users').delete().in('id', doomedRowIds);
      if (error) throw new Error(`delete users: ${error.message}`);
      console.log(`deleted ${doomedRowIds.length} users row(s)`);
    }
    let removedAuth = 0;
    for (const u of authUsers.filter(u => isTestEmail(u.email, args.includeEmails))) {
      const { error } = await db.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`delete auth user: ${error.message}`);
      removedAuth += 1;
    }
    console.log(`deleted ${removedAuth} auth user(s)`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message.split(process.env.SUPABASE_SECRET_KEY ?? '\u0000').join('[redacted]')}`);
    if (message.startsWith('Unknown argument') || message.includes('needs a value') || message.startsWith('Invalid pot id')) console.error(USAGE);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
