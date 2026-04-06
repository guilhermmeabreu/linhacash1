CREATE TABLE IF NOT EXISTS user_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NOT NULL,
  ip_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  invalidated_at timestamptz,
  invalidated_reason text
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen ON user_sessions(last_seen_at DESC);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='user_sessions' AND policyname='user_sessions_service_read')
  THEN CREATE POLICY "user_sessions_service_read" ON user_sessions FOR SELECT TO service_role USING (true); END IF;

  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='user_sessions' AND policyname='user_sessions_service_write')
  THEN CREATE POLICY "user_sessions_service_write" ON user_sessions FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
END $$;
