# Fix: Leaderboard deadline banner deep-link ignored `?stage=` param

**Status:** Fixed

## Problem

The Leaderboard page shows a reminder banner when the currently-open stage's
first match kicks off within 48 hours, deep-linking to
`/matches?stage=<stage>` so the user lands directly on the right stage tab.
Clicking it, however, landed on whatever stage tab had last been viewed —
not the one in the URL.

## Root cause

The Matches page persists the active stage tab to `localStorage.matchesActiveStage`
and read that value on mount to decide which tab to show. The `?stage=` query
param was being read too, but the localStorage value was applied afterward, so it
silently won and overwrote the URL's intent.

## Solution

On mount, the Matches page now checks the URL `?stage=` param **first**; only
falls back to `localStorage.matchesActiveStage` if no query param is present.
Once a stage is selected (from either source), it's written back to localStorage
so normal tab navigation still persists as before.

## Where it's applied

- `app/(main)/matches/page.js` — stage-selection logic on mount
- `app/(main)/leaderboard/page.js` — `getUpcomingDeadline` banner, links to
  `/matches?stage=<stage>`

## Note for future code

Any future deep link into Matches with a stage param needs to go through this
same "URL wins over localStorage on initial load" order — it's easy to
accidentally reverse the precedence when adding a new entry point.
