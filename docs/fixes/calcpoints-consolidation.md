# Fix: `calcPoints` consolidated from 5 independent implementations into one

**Status:** Fixed

## Problem

The core scoring rule (3 pts exact, 1 pt correct outcome, 0 pts otherwise) was
implemented from scratch in 5 separate places — 4× in JavaScript, 1× in SQL —
with no shared source of truth. All 5 happened to agree in practice, but any
future change to the scoring rule would have required finding and editing all 5
correctly, with no compiler or test to catch a missed spot.

## Root cause

The logic is small enough (a handful of comparisons) that it was easiest, each
time a new feature needed it, to just write it again locally rather than import
it from somewhere. Nothing forced convergence — it worked purely because nobody
had changed the rule since the app was first built.

## Solution

1. Created `lib/scoring.js` exporting a single `calcPoints(match, betHome, betAway)`.
2. `MatchCard.js`, `ProgressionView.js`, and `BetExport.js` — which already had
   byte-identical logic — now import this function; their local copies (and the
   "must stay in sync with MatchCard.js" comment in `ProgressionView.js`) were
   deleted.
3. `stats/page.js` had the one real divergence: it called its local
   `calcPoints` with a **different, reversed argument order**
   (`resultHome, resultAway, betHome, betAway` instead of `match, betHome,
   betAway`), and didn't have an explicit "no result yet" null check. Verified
   during Step 0 that this wasn't a behavioral difference — the caller in
   `stats/page.js` only ever invoked `calcPoints` on matches that already had a
   result, so the missing null check was dead code, not a bug. The call site
   was updated to the shared function's argument order
   (`calcPoints(m, bet.bet_home, bet.bet_away)`); no scoring outputs changed.
4. `get_leaderboard()` in `supabase/setup.sql` keeps its own SQL implementation
   (Postgres can't import a JS module) but now has a comment directly above the
   `CASE` logic pointing at `lib/scoring.js` as the canonical definition, so a
   future rule change is flagged in both places instead of silently drifting.

## Where it's applied

- `lib/scoring.js` — new shared module (single source of truth for JS)
- `app/(main)/matches/components/MatchCard.js`
- `app/(main)/leaderboard/components/ProgressionView.js`
- `app/admin/components/BetExport.js`
- `app/(main)/stats/page.js`
- `supabase/setup.sql` — `get_leaderboard()`, comment only, SQL logic unchanged

## What did NOT change

- No scoring outputs changed for any existing match/bet — confirmed all 4 JS
  versions were logically identical before the refactor (the `stats/page.js`
  argument order was a style difference, not a logic difference).
- `GroupStandings.js` tiebreak logic (group table standings from match results)
  is a separate calculation and was untouched.
- No manual SQL step was required for this task — unlike the leaderboard
  tiebreak fix, `get_leaderboard()`'s return type and logic didn't change here,
  only a comment, so nothing needed to be re-run against the live database.

## Note for future code

Any new feature needing per-bet scoring should import `calcPoints` from
`lib/scoring.js` rather than writing it locally again. If the scoring rule
itself ever changes, both `lib/scoring.js` and the `CASE` logic inside
`get_leaderboard()` in `supabase/setup.sql` need to be updated together — the
SQL function can't import the JS module, so this pairing has to be kept in sync
by hand and re-applied to the live database via the Supabase SQL Editor (see
`docs/fixes/foreign-key-cascade-verification.md` for the general reminder that
`setup.sql` describes intent, not live state, until it's actually run against
the live database).
