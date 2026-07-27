# Fix: recurring ESLint warning on async data-fetching `useEffect`s

**Status:** Fixed (as a standing pattern, applied whenever the issue recurs)

## Problem

Components that fetch data on mount kept triggering an ESLint
`react-hooks/exhaustive-deps`-adjacent warning, and in a couple of places actually
caused stale-closure bugs (a fetch function referencing a prop/state value from
the render it was defined in, not the latest one).

## Root cause

`useEffect`'s callback itself cannot be `async` (React expects either nothing or a
cleanup function returned, not a Promise). The natural-looking fix — define an
`async function fetchData() {...}` *outside* the `useEffect`, then call it
*inside* — reintroduces the exact problem ESLint is trying to catch: the outer
function closes over values from the render it was created in, and if it's not
listed as an effect dependency (usually because listing it would cause an
infinite loop of re-creation), the effect can silently run against stale data.

## Solution

Define the async function **inside** the `useEffect` body, and call it
immediately:

```js
useEffect(() => {
  async function loadData() {
    const { data } = await supabase.from('matches').select('*');
    setMatches(data);
  }
  loadData();
}, [stageId]); // dependency list only needs to name values the effect actually uses
```

This keeps the async function's closure scoped to that specific effect run, so it
always sees the dependency values from that render, and ESLint's exhaustive-deps
rule can correctly analyze what the effect depends on.

## Where it's applied

Recurring pattern across most client components that fetch on mount or on a
dependency change — Matches, Leaderboard, Stats/Awards, Chat, and the Admin
sub-components all follow this shape.

## Note for future code

When adding a new data-fetching `useEffect`, define the async function inside the
effect, not beside it. This has come up enough times across the codebase to
treat as a standing convention rather than a one-off fix.
