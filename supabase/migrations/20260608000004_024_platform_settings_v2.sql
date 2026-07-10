-- ─── 024 — platform_settings : colonnes supplémentaires v2 ──────────────────
-- Champs manquants après la refonte AdminSettings (architecture 3 niveaux).
-- Toutes les instructions sont idempotentes (IF NOT EXISTS).

ALTER TABLE platform_settings
  -- Identité
  ADD COLUMN IF NOT EXISTS available_languages  text[]        DEFAULT '{"fr","en"}',
  ADD COLUMN IF NOT EXISTS default_currency     text          NOT NULL DEFAULT 'EUR',
  -- Marketplace / Commerce
  ADD COLUMN IF NOT EXISTS cart_ttl_days        integer       NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS intraeu_vat_enabled  boolean       NOT NULL DEFAULT true,
  -- Offre Vendeurs
  ADD COLUMN IF NOT EXISTS vendor_invoice_day   integer       NOT NULL DEFAULT 1,
  -- Finance & Facturation Stock212
  ADD COLUMN IF NOT EXISTS stripe_mode          text          NOT NULL DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS invoice_prefix       text          NOT NULL DEFAULT 'STK212',
  ADD COLUMN IF NOT EXISTS invoice_footer       text          DEFAULT 'Stock212 SAS — N° SIRET : 000 000 000 00000 — TVA FR00000000000',
  ADD COLUMN IF NOT EXISTS bank_iban            text          DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_bic             text          DEFAULT '';
