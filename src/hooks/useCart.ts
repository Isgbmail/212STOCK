import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CartItem, Product, PriceTier } from '../types';

export type CartItemWithProduct = CartItem & {
  products: Product & { price_tiers: PriceTier[] };
};

export function useCart() {
  const { user, activeOrg } = useAuth();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !activeOrg) { setItems([]); return; }
    setLoading(true);
    const { data: carts } = await supabase
      .from('carts')
      .select('id')
      .eq('buyer_org_id', activeOrg.id)
      .eq('status', 'active')
      .eq('is_template', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const cart = carts?.[0] ?? null;
    if (!cart) { setItems([]); setLoading(false); return; }
    setCartId(cart.id);

    const { data } = await supabase
      .from('cart_items')
      .select('*, products(*, price_tiers(*), organisations(name, id))')
      .eq('cart_id', cart.id);

    setItems((data as CartItemWithProduct[]) ?? []);
    setLoading(false);
  }, [user, activeOrg]);

  useEffect(() => { load(); }, [load]);

  async function removeItem(cartItemId: string) {
    await supabase.from('cart_items').delete().eq('id', cartItemId);
    setItems((prev) => prev.filter((i) => i.id !== cartItemId));
  }

  async function updateQty(cartItemId: string, qty: number, unitPrice: number | null) {
    await supabase
      .from('cart_items')
      .update({ quantity: qty, unit_price_computed: unitPrice })
      .eq('id', cartItemId);
    setItems((prev) =>
      prev.map((i) => i.id === cartItemId
        ? { ...i, quantity: qty, unit_price_computed: unitPrice }
        : i
      )
    );
  }

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const hasMoqViolation = items.some(
    (i) => i.products && i.quantity < i.products.moq
  );

  return { items, loading, count, hasMoqViolation, removeItem, updateQty, reload: load, cartId };
}
