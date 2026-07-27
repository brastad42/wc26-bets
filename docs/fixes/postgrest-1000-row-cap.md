# Fix: PostgREST's default 1000-row cap silently truncates `bets` queries

**Status:** Fixed (pattern applied in 3 places)

## Problem

Supabase's PostgREST layer caps `.select()` results at 1000 rows by default.
`bets` grows as `players × matches` (85 users × up to 104 matches = 8,840+ rows at
full tournament size), so any plain `.from('bets').select('*')` silently returns
only the first 1000 rows — no error, just quietly wrong totals. This first showed
up as incorrect numbers on the Awards/Stats page.

## Root cause

PostgREST enforces a default `max-rows` limit server-side. A single `.select()`
call has no way to signal "give me everything" — it just returns up to the cap.

## Solution

A paginated fetch loop using `.range(from, to)`, looping until a page comes back
shorter than the page size:

```js
async function fetchAllBets(supabase) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
```

## Where it's applied

- `app/(main)/stats/page.js` — `fetchAllBets` (origin of the pattern)
- `app/(main)/leaderboard/components/ProgressionView.js` — `fetchAllBets` (comment
  credits the stats page as the source)
- `app/admin/components/BetExport.js` — `fetchAllBets`

## Where it's deliberately NOT applied

`app/(main)/matches/page.js` avoids the problem entirely on the Matches page by
never fetching all bets at once — it fetches only the current user's bets for the
active stage, and fetches a single match's full bet list on demand only when
"View all players' bets" is expanded. This is cheaper than pagination and was the
right call there because the page never actually needs the full table.

## Note for future code

Any new feature that queries `bets` across all users/matches (not scoped to one
match or one user) needs this pattern or it will silently under-count once the
group grows or more stages are played. There is currently no shared
`fetchAllBets` module — it's copy-pasted 3×. Worth factoring into `lib/` if a 4th
consumer shows up.
