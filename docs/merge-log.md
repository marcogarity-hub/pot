# Merge log

## 2026-11-12 — lane/events-data (Task 3.1, smoke test)
- Landed: supabase/migrations 20261113000000_init.sql + 20261113000100_rls_realtime.sql (users per A6, pot_meta, pot_invites, pot_events, pots, pot_members, pot_status view, RLS, realtime publication); applied to the hosted project.
- Gates: dry-run OK; real `db push` OK; `db lint --linked --fail-on error` clean; reviewer APPROVE (no blockers); main builds and tests pass after merge.

## 2026-11-12 — lane/events-data (Tasks 3.2, 3.3, 3.4 hook)
- Landed: decodePotLogs/foldPot, /api/streams with QuickNode HMAC + 5 MB cap, PotStore (memory + Supabase), apply_pot_projection migration (applied), usePot hook. Route returns 503 until Lane 1's ABI replaces abi-placeholder.ts.
- Gates: round 1 CHANGES (lint error, gzip cap) → fixed (conductor committed; worker sandbox couldn't write git lock); vitest 23/23, tsc, lint clean; db push + db lint clean; reviewer APPROVE.
