# wc26-bets — Specification (v2, as-built)

Repo: `brastad42/wc26-bets` · Live: `wc26-bets.vercel.app`
Snapshot date: 2026-07-25, based on `docs/AUDIT_REPORT_25.07.2026.md` (commit `7179fca`), the original project spec, and prior working sessions.

This document supersedes the original MVP spec. It describes the app **as it actually
runs today**, not as originally planned — several things changed shape during
development (see "Deviations from the original MVP spec" below). Where the original
spec's exact wording is still the intended behavior, it's carried over; where the
build diverged, this doc reflects the build.

---

## 1. Purpose

Mobile-first prediction/betting app for an informal World Cup 2026 competition
among ~85 active friends. Users predict match scores, earn points, and compete
on a leaderboard. Internal use only — not built to survive adversarial users.

## 2. Tech stack

- **Frontend:** Next.js 16 (App Router), JavaScript only (no TypeScript), Tailwind CSS 4
- **Database:** Supabase (Postgres + PostgREST), accessed entirely via the `anon` key — **no Supabase Auth**
- **Deploy:** Vercel, connected via GitHub push
- **Charting:** Recharts (leaderboard progression view)
- **Flags:** `flagcdn.com` images, keyed by ISO 3166-1 alpha-2 codes (`countries-list` package + 4 manual UK-nation entries)

## 3. Database schema

Source of truth: `supabase/setup.sql`. No migrations directory, no ORM — this file
*is* the schema.

| Table | Key columns | Notes |
|---|---|---|
| `competitions` | `id`, `name`, `join_code` (unique) | Single seeded row (`World Cup 2026` / `wc26`). App code assumes exactly one row everywhere (`.select('id').single()` with no filter) — nothing at the schema level enforces this. |
| `users` | `id`, `competition_id`, `alias`, `email`, `country_code`, `is_active` | Unique on `(alias, competition_id)` and `(email, competition_id)`. `country_code` has mixed casing (see §8). |
| `stages` | `stage`, `is_open`, `locked_at`, `opened_at` | 6 fixed rows: Group, R32, R16, QF, SF, Final. Toggled manually by admin. |
| `matches` | `match_no` (unique), `stage`, `match_group`, `home_team`, `away_team`, `match_time`, `result_home`, `result_away` | `match_no` is the CSV-import upsert key. `match_group` is `A`–`L` for group stage, `NULL` for knockouts. |
| `bets` | `user_id`, `match_id`, `bet_home`, `bet_away` | Unique on `(user_id, match_id)` — enables upsert-on-conflict. |
| `messages` | `user_id`, `content`, `created_at`, `is_deleted` | Soft-delete only. |
| `reactions` | `message_id`, `user_id`, `emoji` | Unique on `(message_id, user_id, emoji)`; toggled via insert/delete, not update. |
| `settings` | `key` (PK), `value` (jsonb) | Currently one row, `key='rules'`, holding the editable Rules page content. |

**`get_leaderboard()`** — `SECURITY DEFINER` SQL function, granted to `anon`. Returns
`(id, alias, total_points, total_exact)` for active users, computed via `LEFT JOIN`
so zero-bet users still appear with 0 points.

**RLS:** enabled on every table, but every policy grants `anon` unrestricted
`USING (true)` / `WITH CHECK (true)` for the operations each table needs. RLS here
controls *which operations exist*, not *whose rows they touch* — see §7 (Security model).

Schema vs. code cross-check (2026-07-25 audit): no field-name mismatches found.

## 4. Pages & routes

| Route | Purpose |
|---|---|
| `/` | No UI — always redirects to `/join`, even for an already-logged-in browser. |
| `/join` | Alias + email + join code (new user) or email + join code (returning user, no password). Writes `userId`/`competitionId` to localStorage. |
| `/matches` | Stage-tabbed match list + betting UI. See §5. |
| `/leaderboard` | Ranked list + progression chart. See §5. |
| `/stats` | Labeled **"Awards"** in the UI/tab bar — route file name doesn't match the on-screen label. See §5. |
| `/chat` | Realtime group chat. |
| `/rules` | Server-rendered (ISR, 1h) rules content from `settings.rules`. |
| `/admin` | Code-gated admin console. **Not in the tab bar** — reachable only by typing the URL. |

Tab bar shows exactly 5 tabs: Matches, Leaderboard, Awards, Chat, Rules.

## 5. Feature summary

### Matches (`/matches`)
- Stage tabs, click or swipe (custom gesture hook with boundary bounce, no wraparound).
- Group-stage-only sort toggle (persisted): **Groups** (collapsible, mini flag + played/total badge), **Date** (auto-scrolls to today/next unplayed day), **Tables** (FIFA-style group standings instead of match cards).
- Bet form while stage is open; upsert-on-conflict save.
- Locked stage: own bet + points shown, expandable "View all players' bets" (sorted by points, DNS shown for non-bettors), "Most popular bet" banner (mode of all bets, handles ties).
- Bet-completion progress banner while stage is open.
- Team flags via a hardcoded team→ISO-code map, currently duplicated in 3 files (see fix backlog).

### Group standings
Full FIFA tiebreak sequence computed client-side from **results only** (bets never
factor in): head-to-head points → h2h GD → h2h goals-for → overall GD → overall
goals-for → alphabetical.

### Leaderboard (`/leaderboard`)
- List / Progression toggle.
- Manual refresh.
- 48h-deadline reminder banner, deep-links to `/matches?stage=X`.
- List: shared rank for ties, medals for top 3, current-user highlight, country flag if set.
- Progression: multi-select (max 10) Recharts line chart, per-stage shaded bands, custom tooltip re-ranking at each match index.

**Sort/tiebreak, as actually implemented (`leaderboard/page.js`):**
1. `total_points` descending
2. `total_exact` descending
3. `alias` ascending (alphabetical)

> ⚠️ This differs from the Rules page copy, which still describes a third tiebreak
> of "exact hits by stage, Group → Final." No such logic exists in code. **Needs a
> decision — see §9.**

### Awards (`/stats`)
12 player + 4 team + 3 match "superlative" awards computed client-side from all
bets/matches (Legendary Optimist, Diplomat of Draws, On Fire, Perfect Run, The
Maverick, Unlucky Loser(s), etc.). Only visible once ≥1 stage is locked. Eligibility:
user must have bet on ≥50% of locked-stage matches.

### Chat (`/chat`)
Realtime (Supabase channel `chat-v2`) with cursor-paginated history (50/page),
scroll-position preservation, auto-scroll-to-bottom near the bottom only, long-press
emoji reactions, soft-delete aware.

### Rules (`/rules`)
The only server component in the app. Reads `settings.rules`, falls back to a
hardcoded default if empty. Renders each section's body as Markdown line-by-line.
Editable from Admin.

### Admin (`/admin`)
Client-side code gate (`NEXT_PUBLIC_ADMIN_CODE` — see §7 for what this does and
doesn't protect). Sections: Stage open/lock, Result entry, CSV import (naive
`split(',')` parser, no quoted-field support), Bet export (CSV, one row per
match×active-user), User management (rename/deactivate — shows inactive users too),
Chat moderation (soft-delete), Rules editor.

## 6. Scoring rules

- **3 points** — exact score match
- **1 point** — correct outcome (win/draw/loss sign match) but not exact
- **0 points** — wrong outcome, or no bet placed (DNS)
- Based on the 90-min + stoppage-time result only; extra time / penalties never
  change the outcome used for scoring.
- Computed on the fly, never stored.

**Implementation note:** this rule is now consolidated in one shared source of truth in lib/scoring.js (it used to be implemented independently in 5
places 4× JavaScript, 1× SQL.) 

## 7. Security model (explicit, accepted risk)

This app has **no real authentication or authorization** at any layer:

- "Login" is alias/email + a competition-wide shared join code. Returning users
  log in with just email + join code — no password.
- Session = a raw, unsigned UUID in `localStorage`. Anyone can set it to any value.
- Admin access is a client-side string comparison against a `NEXT_PUBLIC_*` env
  var, which means **the admin code ships in the browser bundle** and is
  recoverable by inspection. It gates the `/admin` UI only — every admin action
  runs through the exact same `anon`-role, `USING (true)` RLS policies as a normal
  player action.
- Nothing in Postgres enforces "only your own bets" or "no bets after stage lock" —
  both are UI-only conventions.

Given the original spec's own framing ("for fun and internal use only, no fancy
security necessary"), this is treated as an **accepted trade-off**, not a bug —
documented here so it's a conscious choice rather than a surprise. Worth
revisiting only if the group grows beyond people who'd have no reason to poke at it.

## 8. Known implementation quirks

- `country_code` is stored with mixed casing (uppercase ISO from `countries-list`,
  lowercase-hyphenated for the 4 manual UK-nation entries). The leaderboard flag
  renderer lowercases before building the `flagcdn.com` URL; other consumers must
  do the same or flags silently break.
- `users` fetches are inconsistently filtered by `is_active` — the leaderboard and
  exports filter correctly, but the Matches "view all bets" list and the Chat
  author lookups do not, so deactivated users can still appear there.
- `LogoutButton` clears only `userId`, `matchesSortMode`, `competitionId` — not
  `leaderboardView`, `matchesActiveStage`, `collapsedGroups`, or
  `leaderboardProgressionSelected`. A second person logging in on the same device
  inherits the previous user's view preferences (not their data).

## 9. Open decisions

These surfaced from the audit and need a call before being turned into CC work:

1. **Leaderboard tiebreak mismatch.** Solved (Rules page promises a per-stage exact-hits
   tiebreak; code does alphabetical. Options: (a) implement the documented
   per-stage tiebreak, or (b) fix the Rules copy to say "alphabetical." Cheaper fix
   is (b); more correct-to-original-spec fix is (a).
   - SOLVED
   
2. **`/stats` route vs. "Awards" label.** Cosmetic only (file/route name vs.
   on-screen text) — rename the route, or leave it and just note it in docs.
3. **`CLAUDE.md`.** Referenced in earlier working notes as present in the repo
   root with schema/gotchas/style preferences, but the audit found no `CLAUDE.md`
   anywhere in the repo. Either it was never committed, or it's been removed —
   worth recreating from this spec + the fix docs if it's still wanted as CC's
   working context.
4. **Scoring logic duplication (5×).** Low urgency since all 5 are currently
   consistent, but any future scoring change means updating 5 places correctly.
   Candidate for consolidation into a shared module + calling it from the DB
   function via a matching, well-tested `CASE` — or accept the duplication as a
   known, documented risk.
   - SOLVED


## 10. Deviations from the original MVP spec

For reference, the main places the build diverged from the original written spec:

- **Stage-based single-vote "join"** became separate "create account" vs "sign in"
  flows keyed on email, not just alias + join code.
- **Admin overflow-menu access** (original spec: "…" menu) became a route with no
  nav entry at all — same practical effect (hidden from normal navigation) but
  reached differently.
- **Awards/Stats page** wasn't in the original spec at all — added later, gated
  behind the Group stage locking.
- **Group standings / Tables view** wasn't in the original spec — added later as a
  third sort mode on Matches.
- **Leaderboard Progression view, deadline banner, "most popular bet," swipe
  gestures** — all additions beyond the MVP definition of done.
- CSV import format evolved from `match_no,stage,kickoff_at,home_team,away_team`
  to also include `match_group` for group-stage table rendering.

## 11. Deferred / backlog

- PWA version-polling ("new version available" banner) — designed, pending
  confirmation of service worker status.
- Magic Link auth — deferred to v2.
- Multi-tenant support — `competition_id` already exists on every table, but no
  app code filters by it; deferred pending actual demand.

## 12. Environment variables

All `NEXT_PUBLIC_*` (client-bundled, none are server-only secrets):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon API key |
| `NEXT_PUBLIC_ADMIN_CODE` | Shared password gating the `/admin` UI (client-side only — see §7) |

## 13. Dependencies

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | DB client + realtime |
| `countries-list` | Nationality dropdown data |
| `next`, `react`, `react-dom` | Framework |
| `react-markdown` | Rules page body rendering |
| `recharts` | Leaderboard progression chart |
| `tailwindcss` | Styling |

`dotenv-cli` (devDependency) is present but not referenced anywhere in the repo.
