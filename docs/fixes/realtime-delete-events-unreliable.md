# Fix: Supabase Realtime DELETE events don't reliably reach clients

**Status:** Fixed (soft-delete + UPDATE listener + polling fallback)

## Problem

Chat message deletion (by admin, via Chat Manager) sometimes didn't disappear
from other users' open chat windows in real time. Refreshing the page showed the
message gone, but the live Realtime subscription missed the change.

## Root cause

Supabase Realtime's `postgres_changes` DELETE events are less reliable in
practice than INSERT/UPDATE — a `DELETE` removes the row entirely, so there's
less payload for Postgres's logical replication to carry, and dropped/missed
DELETE events are a known rough edge.

## Solution

Never hard-delete chat messages. Instead:

1. `messages.is_deleted` boolean column (soft delete).
2. Admin "Delete" in Chat Manager performs `UPDATE messages SET is_deleted = true`
   — an UPDATE, not a DELETE.
3. The chat Realtime subscription listens for UPDATE (and INSERT) on `messages`,
   and on receiving an UPDATE where `is_deleted = true`, removes that message
   from the local view.
4. A polling fallback re-fetches recent messages periodically as a backstop, in
   case a client's Realtime connection drops a specific UPDATE event too.

Reactions use the same `is_deleted`-avoidance logic in spirit, though toggling is
implemented as literal insert/delete rows (acceptable there because a missed
reaction DELETE is low-stakes — worst case a reaction pill looks stale until next
refresh, not a message silently reappearing).

## Where it's applied

- `supabase/setup.sql` — `messages.is_deleted` column
- `app/admin/components/ChatManager.js` — soft-delete via UPDATE
- `app/(main)/chat/page.js` — Realtime subscription (`chat-v2` channel), filters
  out `is_deleted = true` on initial fetch and on live UPDATE events

## Note for future code

If any future feature needs to delete rows in real time (not just chat messages),
default to soft-delete + UPDATE-based Realtime rather than DELETE-based Realtime,
based on this experience.
