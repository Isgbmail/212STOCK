-- Migration 28: Delivery Actor Onboarding & Admin Validation
-- Adds pending_info + suspended statuses, onboarding_documents and validation_audit tables.

-- ── 1. Extend delivery_profiles validation_status check ───────────────────────
ALTER TABLE delivery_profiles
  DROP CONSTRAINT IF EXISTS delivery_profiles_validation_status_check;

ALTER TABLE delivery_profiles
  ADD CONSTRAINT delivery_profiles_validation_status_check
  CHECK (validation_status IN ('pending','pending_info','validated','rejected','suspended'));

-- Additional profile fields collected during wizard
ALTER TABLE delivery_profiles
  ADD COLUMN IF NOT EXISTS vehicle_types  text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fleet_size     integer,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS submitted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ── 2. onboarding_documents ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_type   text NOT NULL
    CHECK (document_type IN (
      'registre_commerce','carte_fiscale','assurance_marchandises','assurance_rc',
      'liste_flotte','licence_transport_alimentaire',
      'permis_conduire','carte_grise','certificat_medical',
      'casier_judiciaire','attestation_hygiene','other'
    )),
  document_label  text NOT NULL,
  file_url        text,
  file_name       text,
  status          text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','verified','issue_detected')),
  admin_notes     text,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ondoc_select_own" ON onboarding_documents;
CREATE POLICY "ondoc_select_own" ON onboarding_documents FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = onboarding_documents.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "ondoc_insert_own" ON onboarding_documents;
CREATE POLICY "ondoc_insert_own" ON onboarding_documents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = onboarding_documents.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "ondoc_update_own" ON onboarding_documents;
CREATE POLICY "ondoc_update_own" ON onboarding_documents FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = onboarding_documents.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_ondoc_org ON onboarding_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_ondoc_status ON onboarding_documents(status);

-- ── 3. delivery_validation_audit ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_validation_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  action          text NOT NULL
    CHECK (action IN ('submitted','requested_info','approved','rejected','suspended','reactivated')),
  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name      text,
  reason          text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_validation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON delivery_validation_audit;
CREATE POLICY "audit_select" ON delivery_validation_audit FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_validation_audit.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "audit_insert_admin" ON delivery_validation_audit;
CREATE POLICY "audit_insert_admin" ON delivery_validation_audit FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_org ON delivery_validation_audit(organisation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON delivery_validation_audit(created_at DESC);
