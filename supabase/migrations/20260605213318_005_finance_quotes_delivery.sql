/*
# Migration 5: Finance, Quotes & Delivery Tickets

## Summary
Creates invoices, payments, credit notes, quote workflow, and delivery tickets
with threaded messaging on both quotes and tickets.

## New Tables
- `invoices` — Auto-generated per order; tracks payment status.
- `payments` — Individual payment records against an invoice.
- `credits` — Credit notes (avoirs) issued by sellers to buyers.
- `quotes` — RFQ workflow between buyer and seller.
- `quote_lines` — Line items in a quote.
- `quote_messages` — Threaded messages on a quote.
- `delivery_tickets` — Transport requests; can be standalone or tied to an order.
- `ticket_messages` — Threaded messages on a delivery ticket.
*/

-- ─── invoices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number  text NOT NULL UNIQUE,
  issued_at       date NOT NULL DEFAULT current_date,
  due_at          date,
  status          text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','paid','overdue','cancelled','partially_paid')),
  amount_ht       numeric(14,4) NOT NULL,
  amount_tax      numeric(14,4) NOT NULL DEFAULT 0,
  amount_ttc      numeric(14,4) NOT NULL,
  amount_paid     numeric(14,4) NOT NULL DEFAULT 0,
  pdf_url         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = invoices.order_id AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  TO authenticated USING (true);

-- ─── payments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount          numeric(14,4) NOT NULL,
  paid_at         date NOT NULL DEFAULT current_date,
  payment_method  text,
  external_ref    text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','posted','rejected')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (true);

-- ─── credits (avoirs) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id    uuid NOT NULL REFERENCES organisations(id),
  buyer_org_id     uuid NOT NULL REFERENCES organisations(id),
  order_id         uuid REFERENCES orders(id),
  amount           numeric(14,4) NOT NULL,
  currency         text NOT NULL DEFAULT 'EUR',
  reason           text,
  used             boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credits_select" ON credits;
CREATE POLICY "credits_select" ON credits FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = credits.buyer_org_id OR om.organisation_id = credits.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "credits_insert" ON credits;
CREATE POLICY "credits_insert" ON credits FOR INSERT
  TO authenticated WITH CHECK (true);

-- ─── quotes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    text NOT NULL UNIQUE,
  buyer_org_id    uuid NOT NULL REFERENCES organisations(id),
  seller_org_id   uuid NOT NULL REFERENCES organisations(id),
  status          text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_progress','responded','accepted','refused','expired','converted')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  responded_at    timestamptz,
  accepted_at     timestamptz,
  order_id        uuid REFERENCES orders(id),
  incoterm        text,
  loading_port    text,
  desired_delivery_date date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_buyer  ON quotes (buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_seller ON quotes (seller_org_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = quotes.buyer_org_id OR om.organisation_id = quotes.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "quotes_insert" ON quotes;
CREATE POLICY "quotes_insert" ON quotes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = quotes.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = quotes.buyer_org_id OR om.organisation_id = quotes.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── quote_lines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id              uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES products(id),
  product_description   text,
  quantity              integer NOT NULL,
  requested_price       numeric(12,4),
  proposed_price        numeric(12,4),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_lines_select" ON quote_lines;
CREATE POLICY "quote_lines_select" ON quote_lines FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN organisation_members om
        ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_lines.quote_id AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "quote_lines_insert" ON quote_lines;
CREATE POLICY "quote_lines_insert" ON quote_lines FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "quote_lines_update" ON quote_lines;
CREATE POLICY "quote_lines_update" ON quote_lines FOR UPDATE
  TO authenticated USING (true);

-- ─── quote_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES auth.users(id),
  message         text NOT NULL,
  attachment_url  text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_msgs_select" ON quote_messages;
CREATE POLICY "quote_msgs_select" ON quote_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN organisation_members om
        ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_messages.quote_id AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "quote_msgs_insert" ON quote_messages;
CREATE POLICY "quote_msgs_insert" ON quote_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ─── delivery_tickets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       text NOT NULL UNIQUE,
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  requester_org_id    uuid NOT NULL REFERENCES organisations(id),
  order_id            uuid REFERENCES orders(id),
  assigned_delivery_id uuid REFERENCES organisations(id),
  pickup_address      jsonb NOT NULL DEFAULT '{}',
  delivery_address    jsonb NOT NULL DEFAULT '{}',
  parcel_details      jsonb DEFAULT '{}',
  window_start        timestamptz,
  window_end          timestamptz,
  status              text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','picked_up','in_transit','delivered','cancelled')),
  priority            text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','express')),
  proposed_price      numeric(10,2),
  accepted_price      numeric(10,2),
  assigned_at         timestamptz,
  completed_at        timestamptz,
  proof_url           text,
  insured             boolean NOT NULL DEFAULT false,
  insured_value       numeric(12,2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_requester ON delivery_tickets (requester_org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_delivery  ON delivery_tickets (assigned_delivery_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status    ON delivery_tickets (status);

ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select" ON delivery_tickets;
CREATE POLICY "tickets_select" ON delivery_tickets FOR SELECT
  TO authenticated USING (
    status = 'open'
    OR EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = delivery_tickets.requester_org_id
             OR om.organisation_id = delivery_tickets.assigned_delivery_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "tickets_insert" ON delivery_tickets;
CREATE POLICY "tickets_insert" ON delivery_tickets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_tickets.requester_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "tickets_update" ON delivery_tickets;
CREATE POLICY "tickets_update" ON delivery_tickets FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = delivery_tickets.requester_org_id
             OR om.organisation_id = delivery_tickets.assigned_delivery_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── ticket_messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES delivery_tickets(id) ON DELETE CASCADE,
  sender_id      uuid NOT NULL REFERENCES auth.users(id),
  message        text NOT NULL,
  attachment_url text,
  internal       boolean NOT NULL DEFAULT false,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_msgs_select" ON ticket_messages;
CREATE POLICY "ticket_msgs_select" ON ticket_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM delivery_tickets dt
      JOIN organisation_members om
        ON om.organisation_id = dt.requester_org_id OR om.organisation_id = dt.assigned_delivery_id
      WHERE dt.id = ticket_messages.ticket_id AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "ticket_msgs_insert" ON ticket_messages;
CREATE POLICY "ticket_msgs_insert" ON ticket_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);
