# Fix: verifying `ON DELETE CASCADE` actually exists on live Supabase, not just in setup.sql

**Status:** Fixed (diagnostic pattern; re-applied via migration when a mismatch is found)

## Problem

`setup.sql` declares `ON DELETE CASCADE` on `bets.user_id`, `messages.user_id`,
and `reactions.user_id`, so that removing a user cleans up their dependent rows.
But a live Supabase database doesn't necessarily match the current `setup.sql` —
if the project was created, then the constraint was added/changed later without
re-running the full script against that specific database, the live constraint
can silently be plain `ON DELETE NO ACTION` (the Postgres default) instead.

## Root cause

`setup.sql` is a **setup script**, not a migration log — running it once creates
the schema as of that moment, but there's no built-in mechanism that verifies a
given live database still matches the file. Manual edits made directly in the
Supabase SQL editor (rather than by re-running the updated `setup.sql`) are the
usual way live drifts from the file.

## Solution

Check the live constraint's actual delete behavior directly, rather than trusting
`setup.sql`:

```sql
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname IN (
  'bets_user_id_fkey',
  'messages_user_id_fkey',
  'reactions_user_id_fkey'
);
```

`confdeltype = 'c'` means `CASCADE` is actually in effect; anything else (`'a'`
= NO ACTION, `'r'` = RESTRICT, etc.) means the live database doesn't match
`setup.sql` and needs the constraint dropped and recreated with
`ON DELETE CASCADE` directly against that database.

## Where it's applied

- `supabase/setup.sql` — declares the intended cascade behavior
- Verification is a manual SQL Editor step, not automated in any script

## Note for future code

`setup.sql` describes the *intended* schema for a fresh instance. For the live
project, treat it as documentation to diff against, not as proof of current
state — especially for constraints, which are easy to change ad hoc in the
Supabase dashboard without anyone updating the file. Worth re-running this
`pg_constraint` check after any manual dashboard schema change.
