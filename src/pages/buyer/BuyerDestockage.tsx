import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SpaceBetween, Header, Button, Box, Select,
  Container, Spinner, Alert, Flashbar, Badge,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DestockProduct {
  id: string; name: string; ean: string | null; images: string[];
  temperature: string; moq: number; is_on_promotion: boolean;
  short_description: string | null; seller_org_id: string;
  organisations: { id: string; name: string } | null;
  categories: { id: string; name: string } | null;
  price_tiers: { qty_min: number; unit_price: number }[];
}

interface ProductLot {
  id: string; product_id: string; lot_number: string;
  quantity: number; dlc_date: string | null; unit_cost: number | null;
  products: {
    id: string; name: string; ean: string | null; images: string[]; temperature: string; moq: number;
    organisations: { id: string; name: string } | null;
    categories: { id: string; name: string } | null;
    price_tiers: { qty_min: number; unit_price: number }[];
  } | null;
}

interface DlcItem {
  id: string; name: string; ean: string | null; images: string[];
  temperature: string; moq: number; lotNumber: string;
  quantity: number; dlcDate: string; daysLeft: number; unitCost: number | null;
  organisations: { id: string; name: string } | null;
  price_tiers: { qty_min: number; unit_price: number }[];
}

const DLC_THRESHOLDS = [
  { label: 'Tous les DLC',         value: '999' },
  { label: 'DLC < 30 jours',       value: '30'  },
  { label: 'DLC < 60 jours',       value: '60'  },
  { label: 'DLC < 90 jours',       value: '90'  },
];
const SORT_OPTIONS = [
  { label: 'DLC le plus urgent',    value: 'dlc_asc'    },
  { label: 'Remise la plus haute',  value: 'discount_desc' },
  { label: 'Prix croissant',        value: 'price_asc'  },
  { label: 'Stock décroissant',     value: 'qty_desc'   },
];

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function dlcColor(days: number) {
  return days <= 14 ? '#dc2626' : days <= 30 ? '#d97706' : '#16a34a';
}
function urgencyLabel(days: number) {
  return days <= 14 ? 'URGENT' : days <= 30 ? 'BIENTÔT' : 'DISPONIBLE';
}
function basePrice(tiers: { qty_min: number; unit_price: number }[]) {
  if (!tiers?.length) return null;
  return [...tiers].sort((a, b) => a.qty_min - b.qty_min)[0].unit_price;
}

export default function BuyerDestockage() {
  const navigate  = useNavigate();
  const { activeOrg } = useAuth();

  const [loadingPromo, setLoadingPromo] = useState(true);
  const [loadingDlc,   setLoadingDlc]   = useState(true);
  const [promos,       setPromos]       = useState<DestockProduct[]>([]);
  const [dlcItems,     setDlcItems]     = useState<DlcItem[]>([]);
  const [tab,          setTab]          = useState<'promo' | 'dlc'>('promo');
  const [dlcFilter,    setDlcFilter]    = useState('90');
  const [sort,         setSort]         = useState('dlc_asc');
  const [cartMsg,      setCartMsg]      = useState('');

  useEffect(() => { loadPromos(); loadDlcItems(); }, []);

  async function loadPromos() {
    setLoadingPromo(true);
    const { data } = await supabase
      .from('products')
      .select(`id, name, ean, images, temperature, moq, is_on_promotion, short_description, seller_org_id,
        organisations!seller_org_id (id, name),
        categories (id, name),
        price_tiers (qty_min, unit_price)`)
      .eq('status', 'active')
      .eq('is_on_promotion', true)
      .order('created_at', { ascending: false })
      .limit(48);
    setPromos((data ?? []) as DestockProduct[]);
    setLoadingPromo(false);
  }

  async function loadDlcItems() {
    setLoadingDlc(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);
    const { data } = await supabase
      .from('product_lots')
      .select(`id, product_id, lot_number, quantity, dlc_date, unit_cost,
        products (id, name, ean, images, temperature, moq,
          organisations!seller_org_id (id, name),
          categories (id, name),
          price_tiers (qty_min, unit_price))`)
      .not('dlc_date', 'is', null)
      .gt('dlc_date', new Date().toISOString().slice(0, 10))
      .lte('dlc_date', cutoff.toISOString().slice(0, 10))
      .gt('quantity', 0)
      .order('dlc_date', { ascending: true })
      .limit(60);

    const items: DlcItem[] = ((data ?? []) as ProductLot[])
      .filter(l => l.products)
      .map(l => ({
        id: l.id,
        name: l.products!.name,
        ean: l.products!.ean,
        images: l.products!.images,
        temperature: l.products!.temperature,
        moq: l.products!.moq,
        lotNumber: l.lot_number,
        quantity: l.quantity,
        dlcDate: l.dlc_date!,
        daysLeft: daysUntil(l.dlc_date!),
        unitCost: l.unit_cost,
        organisations: l.products!.organisations,
        price_tiers: l.products!.price_tiers,
      }));

    setDlcItems(items);
    setLoadingDlc(false);
  }

  async function addToCart(productId: string, moq: number, unitPrice: number | null) {
    if (!activeOrg || !unitPrice) return;
    const { data: ex } = await supabase
      .from('cart_items').select('id, quantity')
      .eq('buyer_org_id', activeOrg.id).eq('product_id', productId).is('cart_id', null).maybeSingle();
    if (ex) {
      await supabase.from('cart_items').update({ quantity: ex.quantity + moq }).eq('id', ex.id);
    } else {
      await supabase.from('cart_items').insert({
        buyer_org_id: activeOrg.id, product_id: productId,
        quantity: moq, unit_price: unitPrice, cart_id: null,
      });
    }
    setCartMsg('Produit ajouté au panier');
    setTimeout(() => setCartMsg(''), 3000);
  }

  // Filtered & sorted DLC
  const filteredDlc = dlcItems
    .filter(i => i.daysLeft <= parseInt(dlcFilter))
    .sort((a, b) => {
      if (sort === 'dlc_asc')       return a.daysLeft - b.daysLeft;
      if (sort === 'price_asc')     return (basePrice(a.price_tiers) ?? 99999) - (basePrice(b.price_tiers) ?? 99999);
      if (sort === 'qty_desc')      return b.quantity - a.quantity;
      return 0;
    });

  return (
    <SpaceBetween size="m">
      {cartMsg && (
        <Flashbar items={[{ type: 'success', content: cartMsg, dismissible: true, onDismiss: () => setCartMsg('') }]} />
      )}

      <Header
        variant="h1"
        description="Produits en promotion et lots à date de péremption proche — prix négociés, stocks limités"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate('/buyer/catalog')}>← Catalogue</Button>
            <Button variant="primary" onClick={() => navigate('/buyer/optimizer')} iconName="settings">Optimiseur</Button>
          </SpaceBetween>
        }
      >
        Déstockage & Promotions
      </Header>

      {/* Tab switch */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb' }}>
        {([['promo', `🏷 Promotions (${promos.length})`], ['dlc', `⏰ Lots DLC proche (${dlcItems.length})`]] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as 'promo' | 'dlc')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontWeight: tab === key ? 700 : 500,
              fontSize: 14, color: tab === key ? '#0972d3' : '#5f6b7a',
              borderBottom: tab === key ? '2px solid #0972d3' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── PROMO TAB ──────────────────────────────────────── */}
      {tab === 'promo' && (
        loadingPromo ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="large" /></div>
        ) : promos.length === 0 ? (
          <Box textAlign="center" color="text-body-secondary" padding="xxxl">Aucun produit en promotion actuellement.</Box>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {promos.map(p => {
              const price = basePrice(p.price_tiers);
              return (
                <div key={p.id} style={{ border: '2px solid #fca5a5', borderRadius: 10, background: '#fff', overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(220,38,38,0.08)' }}>
                  <div style={{ position: 'relative', background: '#fef2f2', height: 140 }}>
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>}
                    <div style={{ position: 'absolute', top: 6, left: 6, background: '#dc2626', color: '#fff',
                        fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 4 }}>
                      PROMO
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{p.organisations?.name ?? '—'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1b2d', margin: '4px 0',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.name}
                    </div>
                    {price != null && (
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#dc2626' }}>
                        {price.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}> / unité dès {p.moq}</span>
                      </div>
                    )}
                    <button
                      onClick={() => addToCart(p.id, p.moq, price)}
                      disabled={!price}
                      style={{ marginTop: 8, width: '100%', background: price ? '#dc2626' : '#e5e7eb',
                          color: price ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6,
                          padding: '7px 0', fontWeight: 700, fontSize: 12, cursor: price ? 'pointer' : 'not-allowed' }}>
                      + Ajouter au panier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── DLC TAB ────────────────────────────────────────── */}
      {tab === 'dlc' && (
        <SpaceBetween size="m">
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 200 }}>
              <Select
                selectedOption={DLC_THRESHOLDS.find(o => o.value === dlcFilter) ?? DLC_THRESHOLDS[0]}
                options={DLC_THRESHOLDS}
                onChange={({ detail }) => setDlcFilter(detail.selectedOption.value ?? '90')}
              />
            </div>
            <div style={{ width: 200 }}>
              <Select
                selectedOption={SORT_OPTIONS.find(o => o.value === sort) ?? SORT_OPTIONS[0]}
                options={SORT_OPTIONS}
                onChange={({ detail }) => setSort(detail.selectedOption.value ?? 'dlc_asc')}
              />
            </div>
            <Box color="text-body-secondary">
              {filteredDlc.length} lot{filteredDlc.length !== 1 ? 's' : ''} affiché{filteredDlc.length !== 1 ? 's' : ''}
            </Box>
          </div>

          <Alert type="warning">
            Les lots ci-dessous sont proposés par les vendeurs pour écouler leurs stocks avant péremption.
            Les prix peuvent être inférieurs au tarif catalogue habituel. Vérifiez les DLCs avant commande.
          </Alert>

          {loadingDlc ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="large" /></div>
          ) : filteredDlc.length === 0 ? (
            <Box textAlign="center" color="text-body-secondary" padding="xxxl">
              Aucun lot avec DLC dans ce délai.
            </Box>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {filteredDlc.map(item => {
                const price = basePrice(item.price_tiers);
                const col = dlcColor(item.daysLeft);
                return (
                  <div key={item.id} style={{ border: `2px solid ${col}33`, borderRadius: 10,
                      background: '#fff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ background: col + '18', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: col, textTransform: 'uppercase' }}>
                        ⏰ {urgencyLabel(item.daysLeft)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: col }}>
                        J−{item.daysLeft}
                      </span>
                    </div>

                    <div style={{ position: 'relative', background: '#f8f9fa', height: 130 }}>
                      {item.images?.[0]
                        ? <img src={item.images[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>}
                    </div>

                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{item.organisations?.name ?? '—'}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1b2d', margin: '4px 0',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#5f6b7a', marginBottom: 6 }}>
                        Lot {item.lotNumber} · {item.quantity} unités · DLC {new Date(item.dlcDate).toLocaleDateString('fr-FR')}
                      </div>
                      {price != null && (
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1b2d' }}>
                          {price.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}> / unité</span>
                        </div>
                      )}
                      <button
                        onClick={() => addToCart(item.id, item.moq, price)}
                        disabled={!price}
                        style={{ marginTop: 8, width: '100%', background: price ? col : '#e5e7eb',
                            color: price ? '#fff' : '#9ca3af', border: 'none', borderRadius: 6,
                            padding: '7px 0', fontWeight: 700, fontSize: 12, cursor: price ? 'pointer' : 'not-allowed' }}>
                        + Ajouter au panier
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
}
