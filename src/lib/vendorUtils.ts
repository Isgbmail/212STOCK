import type { StatusIndicatorProps } from '@cloudscape-design/components';

// ─── Currency formatters ───────────────────────────────────────────────────────
export function fmtMAD(n: number): string {
  return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' MAD';
}

export function fmtEUR(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

export function fmtCurrency(n: number, currency = 'EUR'): string {
  if (currency === 'MAD') return fmtMAD(n);
  if (currency === 'EUR') return fmtEUR(n);
  return `${n.toFixed(2)} ${currency}`;
}

// ─── Order status ─────────────────────────────────────────────────────────────
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending:        'En attente',
  confirmed:      'Confirmée',
  in_preparation: 'En préparation',
  shipped:        'Expédiée',
  delivered:      'Livrée',
  cancelled:      'Annulée',
  dispute:        'Litige',
};

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:        ['confirmed', 'cancelled'],
  confirmed:      ['in_preparation', 'cancelled'],
  in_preparation: ['shipped', 'dispute'],
  shipped:        ['delivered', 'dispute'],
  dispute:        ['in_preparation', 'cancelled'],
};

export function orderStatusType(s: string): StatusIndicatorProps.Type {
  if (s === 'delivered') return 'success';
  if (s === 'cancelled') return 'error';
  if (s === 'dispute')   return 'warning';
  if (s === 'shipped')   return 'info';
  return 'in-progress';
}

// ─── Quote status ─────────────────────────────────────────────────────────────
export const QUOTE_STATUS_LABELS: Record<string, string> = {
  new:         'Nouveau',
  in_progress: 'En cours',
  responded:   'Répondu',
  accepted:    'Accepté',
  refused:     'Refusé',
  expired:     'Expiré',
  converted:   'Converti',
};

export function quoteStatusType(s: string): StatusIndicatorProps.Type {
  if (s === 'accepted' || s === 'converted') return 'success';
  if (s === 'refused' || s === 'expired')    return 'error';
  if (s === 'responded')                     return 'info';
  if (s === 'in_progress')                   return 'in-progress';
  return 'pending';
}

// ─── Invoice / finance status ─────────────────────────────────────────────────
export type InvStatus = 'pending' | 'overdue' | 'paid';

export const INV_STATUS: Record<InvStatus, { label: string; type: 'success' | 'pending' | 'error' }> = {
  paid:    { label: 'Payée',      type: 'success' },
  pending: { label: 'En attente', type: 'pending' },
  overdue: { label: 'En retard',  type: 'error' },
};

export type ReminderStatus = 'to_send' | 'sent' | 'litigation';

export const REM_STATUS: Record<ReminderStatus, { label: string; color: 'grey' | 'blue' | 'red' }> = {
  to_send:    { label: 'À envoyer',   color: 'grey' },
  sent:       { label: 'Envoyée',     color: 'blue' },
  litigation: { label: 'Contentieux', color: 'red' },
};

// ─── Return status / reason ────────────────────────────────────────────────────
export const RETURN_REASON_LABELS: Record<string, string> = {
  damaged:       'Endommagé',
  wrong_product: 'Non conforme',
  quality_issue: 'Qualité',
  expired:       'DLC dépassée',
  excess:        'Excès',
  other:         'Autre',
};

export const RETURN_REFUND_LABELS: Record<string, string> = {
  avoir:    'Avoir',
  exchange: 'Échange',
  refund:   'Remboursement',
};

export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested:  'Demandé',
  approved:   'Approuvé',
  rejected:   'Refusé',
  in_transit: 'En transit',
  received:   'Reçu',
  completed:  'Traité',
};

export function returnStatusType(s: string): StatusIndicatorProps.Type {
  if (s === 'completed' || s === 'approved') return 'success';
  if (s === 'rejected')                      return 'error';
  return 'in-progress';
}

// ─── Product status ───────────────────────────────────────────────────────────
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active:   'Actif',
  draft:    'Brouillon',
  inactive: 'Inactif',
  archived: 'Archivé',
};

// ─── Carrier type (table: carriers) ──────────────────────────────────────────
export interface Carrier {
  id: string; name: string; type: 'external' | 'internal' | '3pl';
  regions: string[]; cold_chain: boolean; urgent: boolean;
  price_per_kg: number; avg_days: number; phone?: string;
  driver_name?: string; vehicle?: string;
}
