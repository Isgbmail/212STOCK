-- Migration 030 — Link orders to originating cart + store delivery fee
-- cart_id allows the admin to group all orders from the same buyer basket.
-- delivery_fee_mad records the delivery charge committed at checkout per order.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cart_id        uuid REFERENCES carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee_mad numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_cart_id
  ON orders(cart_id) WHERE cart_id IS NOT NULL;

COMMENT ON COLUMN orders.cart_id IS
  'FK to the cart this order originated from; set at checkout. '
  'Allows grouping of sibling orders from the same buyer session.';

COMMENT ON COLUMN orders.delivery_fee_mad IS
  'Delivery fee charged to the buyer for this vendor sub-order, '
  'sourced from vendor_delivery_config at checkout time (snapshot, not live).';
