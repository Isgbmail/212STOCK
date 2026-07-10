import { supabase } from './supabase';
import type {
  CampaignType, CampaignStatus, CreateCampaignInput,
  CreditTransactionType, AdminMktNotifType, LoyaltyTransactionType,
} from '../types/marketing';

// ─── Solde crédits vendeur ────────────────────────────────────────────────────
export async function getSellerBalance(sellerId: string): Promise<number> {
  const { data } = await supabase
    .from('profiles')
    .select('seller_credits_balance')
    .eq('id', sellerId)
    .single();
  return (data as { seller_credits_balance: number } | null)?.seller_credits_balance ?? 0;
}

// ─── Déduire crédits vendeur ──────────────────────────────────────────────────
export async function deductSellerCredits(
  sellerId: string,
  amount: number,
  type: CreditTransactionType,
  referenceId?: string,
  description?: string,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const current = await getSellerBalance(sellerId);
  if (current < amount) {
    return { success: false, newBalance: current, error: `Solde insuffisant. Disponible: ${current.toFixed(2)} crédits, requis: ${amount.toFixed(2)}` };
  }
  const newBalance = current - amount;
  const { error } = await supabase
    .from('profiles')
    .update({ seller_credits_balance: newBalance })
    .eq('id', sellerId);
  if (error) return { success: false, newBalance: current, error: error.message };

  await supabase.from('credit_transactions').insert({
    user_id: sellerId,
    amount: -amount,
    type,
    reference_id: referenceId ?? null,
    description: description ?? null,
    balance_after: newBalance,
  });
  return { success: true, newBalance };
}

// ─── Créditer un vendeur ───────────────────────────────────────────────────────
export async function addSellerCredits(
  sellerId: string,
  amount: number,
  type: CreditTransactionType,
  referenceId?: string,
  description?: string,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const current = await getSellerBalance(sellerId);
  const newBalance = current + amount;
  const { error } = await supabase
    .from('profiles')
    .update({ seller_credits_balance: newBalance })
    .eq('id', sellerId);
  if (error) return { success: false, newBalance: current, error: error.message };

  await supabase.from('credit_transactions').insert({
    user_id: sellerId,
    amount,
    type,
    reference_id: referenceId ?? null,
    description: description ?? null,
    balance_after: newBalance,
  });
  return { success: true, newBalance };
}

// ─── Vérifier disponibilité inventaire ────────────────────────────────────────
export async function checkInventory(
  placement: string,
  startDate: string,
  endDate: string,
  slotsPerDay: number,
): Promise<{ available: boolean; blockedDays: string[] }> {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  const { data: rows } = await supabase
    .from('ad_inventory')
    .select('date, total_slots, reserved_slots')
    .eq('placement', placement)
    .in('date', days);

  const { data: capRow } = await supabase
    .from('ad_inventory_caps')
    .select('daily_slots')
    .eq('placement', placement)
    .single();

  const defaultSlots = (capRow as { daily_slots: number } | null)?.daily_slots ?? 100;
  const inventory = new Map<string, { total: number; reserved: number }>();
  (rows ?? []).forEach((r: { date: string; total_slots: number; reserved_slots: number }) => {
    inventory.set(r.date, { total: r.total_slots, reserved: r.reserved_slots });
  });

  const blocked: string[] = [];
  for (const day of days) {
    const entry = inventory.get(day);
    const total = entry?.total ?? defaultSlots;
    const reserved = entry?.reserved ?? 0;
    if (reserved + slotsPerDay > total) blocked.push(day);
  }
  return { available: blocked.length === 0, blockedDays: blocked };
}

// ─── Réserver des slots inventaire ───────────────────────────────────────────
export async function reserveInventory(
  placement: string,
  startDate: string,
  endDate: string,
  slotsPerDay: number,
): Promise<{ success: boolean; error?: string }> {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const { data: capRow } = await supabase
    .from('ad_inventory_caps')
    .select('daily_slots')
    .eq('placement', placement)
    .single();
  const defaultSlots = (capRow as { daily_slots: number } | null)?.daily_slots ?? 100;

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const { error } = await supabase.from('ad_inventory').upsert({
      placement,
      date: day,
      total_slots: defaultSlots,
      reserved_slots: slotsPerDay,
    }, { onConflict: 'placement,date', ignoreDuplicates: false });
    if (error) {
      // If upsert conflicts, increment instead
      await supabase.rpc('increment_reserved_slots', {
        p_placement: placement, p_date: day, p_slots: slotsPerDay,
      }).throwOnError().catch(async () => {
        await supabase.from('ad_inventory')
          .update({ reserved_slots: supabase.rpc as unknown as number })
          .eq('placement', placement).eq('date', day);
      });
    }
  }
  return { success: true };
}

// ─── Libérer des slots inventaire ─────────────────────────────────────────────
export async function freeInventory(
  placement: string,
  startDate: string,
  endDate: string,
  slotsPerDay: number,
): Promise<void> {
  const start = new Date(startDate);
  const end   = endDate ? new Date(endDate) : new Date(startDate);

  const { data: rows } = await supabase
    .from('ad_inventory')
    .select('id, date, reserved_slots')
    .eq('placement', placement)
    .gte('date', startDate)
    .lte('date', endDate ?? startDate);

  for (const row of (rows ?? []) as { id: string; date: string; reserved_slots: number }[]) {
    const newReserved = Math.max(0, row.reserved_slots - slotsPerDay);
    await supabase.from('ad_inventory').update({ reserved_slots: newReserved }).eq('id', row.id);
  }
}

// ─── Créer une campagne avec vérification crédits + inventaire ────────────────
export async function createCampaignWithChecks(
  input: CreateCampaignInput,
  slotsPerDay = 1,
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  const { seller_id, budget_credits, placement, start_date, end_date } = input;

  // 1. Vérifier le solde
  const balance = await getSellerBalance(seller_id);
  if (balance < budget_credits) {
    return { success: false, error: `Crédits insuffisants. Solde: ${balance.toFixed(2)}, requis: ${budget_credits.toFixed(2)}` };
  }

  // 2. Vérifier l'inventaire (uniquement pour campagnes avec placement)
  const needsInventory = ['sponsored_product','sponsored_brand','sponsored_category','sponsored_boutique','flash_sale'].includes(input.type);
  if (needsInventory && placement && start_date && end_date) {
    const inv = await checkInventory(placement, start_date, end_date, slotsPerDay);
    if (!inv.available) {
      return { success: false, error: `Inventaire saturé pour les jours: ${inv.blockedDays.slice(0, 3).join(', ')}` };
    }
  }

  // 3. Déduire crédits
  const deduction = await deductSellerCredits(seller_id, budget_credits, 'campaign_deduction', undefined, `Campagne: ${input.name}`);
  if (!deduction.success) return { success: false, error: deduction.error };

  // 4. Créer la campagne
  const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
    seller_id,
    type: input.type,
    name: input.name,
    scope_type: input.scope_type ?? null,
    scope_value: input.scope_value ?? null,
    placement: placement ?? 'product_sidebar',
    budget_credits,
    daily_credits: input.daily_credits ?? null,
    start_date,
    end_date: end_date ?? null,
    status: 'active' as CampaignStatus,
    metadata: input.metadata ?? {},
  }).select('id').single();

  if (campErr) {
    // Rembourser en cas d'erreur
    await addSellerCredits(seller_id, budget_credits, 'campaign_refund', undefined, 'Remboursement erreur création campagne');
    return { success: false, error: campErr.message };
  }

  const campaignId = (campaign as { id: string }).id;

  // 5. Réserver inventaire
  if (needsInventory && placement && start_date && end_date) {
    await reserveInventory(placement, start_date, end_date, slotsPerDay);
  }

  // 6. Mettre à jour reference_id de la transaction crédit
  await supabase.from('credit_transactions')
    .update({ reference_id: campaignId })
    .eq('user_id', seller_id)
    .eq('type', 'campaign_deduction')
    .is('reference_id', null)
    .order('created_at', { ascending: false })
    .limit(1);

  return { success: true, campaignId };
}

// ─── Annuler une campagne + remboursement ─────────────────────────────────────
export async function cancelCampaign(
  campaignId: string,
  sellerId: string,
): Promise<{ success: boolean; refundedCredits: number; error?: string }> {
  const { data: camp } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!camp) return { success: false, refundedCredits: 0, error: 'Campagne introuvable' };
  const c = camp as {
    seller_id: string; status: string; budget_credits: number;
    spent_credits: number; start_date: string; end_date: string | null;
    placement: string; daily_credits: number | null;
  };

  if (!['active','pending','paused'].includes(c.status)) {
    return { success: false, refundedCredits: 0, error: 'Cette campagne ne peut pas être annulée' };
  }

  // Calculer les crédits non utilisés
  const today = new Date().toISOString().slice(0, 10);
  const endDate = c.end_date ?? today;
  const unusedCredits = Math.max(0, c.budget_credits - c.spent_credits);

  // Mettre à jour le statut
  await supabase.from('campaigns').update({
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId);

  // Rembourser les crédits non utilisés
  if (unusedCredits > 0) {
    await addSellerCredits(c.seller_id, unusedCredits, 'campaign_refund', campaignId, `Remboursement annulation campagne`);
  }

  // Libérer l'inventaire publicitaire pour les jours restants
  const needsInventory = true; // simplification
  if (needsInventory && c.placement && c.daily_credits) {
    await freeInventory(c.placement, today, endDate, 1);
  }

  return { success: true, refundedCredits: unusedCredits };
}

// ─── Déclencher notification admin ────────────────────────────────────────────
export async function triggerAdminNotification(
  type: AdminMktNotifType,
  message: string,
  entityType?: string,
  entityId?: string,
): Promise<void> {
  await supabase.from('admin_marketing_notifications').insert({
    type,
    message,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
  });
}

// ─── Vérifier limite tier acheteur ────────────────────────────────────────────
export async function checkBuyerTierLimit(
  buyerId: string,
  limitType: 'requests' | 'campaigns' | 'samples' | 'rfq',
): Promise<{ allowed: boolean; used: number; limit: number; tierName: string }> {
  const { data: sub } = await supabase
    .from('buyer_subscriptions')
    .select('*, tiers(*)')
    .eq('user_id', buyerId)
    .maybeSingle();

  if (!sub) {
    // Pas d'abonnement → tier Free par défaut
    await ensureBuyerSubscription(buyerId);
    return { allowed: true, used: 0, limit: 3, tierName: 'Free' };
  }

  const s = sub as {
    requests_used_this_month: number;
    campaigns_used_this_month: number;
    samples_used_this_month: number;
    rfq_used_this_month: number;
    tiers: {
      name: string;
      max_requests_per_month: number;
      max_active_campaigns: number;
      max_samples_per_month: number;
      max_rfq_per_month: number;
    } | null;
  };

  const tierName = s.tiers?.name ?? 'Free';
  const fieldMap = {
    requests:  { used: s.requests_used_this_month,  limit: s.tiers?.max_requests_per_month  ?? 3  },
    campaigns: { used: s.campaigns_used_this_month, limit: s.tiers?.max_active_campaigns    ?? 1  },
    samples:   { used: s.samples_used_this_month,   limit: s.tiers?.max_samples_per_month   ?? 1  },
    rfq:       { used: s.rfq_used_this_month,        limit: s.tiers?.max_rfq_per_month       ?? 5  },
  };

  const { used, limit } = fieldMap[limitType];
  return { allowed: used < limit, used, limit, tierName };
}

// ─── Incrémenter usage acheteur ───────────────────────────────────────────────
export async function incrementBuyerUsage(
  buyerId: string,
  limitType: 'requests' | 'campaigns' | 'samples' | 'rfq',
): Promise<void> {
  const fieldMap: Record<string, string> = {
    requests:  'requests_used_this_month',
    campaigns: 'campaigns_used_this_month',
    samples:   'samples_used_this_month',
    rfq:       'rfq_used_this_month',
  };
  const field = fieldMap[limitType];
  const { data: sub } = await supabase.from('buyer_subscriptions').select(field).eq('user_id', buyerId).maybeSingle();
  if (!sub) return;
  const current = (sub as Record<string, number>)[field] ?? 0;
  await supabase.from('buyer_subscriptions').update({ [field]: current + 1, updated_at: new Date().toISOString() }).eq('user_id', buyerId);
}

// ─── S'assurer qu'un acheteur a un abonnement (Free par défaut) ───────────────
export async function ensureBuyerSubscription(buyerId: string): Promise<void> {
  const { data: freeTier } = await supabase.from('tiers').select('id').eq('name', 'Free').maybeSingle();
  if (!freeTier) return;

  await supabase.from('buyer_subscriptions').upsert(
    { user_id: buyerId, tier_id: (freeTier as { id: string }).id },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
}

// ─── Ajouter points fidélité ──────────────────────────────────────────────────
export async function addLoyaltyPoints(
  buyerId: string,
  points: number,
  type: LoyaltyTransactionType,
  referenceId?: string,
  description?: string,
): Promise<void> {
  const { data: sub } = await supabase.from('buyer_subscriptions').select('loyalty_points').eq('user_id', buyerId).single();
  if (!sub) return;

  const current = (sub as { loyalty_points: number }).loyalty_points ?? 0;
  const newBalance = current + points;

  await supabase.from('buyer_subscriptions').update({ loyalty_points: newBalance }).eq('user_id', buyerId);
  await supabase.from('loyalty_transactions').insert({
    user_id: buyerId,
    points,
    type,
    reference_id: referenceId ?? null,
    description: description ?? null,
    balance_after: newBalance,
  });
}

// ─── Obtenir coût crédit pour une action ─────────────────────────────────────
export async function getCreditCost(actionType: string): Promise<number> {
  const { data } = await supabase.from('credit_costs').select('credits_per_unit').eq('action_type', actionType).single();
  return (data as { credits_per_unit: number } | null)?.credits_per_unit ?? 0;
}

// ─── Calculer budget campagne ────────────────────────────────────────────────
export function computeCampaignBudget(
  type: CampaignType,
  dailyCredits: number,
  durationDays: number,
  units = 1,
): number {
  if (type === 'digital_sampling') return dailyCredits * units; // dailyCredits = cost per sample
  if (type === 'rfq_boost' || type === 'rfq_bid_boost') return dailyCredits; // flat fee
  return dailyCredits * durationDays;
}

// ─── Formater les crédits ─────────────────────────────────────────────────────
export function formatCredits(amount: number): string {
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} crédits`;
}

// ─── Calculer jours entre deux dates ─────────────────────────────────────────
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
}
