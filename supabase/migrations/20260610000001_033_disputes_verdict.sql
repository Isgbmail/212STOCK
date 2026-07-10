-- Migration 033: Structured verdict field on disputes

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS verdict text
    CHECK (verdict IN (
      'refund_buyer',
      'refund_buyer_partial',
      'warning_seller',
      'shared',
      'no_action',
      'reshipment'
    ));
