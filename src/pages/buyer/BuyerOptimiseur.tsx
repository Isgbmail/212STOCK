import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SpaceBetween, Header, Button, Box, Input,
  FormField, Container, Spinner, Alert, Autosuggest, Flashbar, Badge,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CartLine {
  id: string; ean: string; productName: string; qty: number;
  suggestions: EanRef[];
}

interface EanRef { id: string; ean: string; name: string }

interface VendorOffer {
  productId: string; ean: string; productName: string;
  vendorId: string; vendorName: string;
  unitPrice: number; moq: number;
  deliveryFreeAbove: number | null; deliveryFee: number | null;
  leadDays: number;
}

interface VendorGroup {
  vendorId: string; vendorName: string;
  lines: { ean: string; productName: string; productId: string; qty: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  delivery: number;
  total: number;
}

interface OptimResult {
  label: string; description: string; color: string;
  groups: VendorGroup[];
  grandTotal: number; grandDelivery: number; grandProducts: number;
  recommended: boolean;
}

function bestOffer(offers: VendorOffer[], qty: number) {
  const sorted = offers.filter(o => o.qty <= qty).sort((a, b) => a.unitPrice - b.unitPrice);
  return sorted[0] ?? offers.sort((a, b) => a.unitPrice - b.unitPrice)[0] ?? null;
}

function buildGroup(vendorOffers: { vendorId: string; vendorName: string; lines: VendorOffer[]; qtys: Record<string, number>; deliveryFreeAbove: number | null; deliveryFee: number | null }): VendorGroup {
  const lines = vendorOffers.lines.map(o => {
    const qty = vendorOffers.qtys[o.ean] ?? o.moq;
    return { ean: o.ean, productName: o.productName, productId: o.productId, qty, unitPrice: o.unitPrice, subtotal: o.unitPrice * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const delivery = vendorOffers.deliveryFreeAbove != null && subtotal >= vendorOffers.deliveryFreeAbove ? 0 : (vendorOffers.deliveryFee ?? 0);
  return { vendorId: vendorOffers.vendorId, vendorName: vendorOffers.vendorName, lines, subtotal, delivery, total: subtotal + delivery };
}

let lineCounter = 0;

export default function BuyerOptimiseur() {
  const navigate = useNavigate();
  const { activeOrg } = useAuth();

  const [cartLines, setCartLines]     = useState<CartLine[]>([{ id: 'l0', ean: '', productName: '', qty: 1, suggestions: [] }]);
  const [loading,   setLoading]       = useState(false);
  const [results,   setResults]       = useState<OptimResult[] | null>(null);
  const [error,     setError]         = useState('');
  const [cartMsg,   setCartMsg]       = useState('');
  const [applying,  setApplying]      = useState(false);

  const sugTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function addLine() {
    lineCounter++;
    setCartLines(p => [...p, { id: `l${lineCounter}`, ean: '', productName: '', qty: 1, suggestions: [] }]);
  }
  function removeLine(id: string) { setCartLines(p => p.filter(l => l.id !== id)); }
  function updateLine(id: string, field: 'ean' | 'qty' | 'productName', value: string | number) {
    setCartLines(p => p.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  async function searchSuggestions(lineId: string, query: string) {
    if (sugTimers.current[lineId]) clearTimeout(sugTimers.current[lineId]);
    if (query.trim().length < 2) {
      setCartLines(p => p.map(l => l.id === lineId ? { ...l, suggestions: [] } : l));
      return;
    }
    sugTimers.current[lineId] = setTimeout(async () => {
      const { data } = await supabase
        .from('ean_references').select('id, ean, name')
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,ean.ilike.%${query}%`)
        .limit(8);
      setCartLines(p => p.map(l => l.id === lineId ? { ...l, suggestions: (data ?? []) as EanRef[] } : l));
    }, 350);
  }

  async function runOptimization() {
    const validLines = cartLines.filter(l => l.ean.trim() && l.qty > 0);
    if (validLines.length === 0) { setError('Ajoutez au moins un produit avec son EAN.'); return; }
    setError('');
    setLoading(true);
    setResults(null);

    const eans = [...new Set(validLines.map(l => l.ean.trim()))];

    // Fetch all vendor offers for these EANs
    const { data: products } = await supabase
      .from('products')
      .select(`id, ean, moq, estimated_lead_days, seller_org_id,
        organisations!seller_org_id (id, name),
        price_tiers (qty_min, unit_price)`)
      .in('ean', eans)
      .eq('status', 'active');

    if (!products?.length) {
      setError('Aucun vendeur actif trouvé pour les EANs saisis.');
      setLoading(false);
      return;
    }

    const vendorIds = [...new Set((products as any[]).map(p => p.seller_org_id))];
    const { data: deliveryConfigs } = await supabase
      .from('vendor_delivery_config')
      .select('org_id, free_delivery_threshold, delivery_fee_default')
      .in('org_id', vendorIds);

    const dcMap: Record<string, { free: number | null; fee: number | null }> = {};
    for (const c of (deliveryConfigs ?? []) as any[]) {
      dcMap[c.org_id] = { free: c.free_delivery_threshold, fee: c.delivery_fee_default };
    }

    // Build offers list
    const allOffers: VendorOffer[] = [];
    for (const p of products as any[]) {
      const tiers = (p.price_tiers ?? []).sort((a: any, b: any) => a.qty_min - b.qty_min);
      const line = validLines.find(l => l.ean.trim() === p.ean);
      const qty = line?.qty ?? 1;
      let unitPrice = tiers[0]?.unit_price ?? null;
      for (const t of tiers) { if (qty >= t.qty_min) unitPrice = t.unit_price; }
      if (!unitPrice) continue;
      allOffers.push({
        productId: p.id, ean: p.ean, productName: line?.productName || p.ean,
        vendorId: p.seller_org_id, vendorName: p.organisations?.name ?? '—',
        unitPrice, moq: p.moq, leadDays: p.estimated_lead_days ?? 3,
        deliveryFreeAbove: dcMap[p.seller_org_id]?.free ?? null,
        deliveryFee: dcMap[p.seller_org_id]?.fee ?? null,
      });
    }

    const qtyMap: Record<string, number> = {};
    for (const l of validLines) qtyMap[l.ean.trim()] = l.qty;

    // ── Scenario A: cheapest per product (max split) ──────────
    const scenA_groups: Record<string, { vendorId: string; vendorName: string; offers: VendorOffer[]; free: number | null; fee: number | null }> = {};
    for (const ean of eans) {
      const eanOffers = allOffers.filter(o => o.ean === ean);
      const best = eanOffers.sort((a, b) => a.unitPrice - b.unitPrice)[0];
      if (!best) continue;
      if (!scenA_groups[best.vendorId]) {
        scenA_groups[best.vendorId] = { vendorId: best.vendorId, vendorName: best.vendorName, offers: [], free: best.deliveryFreeAbove, fee: best.deliveryFee };
      }
      scenA_groups[best.vendorId].offers.push(best);
    }
    const scenA: VendorGroup[] = Object.values(scenA_groups).map(g =>
      buildGroup({ vendorId: g.vendorId, vendorName: g.vendorName, lines: g.offers, qtys: qtyMap, deliveryFreeAbove: g.free, deliveryFee: g.fee })
    );

    // ── Scenario B: single best vendor (minimize vendors) ─────
    const vendorScores: Record<string, { vendorId: string; vendorName: string; eans: string[]; totalCost: number; free: number | null; fee: number | null }> = {};
    for (const vid of vendorIds) {
      const vendorOffers = allOffers.filter(o => o.vendorId === vid);
      const coveredEans = eans.filter(e => vendorOffers.some(o => o.ean === e));
      if (coveredEans.length < eans.length) continue; // doesn't cover all products
      const lines = vendorOffers.filter(o => coveredEans.includes(o.ean));
      const subtotal = lines.reduce((s, o) => s + o.unitPrice * (qtyMap[o.ean] ?? 1), 0);
      const dc = dcMap[vid];
      const delivery = dc?.free != null && subtotal >= dc.free ? 0 : (dc?.fee ?? 0);
      vendorScores[vid] = { vendorId: vid, vendorName: lines[0].vendorName, eans: coveredEans, totalCost: subtotal + delivery, free: dc?.free ?? null, fee: dc?.fee ?? null };
    }
    const bestSingle = Object.values(vendorScores).sort((a, b) => a.totalCost - b.totalCost)[0] ?? null;
    const scenB: VendorGroup[] = bestSingle ? [
      buildGroup({
        vendorId: bestSingle.vendorId, vendorName: bestSingle.vendorName,
        lines: allOffers.filter(o => o.vendorId === bestSingle.vendorId && bestSingle.eans.includes(o.ean)),
        qtys: qtyMap, deliveryFreeAbove: bestSingle.free, deliveryFee: bestSingle.fee,
      })
    ] : [];

    // ── Scenario C: optimized split (best price, respect delivery thresholds) ──
    // Group by vendor and see if consolidating to fewer vendors triggers free delivery
    const scenC: VendorGroup[] = scenA.length > 1 ? consolidate(scenA, allOffers, qtyMap, dcMap) : scenA;

    const grand = (groups: VendorGroup[]) => ({
      total: groups.reduce((s, g) => s + g.total, 0),
      delivery: groups.reduce((s, g) => s + g.delivery, 0),
      products: groups.reduce((s, g) => s + g.subtotal, 0),
    });

    const gA = grand(scenA), gB = grand(scenB), gC = grand(scenC);

    const scenarios: OptimResult[] = [
      {
        label: 'Meilleur prix produit', description: 'Chaque produit chez son vendeur le moins cher, livraisons séparées',
        color: '#0972d3', groups: scenA, ...gA, recommended: false,
      },
      ...(scenB.length ? [{
        label: 'Fournisseur unique', description: 'Tout auprès d\'un seul vendeur — une livraison, moins de complexité',
        color: '#7c3aed', groups: scenB, ...gB, recommended: false,
      }] : []),
      ...(scenC.length && scenC !== scenA ? [{
        label: 'Optimisé prix + livraison', description: 'Regroupement intelligent pour maximiser la livraison gratuite',
        color: '#16a34a', groups: scenC, ...gC, recommended: true,
      }] : []),
    ];

    // Mark the truly cheapest as recommended if no C scenario
    const minTotal = Math.min(...scenarios.map(s => s.grandTotal));
    if (!scenarios.some(s => s.recommended)) {
      const idx = scenarios.findIndex(s => s.grandTotal === minTotal);
      if (idx >= 0) scenarios[idx].recommended = true;
    }

    setResults(scenarios);
    setLoading(false);
  }

  // Consolidate: try merging vendors to unlock free delivery
  function consolidate(groups: VendorGroup[], allOffers: VendorOffer[], qtyMap: Record<string, number>, dcMap: Record<string, { free: number | null; fee: number | null }>): VendorGroup[] {
    // Simple heuristic: if two groups together reach free delivery threshold, merge to the one with free threshold
    const result = [...groups];
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const gi = result[i], gj = result[j];
        const freeI = gi.subtotal + gj.subtotal >= (dcMap[gi.vendorId]?.free ?? Infinity);
        const freeJ = gi.subtotal + gj.subtotal >= (dcMap[gj.vendorId]?.free ?? Infinity);
        if (freeI && gi.delivery > 0) {
          // Move gj's products to gi if gi vendor offers them
          const migratable = gj.lines.filter(l => allOffers.some(o => o.vendorId === gi.vendorId && o.ean === l.ean));
          if (migratable.length === gj.lines.length) {
            result[i] = buildGroup({
              vendorId: gi.vendorId, vendorName: gi.vendorName,
              lines: [...allOffers.filter(o => o.vendorId === gi.vendorId && [...gi.lines, ...gj.lines].some(l => l.ean === o.ean))],
              qtys: qtyMap, deliveryFreeAbove: dcMap[gi.vendorId]?.free ?? null, deliveryFee: dcMap[gi.vendorId]?.fee ?? null,
            });
            result.splice(j, 1);
            break;
          }
        }
        if (freeJ && gj.delivery > 0) {
          const migratable = gi.lines.filter(l => allOffers.some(o => o.vendorId === gj.vendorId && o.ean === l.ean));
          if (migratable.length === gi.lines.length) {
            result[j] = buildGroup({
              vendorId: gj.vendorId, vendorName: gj.vendorName,
              lines: [...allOffers.filter(o => o.vendorId === gj.vendorId && [...gi.lines, ...gj.lines].some(l => l.ean === o.ean))],
              qtys: qtyMap, deliveryFreeAbove: dcMap[gj.vendorId]?.free ?? null, deliveryFee: dcMap[gj.vendorId]?.fee ?? null,
            });
            result.splice(i, 1);
            break;
          }
        }
      }
    }
    return result;
  }

  async function applyResult(groups: VendorGroup[]) {
    if (!activeOrg) return;
    setApplying(true);

    // Get or create the active live cart
    const { data: cartRows } = await supabase
      .from('carts')
      .select('id')
      .eq('buyer_org_id', activeOrg.id)
      .eq('status', 'active')
      .eq('is_template', false)
      .order('created_at', { ascending: false })
      .limit(1);
    let cart: { id: string } | null = cartRows?.[0] ?? null;

    if (!cart) {
      const { data: newCart, error: cartErr } = await supabase
        .from('carts')
        .insert({ buyer_org_id: activeOrg.id, status: 'active', is_template: false })
        .select('id')
        .single();
      if (cartErr || !newCart) {
        setError(`Impossible de créer le panier${cartErr ? ` : ${cartErr.message}` : ''}`);
        setApplying(false);
        return;
      }
      cart = newCart;
    }

    // Replace cart contents with optimizer selection
    await supabase.from('cart_items').delete().eq('cart_id', cart.id);

    for (const g of groups) {
      for (const l of g.lines) {
        await supabase.from('cart_items').insert({
          cart_id: cart.id,
          product_id: l.productId,
          quantity: l.qty,
          unit_price_computed: l.unitPrice,
        });
      }
    }

    setCartMsg('Panier mis à jour avec la sélection optimisée !');
    setTimeout(() => { setCartMsg(''); navigate('/checkout'); }, 2000);
    setApplying(false);
  }

  return (
    <SpaceBetween size="m">
      {cartMsg && (
        <Flashbar items={[{ type: 'success', content: cartMsg, dismissible: true, onDismiss: () => setCartMsg('') }]} />
      )}

      <Header
        variant="h1"
        description="Trouvez la combinaison vendeurs/livraisons qui minimise votre coût total d'approvisionnement"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate('/buyer/catalog')}>← Catalogue</Button>
            <Button onClick={() => navigate('/buyer/compare')}>Comparateur</Button>
          </SpaceBetween>
        }
      >
        Optimiseur de commandes
      </Header>

      {/* Cart input */}
      <Container header={<Header variant="h2">Produits à optimiser</Header>}>
        <SpaceBetween size="m">
          {cartLines.map((line, idx) => (
            <div key={line.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#5f6b7a', minWidth: 20, paddingBottom: 8 }}>
                {idx + 1}.
              </div>
              <div style={{ flex: 2, minWidth: 220 }}>
                <FormField label={idx === 0 ? 'Produit (nom ou EAN)' : undefined}>
                  <Autosuggest
                    value={line.ean}
                    onChange={({ detail }) => {
                      updateLine(line.id, 'ean', detail.value);
                      searchSuggestions(line.id, detail.value);
                    }}
                    onSelect={({ detail }) => {
                      const ref = line.suggestions.find(s => s.name === detail.value || s.ean === detail.value);
                      if (ref) {
                        setCartLines(p => p.map(l => l.id === line.id
                          ? { ...l, ean: ref.ean, productName: ref.name, suggestions: [] }
                          : l));
                      }
                    }}
                    options={line.suggestions.map(s => ({
                      value: s.name, label: s.name,
                      description: `EAN : ${s.ean}`,
                    }))}
                    filteringType="manual"
                    empty={line.ean.length >= 2 ? 'Aucun produit trouvé' : ''}
                    placeholder="Ex: Coca-Cola 1,5L ou 6111073111091"
                    enteredTextLabel={v => `Utiliser EAN "${v}"`}
                  />
                </FormField>
              </div>
              <div style={{ width: 100 }}>
                <FormField label={idx === 0 ? 'Quantité' : undefined}>
                  <Input type="number" value={String(line.qty)}
                    onChange={({ detail }) => updateLine(line.id, 'qty', Math.max(1, parseInt(detail.value) || 1))} />
                </FormField>
              </div>
              {line.productName && (
                <div style={{ paddingBottom: 8, fontSize: 12, color: '#16a34a', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ✓ {line.productName}
                </div>
              )}
              {cartLines.length > 1 && (
                <div style={{ paddingBottom: 8 }}>
                  <Button variant="icon" iconName="remove" onClick={() => removeLine(line.id)} />
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={addLine} iconName="add-plus">Ajouter un produit</Button>
            <Button
              variant="primary"
              onClick={runOptimization}
              loading={loading}
              disabled={cartLines.every(l => !l.ean.trim())}
            >
              Lancer l'optimisation
            </Button>
          </div>

          {error && <Alert type="error">{error}</Alert>}
        </SpaceBetween>
      </Container>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <SpaceBetween size="m" direction="horizontal">
            <Spinner size="large" />
            <Box color="text-body-secondary">Analyse des prix et coûts de livraison…</Box>
          </SpaceBetween>
        </div>
      )}

      {/* Results */}
      {results && (
        <SpaceBetween size="l">
          <Header variant="h2">
            {results.length} scénario{results.length > 1 ? 's' : ''} identifié{results.length > 1 ? 's' : ''}
          </Header>

          {results.map(scenario => (
            <Container
              key={scenario.label}
              header={
                <Header
                  variant="h3"
                  description={scenario.description}
                  actions={
                    <SpaceBetween direction="horizontal" size="xs">
                      {scenario.recommended && <Badge color="green">RECOMMANDÉ</Badge>}
                      <Button
                        variant={scenario.recommended ? 'primary' : 'normal'}
                        loading={applying}
                        onClick={() => applyResult(scenario.groups)}
                      >
                        Appliquer & Commander
                      </Button>
                    </SpaceBetween>
                  }
                >
                  <span style={{ color: scenario.color }}>{scenario.label}</span>
                </Header>
              }
            >
              <SpaceBetween size="m">
                {/* Summary bar */}
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '10px 0',
                    borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#5f6b7a', textTransform: 'uppercase', fontWeight: 600 }}>Produits</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f1b2d' }}>
                      {scenario.grandProducts.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#5f6b7a', textTransform: 'uppercase', fontWeight: 600 }}>Livraison</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: scenario.grandDelivery === 0 ? '#16a34a' : '#d97706' }}>
                      {scenario.grandDelivery === 0 ? 'Gratuite' : `${scenario.grandDelivery.toLocaleString('fr-MA')} MAD`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#5f6b7a', textTransform: 'uppercase', fontWeight: 600 }}>Total TTC estimé</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: scenario.color }}>
                      {scenario.grandTotal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#5f6b7a', textTransform: 'uppercase', fontWeight: 600 }}>Commandes</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f1b2d' }}>
                      {scenario.groups.length} vendeur{scenario.groups.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Per-vendor breakdown */}
                {scenario.groups.map(g => (
                  <div key={g.vendorId} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#f8f9fa', padding: '8px 14px', display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 700, color: '#0f1b2d' }}>{g.vendorName}</div>
                      <div style={{ fontSize: 13, color: '#5f6b7a' }}>
                        {g.subtotal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD produits
                        {' + '}
                        <span style={{ color: g.delivery === 0 ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                          {g.delivery === 0 ? 'livraison offerte' : `${g.delivery} MAD livraison`}
                        </span>
                        {' = '}
                        <strong>{g.total.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</strong>
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <tbody>
                        {g.lines.map(l => (
                          <tr key={l.ean} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 14px', color: '#374151', flex: 1 }}>{l.productName || l.ean}</td>
                            <td style={{ padding: '8px 14px', color: '#5f6b7a', textAlign: 'right' }}>× {l.qty}</td>
                            <td style={{ padding: '8px 14px', color: '#5f6b7a', textAlign: 'right' }}>{l.unitPrice.toFixed(2)} MAD/u</td>
                            <td style={{ padding: '8px 14px', fontWeight: 700, color: '#0f1b2d', textAlign: 'right' }}>
                              {l.subtotal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </SpaceBetween>
            </Container>
          ))}
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
}
