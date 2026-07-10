import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SpaceBetween, Header, Button, Box, Input,
  FormField, Container, Spinner, Alert, Autosuggest, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface EanRef { id: string; ean: string; name: string; images: string[]; manufacturer_name: string | null; temperature: string }

interface VendorOffer {
  productId: string; vendorId: string; vendorName: string;
  vendorRating: number; vendorReviewCount: number;
  ean: string | null; stock: boolean;
  moq: number; estimatedLeadDays: number;
  tiers: { qty_min: number; unit_price: number }[];
  deliveryFree: number | null;   // free delivery above X MAD
  deliveryFee: number | null;    // otherwise Y MAD
}

function basePrice(tiers: { qty_min: number; unit_price: number }[], qty: number) {
  if (!tiers?.length) return null;
  const sorted = [...tiers].sort((a, b) => a.qty_min - b.qty_min);
  let price = sorted[0].unit_price;
  for (const t of sorted) {
    if (qty >= t.qty_min) price = t.unit_price;
  }
  return price;
}
function starRating(v: number) {
  if (!v) return '—';
  return '★'.repeat(Math.round(v)) + '☆'.repeat(5 - Math.round(v));
}

export default function BuyerComparateur() {
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery]   = useState(searchParams.get('ean') ?? searchParams.get('q') ?? '');
  const [suggestions, setSuggestions]   = useState<EanRef[]>([]);
  const [searching,   setSearching]     = useState(false);
  const [selectedRef, setSelectedRef]   = useState<EanRef | null>(null);
  const [offers,      setOffers]        = useState<VendorOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [qty,         setQty]           = useState(1);
  const [cartMsg,     setCartMsg]       = useState('');
  const sugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-run if ?ean= param provided
  useEffect(() => {
    const ean = searchParams.get('ean');
    if (ean) {
      setSearchQuery(ean);
      runSearchByEan(ean);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosuggest from ean_references
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    if (sugTimer.current) clearTimeout(sugTimer.current);
    setSearching(true);
    sugTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('ean_references')
        .select('id, ean, name, images, manufacturer_name, temperature')
        .eq('status', 'active')
        .or(`name.ilike.%${q}%,ean.ilike.%${q}%`)
        .limit(10);
      setSuggestions((data ?? []) as EanRef[]);
      setSearching(false);
    }, 350);
    return () => { if (sugTimer.current) clearTimeout(sugTimer.current); };
  }, [searchQuery]);

  async function runSearchByEan(ean: string) {
    setLoadingOffers(true);
    setOffers([]);
    // Find the reference
    const { data: ref } = await supabase
      .from('ean_references').select('id, ean, name, images, manufacturer_name, temperature')
      .eq('ean', ean).eq('status', 'active').maybeSingle();
    if (ref) setSelectedRef(ref as EanRef);

    // Find all products with this EAN
    const { data: products } = await supabase
      .from('products')
      .select(`id, ean, moq, estimated_lead_days, avg_rating, review_count, seller_org_id,
        organisations!seller_org_id (id, name, avg_rating, review_count),
        price_tiers (qty_min, unit_price)`)
      .eq('ean', ean).eq('status', 'active');

    if (!products?.length) { setLoadingOffers(false); return; }

    // Fetch delivery configs
    const vendorIds = products.map((p: any) => p.seller_org_id);
    const { data: deliveryConfigs } = await supabase
      .from('vendor_delivery_config')
      .select('org_id, free_delivery_threshold, delivery_fee_default')
      .in('org_id', vendorIds);

    const configMap: Record<string, { free: number | null; fee: number | null }> = {};
    for (const c of (deliveryConfigs ?? []) as any[]) {
      configMap[c.org_id] = { free: c.free_delivery_threshold, fee: c.delivery_fee_default };
    }

    const vendorOffers: VendorOffer[] = (products as any[]).map(p => ({
      productId: p.id,
      vendorId: p.seller_org_id,
      vendorName: p.organisations?.name ?? '—',
      vendorRating: p.avg_rating ?? 0,
      vendorReviewCount: p.review_count ?? 0,
      ean: p.ean,
      stock: true,
      moq: p.moq,
      estimatedLeadDays: p.estimated_lead_days ?? 3,
      tiers: p.price_tiers ?? [],
      deliveryFree: configMap[p.seller_org_id]?.free ?? null,
      deliveryFee: configMap[p.seller_org_id]?.fee ?? null,
    }));

    setOffers(vendorOffers);
    setLoadingOffers(false);
  }

  function selectRef(ref: EanRef) {
    setSelectedRef(ref);
    setSearchQuery(ref.name);
    setSuggestions([]);
    runSearchByEan(ref.ean);
  }

  async function addToCart(productId: string, moq: number, unitPrice: number) {
    if (!activeOrg) return;
    const { data: ex } = await supabase.from('cart_items').select('id, quantity')
      .eq('buyer_org_id', activeOrg.id).eq('product_id', productId).is('cart_id', null).maybeSingle();
    if (ex) {
      await supabase.from('cart_items').update({ quantity: ex.quantity + Math.max(moq, qty) }).eq('id', ex.id);
    } else {
      await supabase.from('cart_items').insert({
        buyer_org_id: activeOrg.id, product_id: productId,
        quantity: Math.max(moq, qty), unit_price: unitPrice, cart_id: null,
      });
    }
    setCartMsg('Ajouté au panier');
    setTimeout(() => setCartMsg(''), 3000);
  }

  // Sort offers: best price first (at selected qty)
  const sortedOffers = [...offers].sort((a, b) => {
    const pa = basePrice(a.tiers, qty) ?? 99999;
    const pb = basePrice(b.tiers, qty) ?? 99999;
    return pa - pb;
  });

  const bestPrice = sortedOffers.length ? basePrice(sortedOffers[0].tiers, qty) : null;

  // Total cost estimate per vendor
  function totalCost(offer: VendorOffer) {
    const price = basePrice(offer.tiers, qty);
    if (!price) return null;
    const sub = price * qty;
    const delivery = offer.deliveryFree != null && sub >= offer.deliveryFree
      ? 0
      : (offer.deliveryFee ?? 0);
    return { subtotal: sub, delivery, total: sub + delivery };
  }

  return (
    <SpaceBetween size="m">
      {cartMsg && (
        <Flashbar items={[{ type: 'success', content: cartMsg, dismissible: true, onDismiss: () => setCartMsg('') }]} />
      )}

      <Header
        variant="h1"
        description="Comparez les prix et conditions de livraison de tous les vendeurs pour un même produit"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate('/buyer/catalog')}>← Catalogue</Button>
            <Button variant="primary" onClick={() => navigate('/buyer/optimizer')} iconName="settings">Optimiseur</Button>
          </SpaceBetween>
        }
      >
        Comparateur de prix
      </Header>

      {/* Search bar */}
      <Container>
        <SpaceBetween size="m">
          <FormField
            label="Rechercher un produit"
            description="Saisissez le nom ou l'EAN pour voir tous les vendeurs proposant ce produit"
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Autosuggest
                  value={searchQuery}
                  onChange={({ detail }) => { setSearchQuery(detail.value); setSelectedRef(null); setOffers([]); }}
                  onSelect={({ detail }) => {
                    const ref = suggestions.find(s => s.name === detail.value || s.ean === detail.value);
                    if (ref) selectRef(ref);
                  }}
                  options={suggestions.map(s => ({
                    value: s.name,
                    label: s.name,
                    description: [s.ean, s.manufacturer_name, s.temperature].filter(Boolean).join(' · '),
                  }))}
                  filteringType="manual"
                  statusType={searching ? 'loading' : 'finished'}
                  loadingText="Recherche…"
                  empty={searchQuery.length >= 2 ? 'Aucun produit trouvé dans le catalogue de référence' : ''}
                  placeholder="Ex: Coca-Cola 1,5L, 6111073111091…"
                  enteredTextLabel={v => `Rechercher "${v}"`}
                />
              </div>
              <Button
                variant="primary"
                onClick={() => { if (searchQuery.trim()) runSearchByEan(searchQuery.trim()); }}
                loading={loadingOffers}
              >
                Comparer
              </Button>
            </div>
          </FormField>

          {/* Quantity selector */}
          {offers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Box fontWeight="bold">Simuler pour une quantité :</Box>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 10, 50, 100, 200, 500].map(q => (
                  <button
                    key={q}
                    onClick={() => setQty(q)}
                    style={{
                      padding: '5px 14px', border: '1px solid',
                      borderColor: qty === q ? '#0972d3' : '#d1d5db',
                      background: qty === q ? '#eff6ff' : '#fff',
                      color: qty === q ? '#0972d3' : '#374151',
                      borderRadius: 6, fontWeight: qty === q ? 700 : 500,
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
                <div style={{ width: 90 }}>
                  <Input
                    type="number"
                    value={String(qty)}
                    onChange={({ detail }) => setQty(Math.max(1, parseInt(detail.value) || 1))}
                    placeholder="Autre"
                  />
                </div>
              </div>
            </div>
          )}
        </SpaceBetween>
      </Container>

      {/* Selected product header */}
      {selectedRef && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#f0f9ff',
            border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px' }}>
          {selectedRef.images?.[0] && (
            <img src={selectedRef.images[0]} alt={selectedRef.name}
              style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f1b2d' }}>{selectedRef.name}</div>
            <div style={{ fontSize: 13, color: '#5f6b7a' }}>
              EAN : {selectedRef.ean}
              {selectedRef.manufacturer_name && ` · ${selectedRef.manufacturer_name}`}
              {` · ${selectedRef.temperature}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#5f6b7a' }}>{sortedOffers.length} vendeur{sortedOffers.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loadingOffers && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="large" /></div>
      )}

      {/* No results */}
      {!loadingOffers && selectedRef && offers.length === 0 && (
        <Alert type="warning" header="Aucun vendeur actif pour ce produit">
          Ce produit est dans le catalogue de référence mais aucun vendeur ne le propose actuellement.
        </Alert>
      )}

      {/* Comparison table */}
      {sortedOffers.length > 0 && (
        <Container header={<Header variant="h2">Comparaison des offres</Header>}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f8f9fa' }}>
                  {['Vendeur', `Prix × ${qty}`, 'Paliers', 'MOQ', 'Délai', 'Livraison gratuite', 'Frais livraison', 'Total estimé', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700,
                        color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOffers.map((offer, idx) => {
                  const price = basePrice(offer.tiers, qty);
                  const isBest = idx === 0 && price === bestPrice;
                  const cost = totalCost(offer);
                  return (
                    <tr key={offer.productId}
                      style={{ borderBottom: '1px solid #f3f4f6',
                        background: isBest ? '#f0fff4' : 'transparent' }}>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontWeight: 700, color: '#0f1b2d' }}>
                            {isBest && <span style={{ background: '#16a34a', color: '#fff', fontSize: 10,
                                fontWeight: 800, padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>MEILLEUR PRIX</span>}
                            {offer.vendorName}
                          </div>
                          <div style={{ color: '#d97706', fontSize: 11 }}>
                            {starRating(offer.vendorRating)}
                            {offer.vendorReviewCount > 0 && <span style={{ color: '#6b7280' }}> ({offer.vendorReviewCount})</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        {price != null ? (
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: isBest ? '#16a34a' : '#0f1b2d' }}>
                              {price.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>/ unité</div>
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {[...offer.tiers].sort((a, b) => a.qty_min - b.qty_min).map(t => (
                            <div key={t.qty_min} style={{ fontSize: 11, color: qty >= t.qty_min ? '#0972d3' : '#9ca3af',
                                fontWeight: qty >= t.qty_min ? 700 : 400 }}>
                              ≥{t.qty_min} → {t.unit_price.toFixed(2)} MAD
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', color: qty < offer.moq ? '#dc2626' : '#374151', fontWeight: 600 }}>
                        {offer.moq}
                        {qty < offer.moq && <div style={{ fontSize: 10, color: '#dc2626' }}>MOQ non atteint</div>}
                      </td>
                      <td style={{ padding: '12px 12px', color: '#374151' }}>{offer.estimatedLeadDays}j</td>
                      <td style={{ padding: '12px 12px', color: '#374151' }}>
                        {offer.deliveryFree != null
                          ? <span style={{ color: '#16a34a', fontWeight: 600 }}>
                              ≥ {offer.deliveryFree.toLocaleString('fr-MA')} MAD
                            </span>
                          : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 12px', color: '#374151' }}>
                        {cost?.delivery === 0
                          ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Gratuit</span>
                          : cost?.delivery != null
                            ? `${cost.delivery.toLocaleString('fr-MA')} MAD`
                            : offer.deliveryFee != null ? `${offer.deliveryFee} MAD` : '—'}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        {cost != null ? (
                          <div style={{ fontWeight: 700, color: '#0f1b2d' }}>
                            {cost.total.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 400 }}>
                              {cost.subtotal.toFixed(2)} + {cost.delivery} livr.
                            </div>
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        {price != null && (
                          <Button
                            variant={isBest ? 'primary' : 'normal'}
                            onClick={() => addToCart(offer.productId, offer.moq, price)}
                          >
                            Ajouter
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recommendation note */}
          {sortedOffers.length > 1 && bestPrice != null && (() => {
            const best = sortedOffers[0];
            const second = sortedOffers[1];
            const saving = ((basePrice(second.tiers, qty) ?? 0) - bestPrice) * qty;
            return saving > 0 ? (
              <Box color="text-body-secondary" fontSize="body-s" padding={{ top: 'm' }}>
                💡 En choisissant <strong>{best.vendorName}</strong> vous économisez{' '}
                <strong>{saving.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</strong>{' '}
                par rapport au second vendeur, hors frais de livraison.
              </Box>
            ) : null;
          })()}
        </Container>
      )}
    </SpaceBetween>
  );
}
