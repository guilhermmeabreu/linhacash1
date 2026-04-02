-- Security hardening migration for Supabase RLS and billing/webhook integrity
-- Run in Supabase SQL Editor (staging first, then production)

-- 1) Prevent duplicate webhook referral writes and enforce idempotency at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_uses_payment_id_unique
  ON public.referral_uses (payment_id)
  WHERE payment_id IS NOT NULL;

-- 2) Tighten sync_logs: readable/writable only by service role.
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_logs_read" ON public.sync_logs;
DROP POLICY IF EXISTS "sync_logs_insert" ON public.sync_logs;
CREATE POLICY "sync_logs_service_read" ON public.sync_logs
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY "sync_logs_service_insert" ON public.sync_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 3) Tighten referral_uses: service role only (contains payment trace data).
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_uses_read" ON public.referral_uses;
DROP POLICY IF EXISTS "referral_uses_insert" ON public.referral_uses;
CREATE POLICY "referral_uses_service_read" ON public.referral_uses
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY "referral_uses_service_insert" ON public.referral_uses
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 4) Tighten injuries table by removing full-access public policy.
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "injuries_all" ON public.injuries;
DROP POLICY IF EXISTS "injuries_read" ON public.injuries;
CREATE POLICY "injuries_authenticated_read" ON public.injuries
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "injuries_service_write" ON public.injuries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 5) Ensure account_deletions remains service-only (idempotent hardening).
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deletions_service_only" ON public.account_deletions;
CREATE POLICY "deletions_service_only" ON public.account_deletions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
