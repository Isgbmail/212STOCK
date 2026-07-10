-- ─── 023 — Extension platform_settings ──────────────────────────────────────
-- Adds all admin-configurable columns that the new AdminSettings UI exposes.
-- Every ALTER is idempotent (IF NOT EXISTS).

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS platform_name             text         NOT NULL DEFAULT 'Stock212',
  ADD COLUMN IF NOT EXISTS platform_tagline          text                  DEFAULT 'Marketplace B2B FMCG',
  ADD COLUMN IF NOT EXISTS public_url                text                  DEFAULT 'https://stock212.com',
  ADD COLUMN IF NOT EXISTS support_email             text                  DEFAULT 'support@stock212.com',
  ADD COLUMN IF NOT EXISTS support_phone             text                  DEFAULT '',
  ADD COLUMN IF NOT EXISTS maintenance_mode          boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_language          text         NOT NULL DEFAULT 'fr',
  -- Commerce
  ADD COLUMN IF NOT EXISTS vat_default_rate          numeric(5,2) NOT NULL DEFAULT 20.0,
  ADD COLUMN IF NOT EXISTS min_order_amount          numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission_pct   numeric(5,2) NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS commission_negotiated_pct numeric(5,2) NOT NULL DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS default_payment_terms     integer      NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_methods           text[]                DEFAULT '{"virement","cheque"}',
  ADD COLUMN IF NOT EXISTS vendor_confirmation_hours integer      NOT NULL DEFAULT 48,
  -- Vendeurs
  ADD COLUMN IF NOT EXISTS vendor_manual_validation  boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_required_docs      text[]                DEFAULT '{"kbis","rib","assurance"}',
  ADD COLUMN IF NOT EXISTS vendor_min_score          integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_max_dispute_pct    numeric(5,2) NOT NULL DEFAULT 10.0,
  ADD COLUMN IF NOT EXISTS vendor_max_products       integer      NOT NULL DEFAULT 500,
  -- Acheteurs
  ADD COLUMN IF NOT EXISTS buyer_manual_validation   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buyer_max_active_quotes   integer      NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS quote_validity_days       integer      NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS buyer_min_order_for_tiers numeric(12,2) NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS global_moq                integer      NOT NULL DEFAULT 1,
  -- Livraison
  ADD COLUMN IF NOT EXISTS delivery_default_fee      numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_free_from        numeric(12,2) NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS delivery_validation_days  integer      NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS delivery_default_days     integer      NOT NULL DEFAULT 5,
  -- Notifications
  ADD COLUMN IF NOT EXISTS notif_admin_email         text                  DEFAULT 'admin@stock212.com',
  ADD COLUMN IF NOT EXISTS notif_support_email       text                  DEFAULT 'support@stock212.com',
  ADD COLUMN IF NOT EXISTS notif_push_enabled        boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_alert_disputes      boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_alert_registrations boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_weekly_report       boolean      NOT NULL DEFAULT true,
  -- Sécurité
  ADD COLUMN IF NOT EXISTS security_session_hours    integer      NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS security_2fa_required     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS security_max_attempts     integer      NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS security_lockout_minutes  integer      NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS audit_logs_enabled        boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS audit_retention_days      integer      NOT NULL DEFAULT 90;

-- Allow admins to update platform_settings (policy name deduplication safe)
DROP POLICY IF EXISTS "platform_settings_admin_update" ON platform_settings;
CREATE POLICY "platform_settings_admin_update" ON platform_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_team WHERE user_id = auth.uid() AND active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_team WHERE user_id = auth.uid() AND active = true)
  );
