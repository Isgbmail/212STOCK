import { supabase } from '../lib/supabase';
import type { Order } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────
export type DeliveryMethod = 'partner_carrier' | 'stock212' | 'seller_fleet' | 'buyer_managed';

export interface PartnerCarrier {
  id: string;
  name: string;
  delivery_type: 'logistics_company' | 'independent' | 'internal_fleet';
  base_rate: number | null;
  avg_rating: number;
  cold_chain: boolean;
}

export interface SellerFleetInfo {
  org_id: string;
  has_fleet: boolean;
}

// ── Labels / metadata ──────────────────────────────────────────────────────────
export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, { label: string; desc: string; icon: string }> = {
  partner_carrier: {
    label: 'Transporteur partenaire',
    desc: 'Choisissez parmi nos transporteurs certifiés Stock212',
    icon: '🚛',
  },
  stock212: {
    label: 'Livraison Stock212',
    desc: 'Un livreur indépendant de notre réseau prend en charge votre commande',
    icon: '📦',
  },
  seller_fleet: {
    label: 'Flotte du vendeur',
    desc: 'Le vendeur assure lui-même la livraison avec ses véhicules',
    icon: '🏭',
  },
  buyer_managed: {
    label: "J'organise ma livraison",
    desc: 'Vous envoyez votre propre transporteur ou venez récupérer la marchandise',
    icon: '🔧',
  },
};

// ── Fetch partner carriers ─────────────────────────────────────────────────────
export async function fetchPartnerCarriers(): Promise<PartnerCarrier[]> {
  const { data } = await supabase
    .from('delivery_profiles')
    .select(`
      organisation_id, delivery_type, base_rate, avg_rating,
      organisations!inner(name),
      delivery_capabilities(cold_chain)
    `)
    .eq('validation_status', 'validated');

  return (data ?? []).map((d: Record<string, unknown>) => {
    const org = d.organisations as { name: string } | null;
    const caps = d.delivery_capabilities as { cold_chain: boolean } | null;
    return {
      id: d.organisation_id as string,
      name: org?.name ?? 'Transporteur',
      delivery_type: d.delivery_type as PartnerCarrier['delivery_type'],
      base_rate: d.base_rate as number | null,
      avg_rating: (d.avg_rating as number) ?? 0,
      cold_chain: caps?.cold_chain ?? false,
    };
  });
}

// ── Fetch seller fleet availability ───────────────────────────────────────────
export async function fetchSellerFleetAvailability(sellerOrgIds: string[]): Promise<SellerFleetInfo[]> {
  if (sellerOrgIds.length === 0) return [];
  const { data } = await supabase
    .from('seller_profiles')
    .select('organisation_id, default_delivery_methods')
    .in('organisation_id', sellerOrgIds);

  return (data ?? []).map((d: { organisation_id: string; default_delivery_methods: string[] | null }) => ({
    org_id: d.organisation_id,
    has_fleet: (d.default_delivery_methods ?? []).includes('seller_fleet'),
  }));
}

// ── Core routing function ──────────────────────────────────────────────────────
// Called when the seller confirms an order (pending → confirmed).
// Creates the appropriate delivery_ticket based on orders.delivery_method.
export async function routeDelivery(
  order: Pick<
    Order,
    'id' | 'order_number' | 'seller_org_id' | 'delivery_method' | 'carrier_org_id' | 'delivery_address' | 'delivery_preference'
  >,
  createdByUserId: string
): Promise<{ error: Error | null; ticketId: string | null }> {
  if (order.delivery_method === 'buyer_managed') {
    // Buyer manages their own shipping — no ticket needed
    return { error: null, ticketId: null };
  }

  const priority: 'normal' | 'express' =
    order.delivery_preference === 'express' ? 'express' : 'normal';

  // Determine who gets the ticket
  let assignedDeliveryId: string | null = null;
  let ticketStatus: 'open' | 'assigned' = 'open';

  if (order.delivery_method === 'partner_carrier' && order.carrier_org_id) {
    // Specific partner carrier selected — ticket pre-assigned
    assignedDeliveryId = order.carrier_org_id;
    ticketStatus = 'assigned';
  } else if (order.delivery_method === 'seller_fleet') {
    // Seller's own fleet — ticket assigned to seller's org
    assignedDeliveryId = order.seller_org_id;
    ticketStatus = 'assigned';
  } else if (order.delivery_method === 'stock212') {
    // Open pool — any validated independent delivery agent can pick it up
    assignedDeliveryId = null;
    ticketStatus = 'open';
  }

  const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${order.order_number}`;

  const { data, error } = await supabase
    .from('delivery_tickets')
    .insert({
      ticket_number:        ticketNumber,
      created_by:           createdByUserId,
      requester_org_id:     order.seller_org_id,
      order_id:             order.id,
      assigned_delivery_id: assignedDeliveryId,
      pickup_address:       { source: 'seller_warehouse', seller_org_id: order.seller_org_id },
      delivery_address:     order.delivery_address,
      parcel_details: {
        delivery_method:      order.delivery_method,
        delivery_preference:  order.delivery_preference,
        routed_at:            new Date().toISOString(),
      },
      priority,
      status:       ticketStatus,
      assigned_at:  ticketStatus === 'assigned' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) return { error: new Error(error.message), ticketId: null };
  return { error: null, ticketId: data.id };
}
