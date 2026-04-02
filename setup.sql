-- ═══════════════════════════════════════════════════════════════════════════
-- LinhaCash — SQL Setup Completo
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PLAYER_STATS: adicionar colunas de novas stats ──────────────────────────
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fgm int default 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fga int default 0;

-- ── PROFILES: adicionar colunas necessárias ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code_used text;

-- ── SYNC_LOGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_logs (
  id serial primary key,
  status text,
  games_synced int default 0,
  log text,
  errors text,
  created_at timestamp default now()
);
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='sync_logs' AND policyname='sync_logs_service_read')
  THEN CREATE POLICY "sync_logs_service_read" ON sync_logs FOR SELECT TO service_role USING (true); END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='sync_logs' AND policyname='sync_logs_service_insert')
  THEN CREATE POLICY "sync_logs_service_insert" ON sync_logs FOR INSERT TO service_role WITH CHECK (true); END IF;
END $$;

-- ── REFERRAL_USES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_uses (
  id serial primary key,
  code text,
  user_id uuid references profiles(id) ON DELETE CASCADE,
  payment_id text,
  created_at timestamp default now()
);
ALTER TABLE referral_uses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='referral_uses' AND policyname='referral_uses_service_read')
  THEN CREATE POLICY "referral_uses_service_read" ON referral_uses FOR SELECT TO service_role USING (true); END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='referral_uses' AND policyname='referral_uses_service_insert')
  THEN CREATE POLICY "referral_uses_service_insert" ON referral_uses FOR INSERT TO service_role WITH CHECK (true); END IF;
END $$;

-- ── INJURIES (lesões) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS injuries (
  id serial primary key,
  player_id int references players(id) ON DELETE CASCADE,
  player_name text,
  team_name text,
  team_logo text,
  status text,
  reason text,
  game_date date,
  active boolean default true,
  last_status text,
  updated_at timestamp default now()
);
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='injuries' AND policyname='injuries_authenticated_read')
  THEN CREATE POLICY "injuries_authenticated_read" ON injuries FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename='injuries' AND policyname='injuries_service_write')
  THEN CREATE POLICY "injuries_service_write" ON injuries FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
END $$;

-- ── LGPD: log de exclusões de conta ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_deletions (
  id serial primary key,
  user_email text,
  user_id text,
  requested_at timestamp default now(),
  completed boolean default true,
  reason text default 'user_request'
);
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
-- Só admin acessa via service key
CREATE POLICY "deletions_service_only" ON account_deletions FOR ALL USING (false);

-- ── ÍNDICES para performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game_date ON player_stats(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_props_cache_player ON player_props_cache(player_id);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_injuries_active ON injuries(active, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_uses_payment_id_unique ON referral_uses(payment_id) WHERE payment_id IS NOT NULL;

-- ── ON DELETE CASCADE para LGPD ──────────────────────────────────────────────
-- Garante que quando profile for deletado, dados relacionados também somem
-- (referral_uses já tem ON DELETE CASCADE acima)

-- Verificar se já existe e adicionar se não
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'referral_uses_user_id_fkey'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE referral_uses ADD CONSTRAINT referral_uses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
