-- Affiliate commissions and manual payout workflow
-- Run in Supabase SQL editor before deploying this release.

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id bigserial PRIMARY KEY,
  referral_code text NOT NULL,
  influencer_name text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payment_id text NOT NULL,
  plan text NOT NULL,
  gross_amount numeric(12, 2) NOT NULL CHECK (gross_amount >= 0),
  commission_pct numeric(5, 2) NOT NULL CHECK (commission_pct >= 0),
  commission_amount numeric(12, 2) NOT NULL CHECK (commission_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  approved_at timestamptz,
  paid_at timestamptz,
  payout_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_commissions_payment_id_unique
  ON affiliate_commissions(payment_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status_created_at
  ON affiliate_commissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referral_status
  ON affiliate_commissions(referral_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_influencer_status
  ON affiliate_commissions(influencer_name, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user_id
  ON affiliate_commissions(user_id);

ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename='affiliate_commissions'
      AND policyname='affiliate_commissions_service_read'
  ) THEN
    CREATE POLICY "affiliate_commissions_service_read"
      ON affiliate_commissions
      FOR SELECT
      TO service_role
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename='affiliate_commissions'
      AND policyname='affiliate_commissions_service_write'
  ) THEN
    CREATE POLICY "affiliate_commissions_service_write"
      ON affiliate_commissions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
