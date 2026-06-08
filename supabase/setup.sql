-- =============================================================================
-- wc26-bets · Fresh Supabase Instance Setup
-- =============================================================================
-- HOW TO RUN
--   1. Create a new Supabase project at https://supabase.com
--   2. Go to SQL Editor → New query
--   3. Paste this entire file and click Run
--   4. Add your project credentials to .env.local:
--        NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
--        NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
--        NEXT_PUBLIC_ADMIN_CODE=<choose-a-password>
--   5. Import matches via the admin CSV importer once the app is running
--
-- NOTE: This app does not use Supabase Auth. All client requests run under
--   the anon key. User identity is stored in localStorage (userId). Admin
--   access is gated client-side by NEXT_PUBLIC_ADMIN_CODE. RLS policies
--   therefore grant anon the operations each table actually needs; row-level
--   ownership enforcement (e.g. "only your own bets") is handled in JS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS competitions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  join_code  text        NOT NULL UNIQUE
);

-- One row per player. alias and email are unique within a competition.
CREATE TABLE IF NOT EXISTS users (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  alias          text        NOT NULL,
  email          text        NOT NULL,
  country_code   text,                          -- ISO 3166-1 alpha-2, nullable
  is_active      boolean     NOT NULL DEFAULT true,
  UNIQUE (alias, competition_id),
  UNIQUE (email, competition_id)
);

-- One row per stage per competition. Toggled open/locked by admin.
CREATE TABLE IF NOT EXISTS stages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  stage          text        NOT NULL,          -- 'Group'|'R32'|'R16'|'QF'|'SF'|'Final'
  is_open        boolean     NOT NULL DEFAULT true,
  locked_at      timestamptz,
  opened_at      timestamptz,
  UNIQUE (competition_id, stage)
);

-- Imported via admin CSV uploader; match_no is the natural upsert key.
CREATE TABLE IF NOT EXISTS matches (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  match_no       integer     NOT NULL UNIQUE,
  stage          text        NOT NULL,
  match_group    text,                          -- 'A'..'L' for group stage, NULL for knockouts
  home_team      text        NOT NULL,
  away_team      text        NOT NULL,
  match_time     timestamptz NOT NULL,
  result_home    integer,                       -- NULL until admin enters result
  result_away    integer
);

-- Scoring: exact score = 3 pts, correct outcome = 1 pt, wrong = 0 pt.
CREATE TABLE IF NOT EXISTS bets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id   uuid        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bet_home   integer     NOT NULL,
  bet_away   integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

-- Chat messages; soft-deleted by admin via is_deleted flag.
CREATE TABLE IF NOT EXISTS messages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  is_deleted     boolean     NOT NULL DEFAULT false
);

-- Emoji reactions on chat messages; toggled via delete+insert in the client.
CREATE TABLE IF NOT EXISTS reactions (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid    NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      text    NOT NULL,
  UNIQUE (message_id, user_id, emoji)
);

-- Generic key/value store; currently holds the 'rules' section list (jsonb array).
CREATE TABLE IF NOT EXISTS settings (
  key   text  PRIMARY KEY,
  value jsonb NOT NULL
);

-- ---------------------------------------------------------------------------
-- REALTIME
-- (messages and reactions drive the live chat UI)
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- ---------------------------------------------------------------------------
-- GET_LEADERBOARD FUNCTION
-- ---------------------------------------------------------------------------
-- Returns one row per active user with aggregated points.
-- Scoring mirrors the client-side calcPoints() in MatchCard.js:
--   exact score (home+away both correct) → 3 pts
--   correct outcome (win/draw/loss) → 1 pt
--   wrong outcome → 0 pts
-- Only bets on matches that have a result (result_home IS NOT NULL) count.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  id           uuid,
  alias        text,
  total_points integer,
  total_exact  integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id,
    u.alias,
    COALESCE(SUM(
      CASE
        WHEN m.result_home IS NULL THEN 0
        WHEN b.bet_home = m.result_home
         AND b.bet_away = m.result_away THEN 3
        WHEN SIGN(b.bet_home::numeric - b.bet_away::numeric)
           = SIGN(m.result_home::numeric - m.result_away::numeric) THEN 1
        ELSE 0
      END
    ), 0)::integer AS total_points,
    COALESCE(SUM(
      CASE
        WHEN b.bet_home = m.result_home
         AND b.bet_away = m.result_away THEN 1
        ELSE 0
      END
    ), 0)::integer AS total_exact
  FROM users u
  LEFT JOIN bets    b ON b.user_id  = u.id
  LEFT JOIN matches m ON m.id       = b.match_id
  WHERE u.is_active = true
  GROUP BY u.id, u.alias;
$$;

GRANT EXECUTE ON FUNCTION get_leaderboard() TO anon;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — enable on every table
-- ---------------------------------------------------------------------------

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- GRANTS TO ANON ROLE
-- ---------------------------------------------------------------------------

GRANT SELECT                    ON competitions TO anon;
GRANT SELECT, INSERT, UPDATE    ON users        TO anon;
GRANT SELECT, INSERT, UPDATE    ON stages       TO anon;
GRANT SELECT, INSERT, UPDATE    ON matches      TO anon;
GRANT SELECT, INSERT, UPDATE    ON bets         TO anon;
GRANT SELECT, INSERT, UPDATE    ON messages     TO anon;
GRANT SELECT, INSERT, DELETE    ON reactions    TO anon;
GRANT SELECT, INSERT, UPDATE    ON settings     TO anon;

-- ---------------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------------

-- competitions: read-only for clients; insert only happens via this seed script
CREATE POLICY "competitions_select"
  ON competitions FOR SELECT TO anon USING (true);

-- users: full read; join page inserts; admin updates alias and is_active
CREATE POLICY "users_select"
  ON users FOR SELECT TO anon USING (true);
CREATE POLICY "users_insert"
  ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "users_update"
  ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- stages: full read; admin inserts new stage rows and toggles is_open
CREATE POLICY "stages_select"
  ON stages FOR SELECT TO anon USING (true);
CREATE POLICY "stages_insert"
  ON stages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "stages_update"
  ON stages FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- matches: full read; admin upserts via CSV importer and enters results
CREATE POLICY "matches_select"
  ON matches FOR SELECT TO anon USING (true);
CREATE POLICY "matches_insert"
  ON matches FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "matches_update"
  ON matches FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- bets: full read (leaderboard, stats, all-bets reveal); users upsert own bets
CREATE POLICY "bets_select"
  ON bets FOR SELECT TO anon USING (true);
CREATE POLICY "bets_insert"
  ON bets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "bets_update"
  ON bets FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- messages: full read; users insert; admin soft-deletes via UPDATE is_deleted
CREATE POLICY "messages_select"
  ON messages FOR SELECT TO anon USING (true);
CREATE POLICY "messages_insert"
  ON messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "messages_update"
  ON messages FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- reactions: full read; users insert and delete (emoji toggle)
CREATE POLICY "reactions_select"
  ON reactions FOR SELECT TO anon USING (true);
CREATE POLICY "reactions_insert"
  ON reactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "reactions_delete"
  ON reactions FOR DELETE TO anon USING (true);

-- settings: full read; admin upserts the 'rules' key
CREATE POLICY "settings_select"
  ON settings FOR SELECT TO anon USING (true);
CREATE POLICY "settings_insert"
  ON settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "settings_update"
  ON settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- SEED DATA
-- ---------------------------------------------------------------------------

-- Competition
INSERT INTO competitions (name, join_code)
VALUES ('World Cup 2026', 'wc26')
ON CONFLICT (join_code) DO NOTHING;

-- Six fixed stage rows (start open; lock via admin panel when betting closes)
INSERT INTO stages (competition_id, stage, is_open)
SELECT c.id, s.stage, true
FROM competitions c
CROSS JOIN (VALUES
  ('Group'),
  ('R32'),
  ('R16'),
  ('QF'),
  ('SF'),
  ('Final')
) AS s(stage)
WHERE c.join_code = 'wc26'
ON CONFLICT (competition_id, stage) DO NOTHING;
