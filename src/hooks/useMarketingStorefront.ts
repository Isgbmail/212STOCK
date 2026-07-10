import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Campaign, LiquidationLot, RFQPost } from '../types/marketing';

// ─── Extended campaign interfaces ─────────────────────────────────────────────
export interface PromoCampaign extends Campaign {
  code?: string;
  discount_pct?: number;
}
export interface FlashCampaign extends Campaign {
  discount_pct?: number;
  product_ids?: string[];
}
export interface VolumeDealCampaign extends Campaign {
  min_quantity?: number;
  discount_pct?: number;
}
export interface TopBannerCampaign extends Campaign {
  image_url?: string;
  headline?: string;
  subline?: string;
  cta_text?: string;
  cta_link?: string;
  bg_color?: string;
}
export interface DealOfDayCampaign extends Campaign {
  product_id?: string;
  special_price?: number;
  original_price?: number;
  discount_pct?: number;
  available_qty?: number;
}
export interface FooterBannerCampaign extends Campaign {
  image_url?: string;
  headline?: string;
  subline?: string;
  cta_link?: string;
  bg_color?: string;
}
export interface ExtraRemiseCampaign extends Campaign {
  discount_pct?: number;
  code?: string;
  min_order?: number;
  label?: string;
  color?: string;
}
export interface CategoryRowCampaign extends Campaign {
  category_id?: string;
  category_name?: string;
  headline?: string;
}

// ─── Storefront data shape ────────────────────────────────────────────────────
export interface MarketingStorefrontData {
  // V1
  promoCodes: PromoCampaign[];
  flashSales: FlashCampaign[];
  volumeDeals: VolumeDealCampaign[];
  sponsoredProductIds: string[];
  activeLots: LiquidationLot[];
  // V2 blocs
  topBanners: TopBannerCampaign[];
  dealOfDay: DealOfDayCampaign | null;
  footerBanners: FooterBannerCampaign[];
  extraRemises: ExtraRemiseCampaign[];
  categoryRows: CategoryRowCampaign[];
  boostedRFQs: RFQPost[];
  loading: boolean;
}

function meta<T>(c: Campaign, key: string): T | undefined {
  return (c.metadata as Record<string, unknown>)?.[key] as T | undefined;
}

export function useMarketingStorefront(): MarketingStorefrontData {
  const [promoCodes,          setPromoCodes]          = useState<PromoCampaign[]>([]);
  const [flashSales,          setFlashSales]          = useState<FlashCampaign[]>([]);
  const [volumeDeals,         setVolumeDeals]         = useState<VolumeDealCampaign[]>([]);
  const [sponsoredProductIds, setSponsoredProductIds] = useState<string[]>([]);
  const [activeLots,          setActiveLots]          = useState<LiquidationLot[]>([]);
  const [topBanners,          setTopBanners]          = useState<TopBannerCampaign[]>([]);
  const [dealOfDay,           setDealOfDay]           = useState<DealOfDayCampaign | null>(null);
  const [footerBanners,       setFooterBanners]       = useState<FooterBannerCampaign[]>([]);
  const [extraRemises,        setExtraRemises]        = useState<ExtraRemiseCampaign[]>([]);
  const [categoryRows,        setCategoryRows]        = useState<CategoryRowCampaign[]>([]);
  const [boostedRFQs,         setBoostedRFQs]         = useState<RFQPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = (type: string) =>
      supabase.from('campaigns')
        .select('*').eq('status', 'active').eq('type', type)
        .or(`end_date.gte.${today},end_date.is.null`);

    Promise.all([
      // V1
      active('promo_code'),
      active('flash_sale'),
      active('volume_deal'),
      supabase.from('campaigns').select('scope_value').eq('status', 'active')
        .in('type', ['sponsored_product', 'sponsored_brand', 'sponsored_boutique'])
        .or(`end_date.gte.${today},end_date.is.null`),
      supabase.from('liquidation_lots').select('*, profiles(full_name)').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(10),
      // V2
      active('top_banner'),
      active('deal_of_day'),
      active('footer_banner'),
      active('extra_remise'),
      active('category_row'),
      supabase.from('rfq_posts').select('*, profiles(full_name), categories(name), rfq_bids(*)')
        .eq('status', 'open').eq('is_boosted', true)
        .gt('boost_expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(6),
      // Platform content_items fallback (bannières éditoriales + highlights)
      supabase.from('content_items').select('*').eq('active', true).eq('type', 'banner').order('display_order'),
      supabase.from('content_items').select('*').eq('active', true).eq('type', 'highlight').order('display_order'),
    ]).then(([
      promoRes, flashRes, volRes, sponsRes, lotsRes,
      bannerRes, dodRes, footerRes, remiseRes, catRowRes, rfqRes,
      platformBannersRes, platformRemisesRes,
    ]) => {
      setPromoCodes((promoRes.data ?? []).map(c => ({
        ...(c as Campaign),
        code: meta(c as Campaign, 'code') as string,
        discount_pct: meta(c as Campaign, 'discount_pct') as number,
      })));

      setFlashSales((flashRes.data ?? []).map(c => ({
        ...(c as Campaign),
        discount_pct: meta(c as Campaign, 'discount_pct') as number,
      })));

      setVolumeDeals((volRes.data ?? []).map(c => ({
        ...(c as Campaign),
        min_quantity: meta(c as Campaign, 'min_quantity') as number,
        discount_pct: meta(c as Campaign, 'discount_pct') as number,
      })));

      setSponsoredProductIds(
        (sponsRes.data ?? [])
          .map((r: { scope_value: string | null }) => r.scope_value)
          .filter((v): v is string => Boolean(v))
      );

      setActiveLots((lotsRes.data ?? []) as LiquidationLot[]);

      type ContentItem = { id: string; type: string; title: string; subtitle: string | null; body: string | null; cta_label: string | null; cta_url: string | null; image_url: string | null; display_order: number };
      const platformBanners = (platformBannersRes.data ?? []) as ContentItem[];
      const platformRemises = (platformRemisesRes.data ?? []) as ContentItem[];

      const campaignBanners = (bannerRes.data ?? []).map(c => ({
        ...(c as Campaign),
        image_url:  meta(c as Campaign, 'image_url') as string,
        headline:   meta(c as Campaign, 'headline') as string,
        subline:    meta(c as Campaign, 'subline') as string,
        cta_text:   meta(c as Campaign, 'cta_text') as string,
        cta_link:   meta(c as Campaign, 'cta_link') as string,
        bg_color:   meta(c as Campaign, 'bg_color') as string,
      }));

      const topFromContent: TopBannerCampaign[] = platformBanners
        .filter(b => { try { return JSON.parse(b.body ?? '{}').banner_position === 'top'; } catch { return false; } })
        .map(b => {
          const parsed = JSON.parse(b.body ?? '{}');
          return { id: b.id, name: b.title, type: 'top_banner', status: 'active', placement: '', scope_type: null, scope_value: null, budget_credits: 0, spent_credits: 0, daily_credits: null, start_date: '', end_date: null, metadata: {}, impressions: 0, clicks: 0, orders_attributed: 0, cancellation_reason: null, created_at: '', updated_at: '', seller_id: '', headline: b.title, subline: b.subtitle ?? '', cta_text: b.cta_label ?? '', cta_link: b.cta_url ?? '', bg_color: parsed.bg, image_url: b.image_url ?? '' } as TopBannerCampaign;
        });

      setTopBanners(campaignBanners.length > 0 ? campaignBanners : topFromContent);

      const dods = (dodRes.data ?? []) as Campaign[];
      setDealOfDay(dods.length > 0 ? {
        ...dods[0],
        product_id:    meta(dods[0], 'product_id') as string,
        special_price: meta(dods[0], 'special_price') as number,
        original_price: meta(dods[0], 'original_price') as number,
        discount_pct:  meta(dods[0], 'discount_pct') as number,
        available_qty: meta(dods[0], 'available_qty') as number,
      } : null);

      const campaignFooters = (footerRes.data ?? []).map(c => ({
        ...(c as Campaign),
        image_url: meta(c as Campaign, 'image_url') as string,
        headline:  meta(c as Campaign, 'headline') as string,
        subline:   meta(c as Campaign, 'subline') as string,
        cta_link:  meta(c as Campaign, 'cta_link') as string,
        bg_color:  meta(c as Campaign, 'bg_color') as string,
      }));

      const footerFromContent: FooterBannerCampaign[] = platformBanners
        .filter(b => { try { return JSON.parse(b.body ?? '{}').banner_position === 'footer'; } catch { return false; } })
        .map(b => {
          const parsed = JSON.parse(b.body ?? '{}');
          return { id: b.id, name: b.title, type: 'footer_banner', status: 'active', placement: '', scope_type: null, scope_value: null, budget_credits: 0, spent_credits: 0, daily_credits: null, start_date: '', end_date: null, metadata: {}, impressions: 0, clicks: 0, orders_attributed: 0, cancellation_reason: null, created_at: '', updated_at: '', seller_id: '', headline: b.title, subline: b.subtitle ?? '', cta_link: b.cta_url ?? '', bg_color: parsed.bg, image_url: b.image_url ?? '' } as FooterBannerCampaign;
        });

      setFooterBanners(campaignFooters.length > 0 ? campaignFooters : footerFromContent);

      const campaignRemises = (remiseRes.data ?? []).map(c => ({
        ...(c as Campaign),
        discount_pct: meta(c as Campaign, 'discount_pct') as number,
        code:         meta(c as Campaign, 'code') as string,
        min_order:    meta(c as Campaign, 'min_order') as number,
        label:        meta(c as Campaign, 'label') as string,
        color:        meta(c as Campaign, 'color') as string,
      }));

      const remisesFromContent: ExtraRemiseCampaign[] = platformRemises.map(r => {
        const parsed = JSON.parse(r.body ?? '{}');
        return { id: r.id, name: r.title, type: 'extra_remise', status: 'active', placement: '', scope_type: null, scope_value: null, budget_credits: 0, spent_credits: 0, daily_credits: null, start_date: '', end_date: null, metadata: {}, impressions: 0, clicks: 0, orders_attributed: 0, cancellation_reason: null, created_at: '', updated_at: '', seller_id: '', label: r.title, code: parsed.code ?? null, color: parsed.color, min_order: undefined } as ExtraRemiseCampaign;
      });

      setExtraRemises(campaignRemises.length > 0 ? campaignRemises : remisesFromContent);

      setCategoryRows((catRowRes.data ?? []).map(c => ({
        ...(c as Campaign),
        category_id:   meta(c as Campaign, 'category_id') as string,
        category_name: meta(c as Campaign, 'category_name') as string,
        headline:      meta(c as Campaign, 'headline') as string,
      })));

      setBoostedRFQs((rfqRes.data ?? []) as RFQPost[]);
      setLoading(false);
    });
  }, []);

  return {
    promoCodes, flashSales, volumeDeals, sponsoredProductIds, activeLots,
    topBanners, dealOfDay, footerBanners, extraRemises, categoryRows, boostedRFQs,
    loading,
  };
}

// ─── Hook léger pour un produit spécifique ─────────────────────────────────────
export interface ProductCampaigns {
  volumeDeal: VolumeDealCampaign | null;
  promoCode: PromoCampaign | null;
  hasSampling: boolean;
  hasFlashSale: boolean;
}

export function useProductCampaigns(productId: string | undefined): ProductCampaigns {
  const [data, setData] = useState<ProductCampaigns>({ volumeDeal: null, promoCode: null, hasSampling: false, hasFlashSale: false });

  useEffect(() => {
    if (!productId) return;
    const today = new Date().toISOString().slice(0, 10);

    supabase.from('campaigns').select('*').eq('status', 'active').eq('scope_value', productId)
      .in('type', ['volume_deal', 'promo_code', 'digital_sampling', 'flash_sale'])
      .or(`end_date.gte.${today},end_date.is.null`)
      .then(({ data: rows }) => {
        const campaigns = (rows ?? []) as Campaign[];
        const vol = campaigns.find(c => c.type === 'volume_deal');
        const promo = campaigns.find(c => c.type === 'promo_code');
        setData({
          volumeDeal: vol ? { ...vol, min_quantity: meta(vol, 'min_quantity') as number, discount_pct: meta(vol, 'discount_pct') as number } : null,
          promoCode: promo ? { ...promo, code: meta(promo, 'code') as string, discount_pct: meta(promo, 'discount_pct') as number } : null,
          hasSampling: campaigns.some(c => c.type === 'digital_sampling'),
          hasFlashSale: campaigns.some(c => c.type === 'flash_sale'),
        });
      });
  }, [productId]);

  return data;
}
