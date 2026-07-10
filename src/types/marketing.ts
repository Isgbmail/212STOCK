// ─── Campaign ──────────────────────────────────────────────────────────────────
export type CampaignType =
  | 'sponsored_product' | 'sponsored_brand' | 'sponsored_category' | 'sponsored_boutique'
  | 'destocking' | 'volume_deal' | 'promo_code' | 'trade_deal' | 'flash_sale'
  | 'digital_sampling' | 'rfq_boost' | 'cross_sell'
  // Blocs merchandising v2
  | 'top_banner' | 'deal_of_day' | 'footer_banner' | 'extra_remise'
  | 'category_row' | 'recommended_slot' | 'search_sponsored' | 'cart_cross_sell';

export type CampaignStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected';

export type CampaignScopeType = 'item' | 'boutique' | 'brand' | 'category';

export interface Campaign {
  id: string;
  seller_id: string;
  type: CampaignType;
  name: string;
  scope_type: CampaignScopeType | null;
  scope_value: string | null;
  placement: string;
  budget_credits: number;
  spent_credits: number;
  daily_credits: number | null;
  start_date: string;
  end_date: string | null;
  status: CampaignStatus;
  metadata: Record<string, unknown>;
  impressions: number;
  clicks: number;
  orders_attributed: number;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  profiles?: { full_name: string | null; email: string | null } | null;
}

// ─── Tier ─────────────────────────────────────────────────────────────────────
export interface Tier {
  id: string;
  name: string;
  monthly_price: number;
  max_requests_per_month: number;
  max_active_campaigns: number;
  max_samples_per_month: number;
  max_rfq_per_month: number;
  priority_queue: boolean;
  analytics_access: boolean;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Buyer subscription ────────────────────────────────────────────────────────
export interface BuyerSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  start_date: string;
  end_date: string | null;
  requests_used_this_month: number;
  campaigns_used_this_month: number;
  samples_used_this_month: number;
  rfq_used_this_month: number;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
  // joined
  tiers?: Tier | null;
}

// ─── Credit pack ───────────────────────────────────────────────────────────────
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  bonus_credits: number;
  active: boolean;
  created_at: string;
}

// ─── Credit plan ───────────────────────────────────────────────────────────────
export interface CreditPlan {
  id: string;
  name: string;
  monthly_credits: number;
  monthly_price: number;
  currency: string;
  active: boolean;
  created_at: string;
}

// ─── Credit transaction ────────────────────────────────────────────────────────
export type CreditTransactionType =
  | 'pack_purchase' | 'subscription_renewal' | 'campaign_deduction' | 'campaign_refund'
  | 'liquidation_fee' | 'admin_adjustment' | 'sample_deduction' | 'rfq_boost_deduction'
  | 'loyalty_redemption' | 'cross_sell_deduction' | 'rfq_bid_boost_deduction' | 'tier_purchase';

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: CreditTransactionType;
  reference_id: string | null;
  description: string | null;
  balance_after: number | null;
  created_at: string;
}

// ─── Credit cost ───────────────────────────────────────────────────────────────
export type CreditCostKey =
  | 'sponsored_product_per_day' | 'sponsored_brand_per_day'
  | 'sponsored_category_per_day' | 'sponsored_boutique_per_day'
  | 'flash_sale_per_day' | 'digital_sample_per_unit'
  | 'rfq_bid_boost' | 'rfq_homepage_boost' | 'cross_sell_per_day'
  | 'liquidation_fee_pct' | 'loyalty_point_value'
  // v2 blocs
  | 'top_banner_per_day' | 'deal_of_day_per_slot' | 'footer_banner_per_day'
  | 'extra_remise_per_day' | 'category_row_per_day' | 'recommended_slot_per_day'
  | 'search_sponsored_per_day' | 'cart_cross_sell_per_day';

export interface CreditCost {
  id: string;
  action_type: string;
  credits_per_unit: number;
  unit: string;
  description: string | null;
  updated_at: string;
}

// ─── Ad inventory ──────────────────────────────────────────────────────────────
export interface AdInventoryCap {
  id: string;
  placement: string;
  daily_slots: number;
  description: string | null;
  active: boolean;
  updated_at: string;
}

export interface AdInventory {
  id: string;
  placement: string;
  date: string;
  total_slots: number;
  reserved_slots: number;
  created_at: string;
}

// ─── Promotion request ─────────────────────────────────────────────────────────
export type PromotionRequestType = 'trade' | 'flash_sale';
export type PromotionRequestStatus = 'pending' | 'approved' | 'rejected' | 'auto_created';

export interface PromotionRequest {
  id: string;
  buyer_id: string;
  product_id: string;
  type: PromotionRequestType;
  desired_discount: number | null;
  status: PromotionRequestStatus;
  notes: string | null;
  created_at: string;
  // joined
  products?: { name: string } | null;
  profiles?: { full_name: string | null } | null;
}

// ─── Liquidation lot ───────────────────────────────────────────────────────────
export type LotScope = 'item' | 'product_line' | 'boutique';
export type LotSaleType = 'auction' | 'fixed_price';
export type LotStatus = 'draft' | 'active' | 'sold' | 'unsold' | 'cancelled';

export interface LiquidationLot {
  id: string;
  seller_id: string;
  campaign_id: string | null;
  title: string;
  description: string | null;
  scope: LotScope;
  product_ids: string[];
  sale_type: LotSaleType;
  start_price: number | null;
  buy_now_price: number | null;
  reserve_price: number | null;
  current_bid: number;
  bid_count: number;
  winner_buyer_id: string | null;
  auction_end_at: string | null;
  status: LotStatus;
  platform_fee_pct: number;
  images: string[];
  quantity: number;
  currency: string;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: { full_name: string | null } | null;
}

export interface LiquidationBid {
  id: string;
  lot_id: string;
  bidder_id: string;
  amount: number;
  is_winning: boolean;
  created_at: string;
  // joined
  profiles?: { full_name: string | null } | null;
}

// ─── Sampling ──────────────────────────────────────────────────────────────────
export interface SamplingCampaign {
  id: string;
  campaign_id: string;
  product_id: string;
  sample_price: number;
  shipping_cost: number;
  max_samples: number;
  samples_sent: number;
  auto_approve: boolean;
  created_at: string;
  // joined
  products?: { name: string; images: string[] } | null;
}

export interface SamplingRequest {
  id: string;
  sampling_campaign_id: string;
  buyer_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'shipped';
  shipping_address: Record<string, string>;
  notes: string | null;
  created_at: string;
  // joined
  profiles?: { full_name: string | null; email: string | null } | null;
  sampling_campaigns?: SamplingCampaign | null;
}

// ─── RFQ ──────────────────────────────────────────────────────────────────────
export type RFQStatus = 'open' | 'closed' | 'awarded';

export interface RFQPost {
  id: string;
  buyer_id: string;
  product_name: string;
  category_id: string | null;
  quantity: number;
  desired_price: number | null;
  description: string | null;
  status: RFQStatus;
  is_boosted: boolean;
  boost_expires_at: string | null;
  created_at: string;
  expires_at: string | null;
  // joined
  profiles?: { full_name: string | null } | null;
  categories?: { name: string } | null;
  rfq_bids?: RFQBid[];
}

export interface RFQBid {
  id: string;
  rfq_id: string;
  seller_id: string;
  bid_price: number;
  notes: string | null;
  is_boosted: boolean;
  boost_credits_paid: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  // joined
  profiles?: { full_name: string | null } | null;
}

// ─── Loyalty ───────────────────────────────────────────────────────────────────
export type LoyaltyTransactionType = 'earn_order' | 'redeem_requests' | 'redeem_credits' | 'admin_adjust';

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  points: number;
  type: LoyaltyTransactionType;
  reference_id: string | null;
  description: string | null;
  balance_after: number | null;
  created_at: string;
}

// ─── Admin marketing notification ─────────────────────────────────────────────
export type AdminMktNotifType =
  | 'buyer_tier_upgrade' | 'buyer_limit_reached' | 'seller_credits_low'
  | 'inventory_nearly_full' | 'promotion_budget_depleted' | 'flash_sale_threshold_reached';

export interface AdminMarketingNotification {
  id: string;
  type: AdminMktNotifType;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Marketing config ─────────────────────────────────────────────────────────
export interface MarketingConfig {
  id: string;
  flash_sale_request_threshold: number;
  seller_low_credits_pct: number;
  inventory_alert_pct: number;
  promotion_stacking_allowed: boolean;
  default_platform_fee_pct: number;
  min_campaign_duration_days: number;
  max_campaign_duration_days: number;
  buyer_points_per_dollar: number;
  updated_at: string;
}

// ─── Cross sell rules ─────────────────────────────────────────────────────────
export interface CrossSellRule {
  id: string;
  rule_type: 'product_to_product' | 'category_to_product';
  trigger_product_id: string | null;
  trigger_category_id: string | null;
  recommended_product_id: string;
  seller_paid: boolean;
  credits_bid: number;
  campaign_id: string | null;
  active: boolean;
  created_at: string;
}

// ─── Create campaign input ────────────────────────────────────────────────────
export interface CreateCampaignInput {
  seller_id: string;
  type: CampaignType;
  name: string;
  scope_type?: CampaignScopeType;
  scope_value?: string;
  placement?: string;
  budget_credits: number;
  daily_credits?: number;
  start_date: string;
  end_date?: string;
  metadata?: Record<string, unknown>;
}
