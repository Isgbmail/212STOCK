-- Migration 017 — Frais de mission pour les livreurs

CREATE TABLE IF NOT EXISTS mission_expenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_ticket_id  uuid NOT NULL REFERENCES delivery_tickets(id) ON DELETE CASCADE,
  expense_type        text NOT NULL DEFAULT 'other'
    CHECK (expense_type IN ('fuel','toll','parking','meal','lodging','other')),
  description         text,
  expense_date        date NOT NULL DEFAULT CURRENT_DATE,
  amount_ht           numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_ht >= 0),
  tva_rate            numeric(5,2)  NOT NULL DEFAULT 20,
  receipt_ref         text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mission_expenses ENABLE ROW LEVEL SECURITY;

-- Lecture : org affectée (livreur) ou org requérante (vendeur)
DROP POLICY IF EXISTS "mission_expenses_select" ON mission_expenses;
CREATE POLICY "mission_expenses_select" ON mission_expenses FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM delivery_tickets dt
      WHERE dt.id = mission_expenses.delivery_ticket_id
        AND (
          dt.requester_org_id     = ANY(public.get_user_org_ids()) OR
          dt.assigned_delivery_id = ANY(public.get_user_org_ids())
        )
    )
  );

-- Insertion : uniquement l'org livreur assignée
DROP POLICY IF EXISTS "mission_expenses_insert" ON mission_expenses;
CREATE POLICY "mission_expenses_insert" ON mission_expenses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM delivery_tickets dt
      WHERE dt.id = mission_expenses.delivery_ticket_id
        AND dt.assigned_delivery_id = ANY(public.get_user_org_ids())
    )
  );

-- Suppression : uniquement l'org livreur assignée
DROP POLICY IF EXISTS "mission_expenses_delete" ON mission_expenses;
CREATE POLICY "mission_expenses_delete" ON mission_expenses FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM delivery_tickets dt
      WHERE dt.id = mission_expenses.delivery_ticket_id
        AND dt.assigned_delivery_id = ANY(public.get_user_org_ids())
    )
  );
