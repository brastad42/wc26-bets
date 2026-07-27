# Fix: iOS Safari and standalone PWA mode have separate localStorage

**Status:** Fixed

## Problem

Users who joined via Safari on iPhone, then added the app to their home screen
(installing it as a PWA), found themselves logged out — asked to join again even
though `userId` was already saved in localStorage from the browser session.

## Root cause

iOS treats a home-screen "standalone" PWA and the regular Safari browser tab as
having **separate localStorage contexts**, even though both are "the same site."
Writing `userId` while browsing in Safari does not make it visible to the PWA
instance, and vice versa. This is iOS-specific WebKit behavior, not a bug in the
app's own storage logic.

## Solution

Route protection was consolidated into a single `AuthGuard` component applied at
the layout level (`app/(main)/layout.js`), via a `useRequireUser` hook
(`app/hooks/useRequireUser.js`) that:

1. Reads `localStorage.userId` on mount.
2. If missing, redirects to `/join` — cleanly, once, at the top of the component
   tree, rather than having each page independently guess at auth state.

This doesn't eliminate the underlying iOS storage split (that's outside the app's
control), but it means a user landing in a "logged out" PWA context gets a clean,
predictable redirect to `/join` instead of partial/broken page states, and joining
again from the PWA context correctly persists for *that* context going forward.

## Practical implication for testing

When verifying auth-related changes on iPhone, Safari-tab login state and
home-screen-icon login state must be tested **separately** — logging in in one
does not carry over to the other. This is expected behavior, not a regression.
