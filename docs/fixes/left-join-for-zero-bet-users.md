# Fix: Users with zero bets disappeared from the leaderboard

**Status:** Fixed

## Problem

New users who joined but hadn't placed any bets yet were missing from the
leaderboard entirely, instead of showing up at the bottom with 0 points.

## Root cause

An early version of the leaderboard query joined `users` to `bets` and then
filtered on a `bets`-table column (e.g. matching against a result). Putting that
filter in a `WHERE` clause after an implicit inner join has the same effect as an
`INNER JOIN` — any user with zero matching `bets` rows gets dropped from the
result set entirely, because there's no `bets` row for the `WHERE` clause to
evaluate against.

## Solution

`get_leaderboard()` uses `LEFT JOIN bets b ON b.user_id = u.id` (user stays even
with no bets) `LEFT JOIN matches m ON m.id = b.match_id`, and any
per-row scoring logic lives inside the `SELECT`'s `CASE` expression / aggregate,
**not** in a `WHERE` clause on the joined tables. This way a user contributes 0 to
the `SUM` when they have no bets, rather than being excluded from the result set.

## Where it's applied

- `supabase/setup.sql` — `get_leaderboard()` function

## Note for future code

Any new query joining `users` to `bets` (or `matches`) needs the filter condition
moved into the `JOIN ... ON` clause (or the aggregate's `CASE`), not into a
trailing `WHERE`, whenever "show every user, even with zero rows on the other
side" is the intended behavior. This is a general SQL gotcha, not specific to this
schema, but has bitten this codebase more than once.
