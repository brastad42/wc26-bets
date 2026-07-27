# wc26-bets — Full Code Audit
Snapshot date: 2026-07-25. Read-only investigation, no code changes. All line numbers refer to the files as they exist at this commit (`main`, HEAD `7179fca`).

**Note:** No `CLAUDE.md` file exists anywhere in this repository (confirmed via recursive glob for `**/CLAUDE.md` — zero matches). Sections 5 and 10, which the task template asks to cross-check against CLAUDE.md, are reported as "not applicable" for that reason.

---

## 1. Database schema (as implemented)

Source: [supabase/setup.sql](../supabase/setup.sql) — this is the only schema source in the repo (no migrations directory, no ORM schema file). Extension: `pgcrypto` (for `gen_random_uuid()`).

### `competitions`
| column | type | constraints |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL |
| join_code | text | NOT NULL, UNIQUE |

Seeded with one row: `('World Cup 2026', 'wc26')` (setup.sql:264-266). The app is single-competition in practice — every admin component fetches the competition via `.select('id').single()` with no filter (e.g. [CsvImport.js:22-27](../app/admin/components/CsvImport.js#L22), [StageManager.js:15-18](../app/admin/components/StageManager.js#L15)), which only works because exactly one row exists.

### `users`
| column | type | constraints |
|---|---|---|
| id | uuid | PK |
| competition_id | uuid | NOT NULL, FK → competitions, ON DELETE CASCADE |
| alias | text | NOT NULL |
| email | text | NOT NULL |
| country_code | text | nullable |
| is_active | boolean | NOT NULL DEFAULT true |

Unique constraints: `(alias, competition_id)`, `(email, competition_id)`. `country_code` is free text — no CHECK constraint; the app writes both uppercase ISO-3166 codes (from the `countries-list` package, e.g. `US`) and custom lowercase hyphenated codes (`gb-eng`, `gb-nir`, `gb-sct`, `gb-wls`) — see [join/page.js:8-18](../app/join/page.js#L8).

### `stages`
| column | type | constraints |
|---|---|---|
| id | uuid | PK |
| competition_id | uuid | NOT NULL, FK → competitions, CASCADE |
| stage | text | NOT NULL — one of `Group`/`R32`/`R16`/`QF`/`SF`/`Final` by convention, not enforced by CHECK |
| is_open | boolean | NOT NULL DEFAULT true |
| locked_at | timestamptz | nullable |
| opened_at | timestamptz | nullable |

Unique: `(competition_id, stage)`. Seeded with 6 rows, all `is_open = true` (setup.sql:268-281).

### `matches`
| column | type | constraints |
|---|---|---|
| id | uuid | PK |
| competition_id | uuid | NOT NULL, FK → competitions, CASCADE |
| match_no | integer | NOT NULL, UNIQUE — natural upsert key for CSV import |
| stage | text | NOT NULL |
| match_group | text | nullable — `'A'`..`'L'` for group stage, NULL for knockouts |
| home_team | text | NOT NULL |
| away_team | text | NOT NULL |
| match_time | timestamptz | NOT NULL |
| result_home | integer | nullable — NULL until admin enters result |
| result_away | integer | nullable |

### `bets`
| column | type | constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | NOT NULL, FK → users, CASCADE |
| match_id | uuid | NOT NULL, FK → matches, CASCADE |
| bet_home | integer | NOT NULL |
| bet_away | integer | NOT NULL |
| created_at | timestamptz | NOT NULL DEFAULT now() |

Unique: `(user_id, match_id)` — enables `upsert(..., { onConflict: 'user_id,match_id' })` in [MatchCard.js:78-81](../app/(main)/matches/components/MatchCard.js#L78).

### `messages`
| column | type | constraints |
|---|---|---|
| id | uuid | PK |
| competition_id | uuid | NOT NULL, FK → competitions, CASCADE |
| user_id | uuid | NOT NULL, FK → users, CASCADE |
| content | text | NOT NULL |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| is_deleted | boolean | NOT NULL DEFAULT false — soft delete flag |

### `reactions`
| column | type | constraints |
|---|---|---|
| id | uuid | PK |
| message_id | uuid | NOT NULL, FK → messages, CASCADE |
| user_id | uuid | NOT NULL, FK → users, CASCADE |
| emoji | text | NOT NULL |

Unique: `(message_id, user_id, emoji)`. Toggled via insert/delete in the client, not update (chat/page.js:222-232).

### `settings`
| column | type | constraints |
|---|---|---|
| key | text | PK |
| value | jsonb | NOT NULL |

Currently holds one row, `key = 'rules'`, whose `value` is a JSON array of `{ title, body }` objects — see Section 3 (Rules).

### Realtime
`messages` and `reactions` are added to the `supabase_realtime` publication (setup.sql:115-116) — this is what powers live chat updates.

### `get_leaderboard()` DB function
`LANGUAGE sql, SECURITY DEFINER, STABLE`, granted to `anon` (setup.sql:129-167). Returns `(id, alias, total_points, total_exact)` — one row per **active** user (`WHERE u.is_active = true`), computed via `LEFT JOIN bets b ON b.user_id = u.id LEFT JOIN matches m ON m.id = b.match_id`, aggregated with a `CASE` that mirrors the client-side `calcPoints()` (see Section 4).

### Row Level Security
RLS is enabled on every table. Per the header comment (setup.sql:14-18), the app does **not** use Supabase Auth — everything runs under the shared `anon` key, and ownership enforcement ("only your own bets") is done in JavaScript, not in Postgres. Every table's policies grant `anon` unrestricted `USING (true)` / `WITH CHECK (true)` for whichever of SELECT/INSERT/UPDATE/DELETE it needs (setup.sql:199-257) — i.e., RLS here restricts *what operations exist*, not *whose rows* they touch. See Section 6 for the practical implications.

### Schema vs. code — cross-check result
No field-name or type mismatches found between `setup.sql` and the columns/tables actually referenced in `.select()`/`.insert()`/`.update()` calls across `app/` and `lib/`. Every column the client code reads or writes exists in setup.sql with a matching name.

---

## 2. Pages & routes

App Router (Next.js 16.2.1), two layout branches: `app/(main)/*` (route group, shares [app/(main)/layout.js](../app/(main)/layout.js) which wraps children in `ScrollReset` + `AuthGuard` + `TabBar`), and standalone routes (`/`, `/join`, `/admin`) that opt out of that chrome.

| Route | File | Renders / does |
|---|---|---|
| `/` | [app/page.js](../app/page.js) | No UI — unconditionally `redirect('/join')` server-side, regardless of whether a `userId` already exists in localStorage. |
| `/join` | [app/join/page.js](../app/join/page.js) | Two-mode form: "Create account" (alias + email + optional nationality + join code → insert into `users`) or "Sign in" (email + join code → lookup existing `users` row). On success writes `userId` + `competitionId` to localStorage and routes to `/matches`. |
| `/matches` | [app/(main)/matches/page.js](../app/(main)/matches/page.js) | Stage-tabbed match list with betting UI. See Section 3. |
| `/leaderboard` | [app/(main)/leaderboard/page.js](../app/(main)/leaderboard/page.js) | Ranked list of all active users by points, plus a "Progression" chart view. |
| `/stats` | [app/(main)/stats/page.js](../app/(main)/stats/page.js) | Labeled **"Awards"** in the UI and in the tab bar — the route/file name (`stats`) does not match the on-screen title. Player/team/match "superlative" awards computed client-side. |
| `/chat` | [app/(main)/chat/page.js](../app/(main)/chat/page.js) | Realtime group chat with emoji reactions. |
| `/rules` | [app/(main)/rules/page.js](../app/(main)/rules/page.js) | Server component rendering rule sections from the `settings` table (or hardcoded defaults). |
| `/admin` | [app/admin/page.js](../app/admin/page.js) | Code-gated admin console (see Section 6). Not wrapped by `AuthGuard`/`TabBar` — has its own layout entirely. |

### Nav vs. code mismatches
- [TabBar.js:5-11](../app/components/TabBar.js#L5) lists exactly 5 tabs: Matches, Leaderboard, Awards (→`/stats`), Chat, Rules. `/admin` is a real, working route but **is not in the nav** — reachable only by typing the URL directly.
- `/join` is also not in the nav (by design — it's the pre-auth entry point, and `LogoutButton` on every page routes back to it).
- No `/admin` link anywhere in the authenticated app; no visible "you are admin" state.

---

## 3. Key features implemented

### Matches ([app/(main)/matches/page.js](../app/(main)/matches/page.js) + [components/MatchCard.js](../app/(main)/matches/components/MatchCard.js) + [components/GroupStandings.js](../app/(main)/matches/components/GroupStandings.js))
- Stage tabs (Group/R32/R16/QF/SF/Final): click-to-switch or **swipe left/right** via [useSwipeStage.js](../app/hooks/useSwipeStage.js) — custom touch/mouse gesture hook with axis-locking, boundary resistance, and a bounce-back animation at the first/last stage (matches/page.js:171-176).
- Active stage persisted to `localStorage.matchesActiveStage`; also readable/settable via `?stage=` query param (used by the leaderboard's deadline-reminder banner deep link).
- Per-stage data cached in a `useRef` (`stageCache`) so switching tabs back and forth doesn't refetch (matches/page.js:109-141).
- Group-stage-only sort toggle, persisted to `localStorage.matchesSortMode`: **Groups** (grouped by `match_group`, collapsible — default collapsed, state in `sessionStorage.collapsedGroups`), **Date** (grouped by Oslo-timezone day, auto-scrolls to today's group or the next unplayed day on load), **Tables** (renders `GroupStandings` instead of match cards).
- Collapsed group chips show mini flag row (first 4 teams seen) + a "played/total" badge (matches/page.js:366-386).
- Bet progress banner ("Bets placed X/Y") shown only when stage is open and sort mode isn't "Tables".
- `MatchCard`: score inputs (open stage) with upsert-on-conflict save; locked stage shows the user's own bet + points, and an expandable "View all players bets" panel (fetched on demand per match) sorted by points desc/alias, with DNS for players who didn't bet, plus a "Most popular bet" banner (client-computed mode of all bets on that match, handles 2-way ties).
- Team flags rendered from `flagcdn.com` via a hardcoded team-name → ISO-code lookup table (`FLAGS`), duplicated verbatim in three files (see Section 11).

### Group Standings ([GroupStandings.js](../app/(main)/matches/components/GroupStandings.js))
- Full FIFA-style group table computed client-side from match results only (bets never factor in) — played/won/drawn/lost/GD/Pts per team.
- Tiebreak sequence for teams level on points: head-to-head points → head-to-head goal difference → head-to-head goals-for (computed only from matches between the tied teams) → overall goal difference → overall goals-for → alphabetical (`computeH2H`/`sortTiedSubgroup`/`sortGroupStandings`, lines 36-116).
- 3-letter FIFA-style team codes via a hardcoded `TEAM_CODES` map, falling back to the team name's first 3 letters uppercased if not in the map.

### Leaderboard ([leaderboard/page.js](../app/(main)/leaderboard/page.js) + [components/ProgressionView.js](../app/(main)/leaderboard/components/ProgressionView.js))
- List/Progression toggle persisted to `localStorage.leaderboardView`.
- Manual "↻ Refresh" button that remounts the content component via a `key={nonce}` trick (page.js:38,57-63,90).
- **Upcoming-deadline reminder banner**: shown when the currently-open stage's first match kicks off within 48 hours; links to `/matches?stage=<stage>` (`getUpcomingDeadline`, lines 10-35).
- List view: rank computed with shared-rank ("1, 2, 2, 4…") for exact ties on (points, exact); 🥇🥈🥉 medals for top 3; current user row highlighted + labeled "(you)"; per-user country flag if `country_code` is set.
- Progression view: multi-select player picker (search + dropdown, max 10 selected, persisted to `localStorage.leaderboardProgressionSelected`), Recharts `LineChart` of cumulative points per match index with alternating shaded `ReferenceArea` bands per stage, custom tooltip that re-ranks the selected players at that specific match index, horizontal auto-scroll to the end of the current/most-recently-played stage, and a fade overlay when scrolled right.
- Progression pulls **all** bets (not just the selected players') via a paginated fetch loop that works around Supabase/PostgREST's 1000-row cap (`fetchAllBets`, lines 26-41) — same pattern as Stats and BetExport (see Section 5).

### Awards ("Stats") ([stats/page.js](../app/(main)/stats/page.js))
- Route file is `stats/page.js`; on-screen and tab-bar label is "Awards".
- 12 player awards, 4 team awards, 3 match awards, all computed client-side in `computeStats()` from all bets + all matches + eligible users (lines 13-341): Legendary Optimist / Duke of Dullness (most/fewest total goals predicted), Diplomat of Draws, High-stakes Hero (3+ goal margin bets), The Maverick / The Sheep (least/most often matching the per-match majority bet), On Fire (longest correct-outcome streak), Perfect Run (longest exact-score streak), Losing Streak (longest 0-point streak — DNS counts as 0 but doesn't break the streak), WTF (single highest-total-goals bet), Far Out (single bet farthest from actual result), Unlucky Loser(s) (most 1-goal-off near-misses, supports a tied multi-winner list); team: The Favourite / Nobody's Darling (most/fewest backed to win), The Underrated / The Overrated (gap between predicted backing and actual result); match: Least Consensus, Most Consensus, Most Surprising.
- Eligibility filter: only users who placed bets on ≥50% of locked-stage matches count toward awards (`threshold = lockedMatches.length * 0.5`, lines 433-436).
- All award values hidden until at least one stage has been locked (`statsVisible`, lines 426-430).
- Manual refresh button (same `nonce` remount pattern as Leaderboard).
- Also uses the paginated `fetchAllBets()` >1000-row workaround (lines 387-402).

### Chat ([chat/page.js](../app/(main)/chat/page.js))
- Realtime updates via a Supabase Realtime channel (`chat-v2`) subscribed to `postgres_changes` INSERT/UPDATE/DELETE on `messages` and INSERT/DELETE on `reactions` (lines 147-192).
- Cursor-based backward pagination ("load older on scroll-to-top"), `PAGE_SIZE = 50`, using `created_at` as the cursor (`loadOlderMessages`, lines 103-145).
- Scroll position preserved across prepends via `useLayoutEffect` + a saved `scrollHeight` (lines 45-50, 134).
- Auto-scroll-to-bottom on new incoming message only if the user is already within 200px of the bottom (lines 157-161).
- Floating "↓ scroll to bottom" button appears once scrolled >200px from bottom.
- Long-press (500ms, mouse and touch) on a message bubble opens an emoji reaction picker; tap an emoji to toggle; reaction pills grouped by emoji with a count, highlighted if the current user reacted.
- Soft-delete aware: messages with `is_deleted = true` are filtered out of the initial fetch and removed live via the realtime UPDATE handler (used by the admin Chat Manager).

### Rules ([rules/page.js](../app/(main)/rules/page.js))
- **Server component** (async, no `'use client'`) — the only page that isn't client-rendered.
- Instantiates its own `createClient(...)` call directly (rules/page.js:61-64) rather than importing the shared `lib/supabase.js` client.
- `export const revalidate = 3600` — statically regenerated at most once per hour (ISR), not live.
- Reads `settings` row where `key = 'rules'` (a JSON array of `{title, body}`); falls back to a hardcoded `DEFAULT_SECTIONS` array (lines 25-58) if no row exists.
- Renders each section's `body` as Markdown, **one line at a time** — the body string is split on `\n` and each non-empty line gets its own `<ReactMarkdown>` call (lines 117-121), with blank lines rendered as spacer `<p>`s.
- The section whose title contains "scor" (case-insensitive) gets a hardcoded 3pt/1pt/0pt color-coded legend block injected above its body (lines 77-79, 101-116).

### Admin ([admin/page.js](../app/admin/page.js) + [admin/components/*](../app/admin/components/))
- Client-side gate only: entered code is compared in-browser to `process.env.NEXT_PUBLIC_ADMIN_CODE` (admin/page.js:13,20-26) — see Section 6 for the security implication of a `NEXT_PUBLIC_` var.
- Collapsible sections (`AdminSection`, expand/collapse state per section, "Stages" starts collapsed, rest start expanded):
  - **StageManager** — toggle each of the 6 fixed stages open/locked; sets `locked_at`/`opened_at` timestamps; inserts a stage row if one doesn't exist yet.
  - **ResultManager** — per-stage tabs, enter/update `result_home`/`result_away` per match.
  - **CsvImport** — client-side CSV parsing (naive `split(',')`, no quoted-field handling), preview table, then `upsert(rows, { onConflict: 'match_no' })`.
  - **BetExport** — downloads a CSV with one row per (match × active user), including computed points/exact/DNS, using the paginated >1000-row bet fetch.
  - **UserManager** — rename alias, deactivate/reactivate (`is_active` toggle) — shows **all** users regardless of active status.
  - **ChatManager** — lists non-deleted messages, "Delete" soft-deletes via `is_deleted = true`; is the only file in the codebase that calls `.schema('public')` explicitly before `.from(...)` (ChatManager.js:44-46).
  - **RulesManager** — edit the `settings.rules` JSON sections (title/body textareas per section), save via upsert.

### Auth / Join
- No signup email verification, no password — "auth" is alias + email + join code (new) or email + join code (returning), see Section 6.

---

## 4. Scoring & business logic

### Match points
Canonical rule (mirrored in 5 independent places — see Section 11 for the duplication list):
- **3 points**: `bet_home === result_home && bet_away === result_away` (exact score)
- **1 point**: `sign(bet_home - bet_away) === sign(result_home - result_away)` (correct outcome: win/draw/loss) but not exact
- **0 points**: otherwise, or no bet placed at all (DNS)
- A match with no result yet (`result_home IS NULL`) contributes 0 to any total.

Client implementations: [MatchCard.js:28-35](../app/(main)/matches/components/MatchCard.js#L28) (`calcPoints(match, betHome, betAway)`), [ProgressionView.js:16-23](../app/(main)/leaderboard/components/ProgressionView.js#L16) (same signature, comment explicitly notes "Must stay in sync with calcPoints in MatchCard.js"), [stats/page.js:7-11](../app/(main)/stats/page.js#L7) (different signature: `calcPoints(resultHome, resultAway, betHome, betAway)`), [BetExport.js:6-13](../app/admin/components/BetExport.js#L6) (same shape as MatchCard's). Server implementation: `get_leaderboard()` in [setup.sql:140-159](../supabase/setup.sql#L140).

### Leaderboard ranking & tiebreak
`get_leaderboard()` (setup.sql:129-165) returns `(id, alias, total_points, total_exact)` for active users only. Client-side sort in [leaderboard/page.js:200-204](../app/(main)/leaderboard/page.js#L200):
1. `total_points` descending
2. `total_exact` descending
3. `alias` ascending (alphabetical, final tiebreak)

Shared rank is assigned when both `total_points` and `total_exact` match (lines 205-213) — tied users get the same rank number and the next rank skips accordingly.

**Note:** the Rules copy ([rules/page.js:52](../app/(main)/rules/page.js#L52) body text, duplicated in [RulesManager.js:33](../app/admin/components/RulesManager.js#L33)) states the tiebreak order is *"Total points · Total exact hits · Exact hits by stage in order: Group → R32 → R16 → QF → SF → Final"* — but no such per-stage tiebreak exists anywhere in the code; the actual third tiebreak is alphabetical alias. See Section 11.

### Group standings tiebreak
Separate from leaderboard scoring — see `GroupStandings.js` description in Section 3. Uses actual match results only (never bets), full FIFA-style head-to-head sequence.

### DNS (did not submit)
Not a distinct code path — it falls out naturally from `LEFT JOIN bets` in `get_leaderboard()` and from `bets.find(...)` returning `undefined` in client code: a user with no bet row for a match simply contributes 0 points for it, regardless of *why* (missed deadline vs. never intended to bet). No code differentiates "missed the deadline" from "chose not to bet" — both are indistinguishable DNS states.

### Stage lock enforcement
Whether betting is allowed is driven entirely by `stages.is_open`, read once into a `stageStatus` map in `MatchesPage` (matches/page.js:148-155) and used to decide whether `MatchCard` shows an input form (`status === 'open'`) or a locked/read-only view. **This is UI-only** — the `bets` table's RLS policy grants `anon` unrestricted INSERT/UPDATE (setup.sql:230-233) with no reference to `stages.is_open`, so nothing in the database itself prevents a bet being written after a stage locks; enforcement is entirely in the client.

---

## 5. Known patterns & gotchas (as currently implemented)

No `CLAUDE.md` exists to cross-check against (see top of report), so everything below is newly documented from the code rather than confirmed/updated against prior documentation.

- **PostgREST 1000-row cap workaround.** `bets` can exceed Supabase's default 1000-row `.select()` cap once there are enough players × matches. Three places independently implement the same paginated `range()` loop to fetch *all* bets: [stats/page.js:387-402](../app/(main)/stats/page.js#L387) (`fetchAllBets`), [ProgressionView.js:26-41](../app/(main)/leaderboard/components/ProgressionView.js#L26) (`fetchAllBets`, comment credits the stats page as the origin of the pattern), [BetExport.js:31-42](../app/admin/components/BetExport.js#L31) (`fetchAllBets`). By contrast, `MatchesPage.fetchStage` (matches/page.js:109-141) deliberately avoids the problem by only ever fetching the *current user's* bets for the active stage server-side, then fetching a single match's full bet list on demand when "View all players bets" is expanded (MatchCard.js:200-206) — i.e. two different strategies for the same underlying row-cap constraint, chosen per page based on whether "all bets, all matches" data is actually needed.
- **Single-competition assumption.** Every `competitions` lookup in admin components does `.select('id').single()` with no `WHERE` clause (e.g. CsvImport.js:22-27, StageManager.js:15-18) — correct only because the seed data guarantees exactly one row. Nothing enforces this at the schema level (no partial unique index / check preventing a second competition row); the schema *supports* multi-competition (users, stages, matches all have `competition_id`), but the app code does not use that support anywhere in client fetches (matches/leaderboard/chat all query without filtering by `competition_id`).
- **Duplicated `FLAGS` team→ISO-code map.** Verbatim-identical object literal in [matches/page.js:13-26](../app/(main)/matches/page.js#L13), [MatchCard.js:7-20](../app/(main)/matches/components/MatchCard.js#L7), and [GroupStandings.js:19-32](../app/(main)/matches/components/GroupStandings.js#L19) — no shared constants module.
- **Duplicated scoring logic.** See Section 4 — 4 JS implementations + 1 SQL implementation of the same points rule, no single source of truth.
- **`country_code` casing is mixed.** Values from the `countries-list` package are uppercase (`US`), while the four custom UK-nation entries in `join/page.js:8-13` are lowercase-hyphenated (`gb-eng`). The leaderboard's flag renderer explicitly lowercases before building the `flagcdn.com` URL ([leaderboard/page.js:231](../app/(main)/leaderboard/page.js#L231)) to paper over this; other consumers of `country_code` would need to do the same.
- **`users` fetches are inconsistently filtered by `is_active`.** `get_leaderboard()` filters server-side (`WHERE u.is_active = true`); `stats/page.js:415` filters client-side (`.eq('is_active', true)`); `BetExport.js:55` filters too. But `MatchesPage`'s `users` fetch (matches/page.js:150) and `ChatManager.js`'s (line 32) and `chat/page.js`'s (line 72) do **not** filter — inactive/deactivated users still appear in "View all players bets" lists and in chat message author lookups.
- **Admin has no DB-level privilege separation.** The `NEXT_PUBLIC_ADMIN_CODE` gate only controls whether the `/admin` UI renders its controls; every write it performs (stage toggle, result entry, CSV import, user deactivate, message delete, rules edit) goes through the exact same `anon`-role RLS policies as a regular player action. See Section 6.
- **Rules page is the only server component**, uses ISR (`revalidate = 3600`) and its own inline Supabase client rather than the shared singleton — everything else in the app is `'use client'` and fetches on mount.

---

## 6. Auth & access control

**There is no Supabase Auth usage anywhere in this codebase** (no `supabase.auth.*` calls found). Identity and access work as follows, end to end:

1. **Join/login** ([join/page.js](../app/join/page.js)): a new player submits alias + email + join code → the code looks up `competitions.join_code`, then inserts a `users` row (guarded only by the DB's `UNIQUE(alias, competition_id)` / `UNIQUE(email, competition_id)` constraints, surfaced as friendly errors on Postgres code `23505`). A returning player submits email + join code → the code does `users.select('id').eq('competition_id', ...).eq('email', ...).single()`, i.e. **no password check at all** — knowing someone's email and the (competition-wide, shared) join code is sufficient to log in as them.
2. **Session persistence**: on success, `localStorage.setItem('userId', user.id)` and `localStorage.setItem('competitionId', competition.id)` (join/page.js:82-83, 116-117). This is the entire "session" — a raw, unsigned UUID sitting in localStorage.
3. **Route protection**: [useRequireUser.js](../app/hooks/useRequireUser.js) reads `localStorage.userId` on mount; if absent, `router.replace('/join')`. [AuthGuard.js](../app/components/AuthGuard.js) wraps this hook and renders nothing until the check resolves. [app/(main)/layout.js](../app/(main)/layout.js) wraps every route under the `(main)` group in `AuthGuard` + `TabBar`. This is **client-side-only** route protection — there is no middleware, no server-side cookie/session check; a user who manually sets `localStorage.userId` to any valid (or even guessed) UUID is treated as that user by every page.
4. **Database-level access**: because RLS policies grant `anon` broad `USING (true)` access on nearly every table/operation (setup.sql:199-257), the localStorage `userId` is a *convention* the client code follows (e.g. `bets.insert({ user_id: userId, ... })`, `.eq('user_id', userId)` filters) — nothing in Postgres verifies that the caller "owns" that `user_id`. Any anon-key holder can read or write any row in `users`, `bets`, `messages`, `stages`, `matches`, `settings` directly.
5. **Logout**: [LogoutButton.js](../app/components/LogoutButton.js) clears `userId`, `matchesSortMode`, and `competitionId` from localStorage and routes to `/join`. (Note: does not clear `leaderboardView`, `matchesActiveStage`, `collapsedGroups`, or `leaderboardProgressionSelected`.)
6. **Admin access**: entirely separate mechanism, unrelated to user identity. [admin/page.js:13,20-26](../app/admin/page.js#L13) compares a typed code against `process.env.NEXT_PUBLIC_ADMIN_CODE` in the browser. Because the variable is prefixed `NEXT_PUBLIC_`, **its value is bundled into the client-side JavaScript and is recoverable by anyone who inspects the deployed app** — it is a UI convenience gate, not a security boundary. No server-side check exists for any admin action; every admin write uses the same `supabase` client and the same `anon`-role RLS policies as regular player actions (see Section 5).

---

## 7. Dependencies

From [package.json](../package.json).

### `dependencies`
| package | version | purpose | used? |
|---|---|---|---|
| `@supabase/supabase-js` | ^2.101.0 | Supabase client SDK (DB queries, realtime channels) | Yes — [lib/supabase.js](../lib/supabase.js), every page/component that talks to the DB, [seed.js](../seed.js) |
| `countries-list` | ^3.3.0 | ISO country name/code data for the nationality dropdown | Yes — [join/page.js:7,16](../app/join/page.js#L7) only |
| `next` | 16.2.1 | App framework (App Router) | Yes — whole app |
| `react` | 19.2.4 | UI library | Yes |
| `react-dom` | 19.2.4 | React DOM renderer | Yes |
| `react-markdown` | ^10.1.0 | Renders rules-page body text as Markdown | Yes — [rules/page.js:3](../app/(main)/rules/page.js#L3) only |
| `recharts` | ^3.9.1 | `LineChart` for the leaderboard progression view | Yes — [ProgressionView.js:5-7](../app/(main)/leaderboard/components/ProgressionView.js#L5) only |

### `devDependencies`
| package | version | purpose | used? |
|---|---|---|---|
| `@tailwindcss/postcss` | ^4 | Tailwind v4 PostCSS plugin | Yes — [postcss.config.mjs](../postcss.config.mjs) |
| `dotenv-cli` | ^11.0.0 | Loads `.env` files for CLI scripts | **Not referenced anywhere** — no `package.json` script uses it, no code imports it. Likely intended for ad hoc manual use (e.g. running `seed.js` against `.env.local`) but not wired in. |
| `eslint` | ^9 | Linting | Yes — `npm run lint` |
| `eslint-config-next` | 16.2.1 | Next.js ESLint rules | Yes — [eslint.config.mjs](../eslint.config.mjs) |
| `tailwindcss` | ^4 | Utility CSS framework | Yes — `@import "tailwindcss"` in [app/globals.css:1](../app/globals.css#L1) |

All `dependencies` are actively used. `dotenv-cli` is the one devDependency with no discoverable usage in the repo.

---

## 8. Automation / CI

**No `.github/workflows` directory exists in this repository** — confirmed via directory listing. There is no GitHub Actions automation of any kind (no CI test/lint/build gate, no scheduled jobs).

The only deployment-related file is [.vercel/project.json](../.vercel/project.json), which links this local checkout to a Vercel project (`projectName: "wc26-bets"`) via the Vercel CLI/git integration — this is local tooling metadata, not an automation script, and implies deploys happen through Vercel's own git-push integration rather than a custom pipeline.

---

## 9. Environment variables

All are `NEXT_PUBLIC_*` (client-bundled, not server-secret) and documented in [.env.example](../.env.example).

| Variable | Used in | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [lib/supabase.js:4](../lib/supabase.js#L4), [seed.js:4](../seed.js#L4), [rules/page.js:62](../app/(main)/rules/page.js#L62) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [lib/supabase.js:5](../lib/supabase.js#L5), [seed.js:5](../seed.js#L5), [rules/page.js:63](../app/(main)/rules/page.js#L63) | Supabase anon (public) API key |
| `NEXT_PUBLIC_ADMIN_CODE` | [admin/page.js:13](../app/admin/page.js#L13) | Shared password compared client-side to gate the `/admin` UI |

`rules/page.js` reads the Supabase URL/key a second time to build its own inline client rather than importing `lib/supabase.js` (see Section 3/5). No other environment variables (server-only secrets, feature flags, etc.) are referenced anywhere in `app/`, `lib/`, or `seed.js`.

---

## 10. Discrepancies vs. CLAUDE.md

**Not applicable — no `CLAUDE.md` file exists in this repository.** A recursive glob for `**/CLAUDE.md` from the repo root returned zero results, and none was found in the user's home Claude config directory either. If a CLAUDE.md previously existed and is expected, it is currently missing/untracked rather than merely out of date.

---

## 11. Loose ends

- **Leaderboard tiebreak documentation gap.** Rules copy claims a third tiebreak of "Exact hits by stage in order: Group → Final" ([rules/page.js:52](../app/(main)/rules/page.js#L52), [RulesManager.js:33](../app/admin/components/RulesManager.js#L33)) that does not exist in the actual sort ([leaderboard/page.js:200-204](../app/(main)/leaderboard/page.js#L200), `get_leaderboard()` in setup.sql) — the real third tiebreak is alphabetical alias. See Section 4.
- **`calcPoints` duplicated 4× in JS + 1× in SQL** with no shared module — [MatchCard.js:28-35](../app/(main)/matches/components/MatchCard.js#L28), [ProgressionView.js:16-23](../app/(main)/leaderboard/components/ProgressionView.js#L16), [stats/page.js:7-11](../app/(main)/stats/page.js#L7) (different argument order than the other three), [BetExport.js:6-13](../app/admin/components/BetExport.js#L6), `get_leaderboard()` in [setup.sql:140-159](../supabase/setup.sql#L140).
- **`FLAGS` team→ISO-code map duplicated 3×** verbatim — [matches/page.js:13-26](../app/(main)/matches/page.js#L13), [MatchCard.js:7-20](../app/(main)/matches/components/MatchCard.js#L7), [GroupStandings.js:19-32](../app/(main)/matches/components/GroupStandings.js#L19).
- **Inconsistent `.schema('public')` usage.** [ChatManager.js:44-46](../app/admin/components/ChatManager.js#L44) is the only query in the codebase that explicitly chains `.schema('public')` before `.from('messages')`; every other query (including the rest of ChatManager's own `.from('messages')` and `.from('users')` calls two lines above) omits it. Functionally harmless (public is the default schema) but inconsistent.
- **`console.error`/`console.log` left in shipped code.** [MatchCard.js:85](../app/(main)/matches/components/MatchCard.js#L85) logs bet-save failures to the browser console. [seed.js:18,20](../seed.js#L18) logs in Norwegian (`'Feil:'` = "Error:", `'Konkurranse opprettet:'` = "Competition created:") — `seed.js` is a standalone CommonJS (`require`) script, not part of the Next.js app bundle, and is the only file in the repo not using ES module `import` syntax.
- **No automated tests anywhere.** No `*.test.js`/`*.spec.js` files, no `__tests__`/`tests` directories found in the repo.
- **No CI/CD.** No `.github/workflows` directory (Section 8).
- **`dotenv-cli` devDependency appears unused** (Section 7).
- **Two versions of the match CSV committed at repo root**: [wc2026_matches_v2.csv](../wc2026_matches_v2.csv) and [wc2026_matches_v3.csv](../wc2026_matches_v3.csv). Since match data enters the DB only via the admin CSV *file-picker upload* ([CsvImport.js](../app/admin/components/CsvImport.js)), neither file is referenced by any code path — their presence/staleness relative to each other can't be determined from the code, only that v3 is the more recently modified of the two (per filesystem timestamps at audit time).
- **`app/page.js` always redirects to `/join`**, even for a browser that already has a valid `userId` in localStorage — there's no root-level "already logged in, skip to /matches" check ([app/page.js](../app/page.js)).
- **`CsvImport.js`'s CSV parser is a naive `split(',')`** ([CsvImport.js:6-13](../app/admin/components/CsvImport.js#L6)) with no handling for quoted fields containing commas — fine for the current simple match-list format, but not a general CSV parser.
- **`LogoutButton` clears only 3 of several localStorage keys** the app writes (`userId`, `matchesSortMode`, `competitionId`) — `leaderboardView`, `matchesActiveStage`, `collapsedGroups` (sessionStorage), and `leaderboardProgressionSelected` persist across logout/login as a different user ([LogoutButton.js:8-13](../app/components/LogoutButton.js#L8)).
- **Empty, git-tracked-looking local directories**: `Ny mappe` ("New folder" in Norwegian) at repo root and `docs/fixes`, `docs/spec` subdirectories are all empty at audit time — contents/purpose not determinable from the code.
