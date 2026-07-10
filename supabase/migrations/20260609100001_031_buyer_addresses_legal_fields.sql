-- Migration 031 — Champs légaux marocains sur organisations + table adresses livraison acheteur

-- Champs légaux marocains sur organisations (utilisés par MonComptePage)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS ice    text,
  ADD COLUMN IF NOT EXISTS rc     text,
  ADD COLUMN IF NOT EXISTS patente text,
  ADD COLUMN IF NOT EXISTS cnss   text,
  ADD COLUMN IF NOT EXISTS phone  text;

-- Table des adresses de livraison acheteur
CREATE TABLE IF NOT EXISTS buyer_delivery_addresses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  label           text NOT NULL,
  street          text NOT NULL,
  city            text NOT NULL DEFAULT '',
  region          text NOT NULL DEFAULT '',
  phone           text NOT NULL DEFAULT '',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bda_org ON buyer_delivery_addresses (organisation_id);

ALTER TABLE buyer_delivery_addresses ENABLE ROW LEVEL SECURITY;

-- SELECT : membres de l'organisation
DROP POLICY IF EXISTS "bda_select" ON buyer_delivery_addresses;
CREATE POLICY "bda_select" ON buyer_delivery_addresses FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_delivery_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- INSERT
DROP POLICY IF EXISTS "bda_insert" ON buyer_delivery_addresses;
CREATE POLICY "bda_insert" ON buyer_delivery_addresses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_delivery_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "bda_update" ON buyer_delivery_addresses;
CREATE POLICY "bda_update" ON buyer_delivery_addresses FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_delivery_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- DELETE
DROP POLICY IF EXISTS "bda_delete" ON buyer_delivery_addresses;
CREATE POLICY "bda_delete" ON buyer_delivery_addresses FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_delivery_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );
