import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fmtMAD } from '../../lib/vendorUtils';
import {
  Table, Header, Button, SpaceBetween, Badge, Box,
  Alert, ColumnLayout, Modal, FormField, Input, Select,
  StatusIndicator, TextFilter, Pagination, Spinner, Flashbar,
} from '@cloudscape-design/components';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProductRow {
  id: string;
  name: string;
  ean: string;
  seller_org_id: string;
}

interface LotRow {
  id: string;
  product_id: string;
  lot_number: string;
  qty_available: number;
  expiry_date: string;
  specific_price: number | null;
  active: boolean;
  created_at: string;
  products: ProductRow;
}

interface PriceTierRow {
  product_id: string;
  unit_price: number;
}

interface LotVM {
  id: string;
  product_id: string;
  product_name: string;
  ean: string;
  lot_number: string;
  expiry_date: string;
  days_remaining: number;
  qty_available: number;
  base_price: number;
  specific_price: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcDaysLeft(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function dlcBadge(days: number) {
  if (days <= 7)  return <Badge color="red">Critique — {days}j</Badge>;
  if (days <= 30) return <Badge color="severity-medium">Attention — {days}j</Badge>;
  return <Badge color="green">OK — {days}j</Badge>;
}

function discountPct(basePrice: number, specificPrice: number): number {
  if (basePrice <= 0) return 0;
  return Math.round((basePrice - specificPrice) / basePrice * 100);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VendorLots() {
  const { activeOrg } = useAuth();

  const [lots, setLots] = useState<LotVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [filter, setFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedLot, setSelectedLot] = useState<LotVM | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────
  async function fetchLots() {
    if (!activeOrg) return;
    setLoading(true);
    setError('');

    const { data: lotsData, error: lotsErr } = await supabase
      .from('product_lots')
      .select('*, products!inner(id, name, ean, seller_org_id)')
      .eq('products.seller_org_id', activeOrg.id)
      .eq('active', true)
      .order('expiry_date', { ascending: true });

    if (lotsErr) {
      setError(lotsErr.message);
      setLoading(false);
      return;
    }

    const rows = (lotsData ?? []) as LotRow[];

    // Fetch base prices from price_tiers
    const productIds = [...new Set(rows.map((l) => l.product_id))];
    let tierMap: Record<string, number> = {};

    if (productIds.length > 0) {
      const { data: tiersData } = await supabase
        .from('price_tiers')
        .select('product_id, unit_price')
        .in('product_id', productIds)
        .order('qty_min', { ascending: true });

      (tiersData as PriceTierRow[] ?? []).forEach((t) => {
        // Keep only first (lowest qty_min) tier per product
        if (!(t.product_id in tierMap)) {
          tierMap[t.product_id] = t.unit_price;
        }
      });
    }

    const vms: LotVM[] = rows.map((l) => ({
      id: l.id,
      product_id: l.product_id,
      product_name: l.products.name,
      ean: l.products.ean,
      lot_number: l.lot_number,
      expiry_date: l.expiry_date,
      days_remaining: calcDaysLeft(l.expiry_date),
      qty_available: l.qty_available,
      base_price: tierMap[l.product_id] ?? (l.specific_price ?? 0),
      specific_price: l.specific_price,
    }));

    setLots(vms);
    setLoading(false);
  }

  useEffect(() => { fetchLots(); }, [activeOrg]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const filtered = lots.filter((l) => {
    const matchText = filter === '' ||
      l.product_name.toLowerCase().includes(filter.toLowerCase()) ||
      l.ean.includes(filter) ||
      l.lot_number.toLowerCase().includes(filter.toLowerCase());
    const matchUrgency =
      urgencyFilter === 'all' ||
      (urgencyFilter === 'critique' && l.days_remaining <= 7) ||
      (urgencyFilter === 'attention' && l.days_remaining > 7 && l.days_remaining <= 30) ||
      (urgencyFilter === 'promo' && l.specific_price !== null);
    return matchText && matchUrgency;
  });

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const critiques = lots.filter((l) => l.days_remaining <= 7).length;
  const attentions = lots.filter((l) => l.days_remaining > 7 && l.days_remaining <= 30).length;
  const stockTotal = lots.reduce((s, l) => s + l.qty_available, 0);
  const valeurRisque = lots
    .filter((l) => l.days_remaining <= 30)
    .reduce((s, l) => s + l.qty_available * l.base_price, 0);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function applyDiscount() {
    if (!selectedLot) return;
    const pct = parseFloat(discountInput);
    if (isNaN(pct) || pct <= 0 || pct > 80) return;

    setSaving(true);
    const newPrice = parseFloat((selectedLot.base_price * (1 - pct / 100)).toFixed(2));
    const { error: err } = await supabase
      .from('product_lots')
      .update({ specific_price: newPrice })
      .eq('id', selectedLot.id);

    if (err) {
      setError(err.message);
    } else {
      setLots((prev) =>
        prev.map((l) => l.id === selectedLot.id ? { ...l, specific_price: newPrice } : l)
      );
    }
    setSaving(false);
    setShowDiscountModal(false);
    setDiscountInput('');
    setSelectedLot(null);
  }

  async function removePromo(lot: LotVM) {
    const { error: err } = await supabase
      .from('product_lots')
      .update({ specific_price: null })
      .eq('id', lot.id);

    if (err) {
      setError(err.message);
    } else {
      setLots((prev) =>
        prev.map((l) => l.id === lot.id ? { ...l, specific_price: null } : l)
      );
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box textAlign="center" padding="xl">
        <Spinner size="large" />
      </Box>
    );
  }

  const discountPctPreview =
    discountInput && selectedLot && parseFloat(discountInput) > 0 && parseFloat(discountInput) <= 80
      ? parseFloat((selectedLot.base_price * (1 - parseFloat(discountInput) / 100)).toFixed(2))
      : null;

  return (
    <SpaceBetween size="l">

      {/* ── FLASHBAR ERREUR ───────────────────────────────────────── */}
      {error && (
        <Flashbar items={[{ type: 'error', content: error, dismissible: true, onDismiss: () => setError('') }]} />
      )}

      {/* ── ALERTES DLC ───────────────────────────────────────────── */}
      {critiques > 0 && (
        <Alert
          type="error"
          header={`${critiques} lot${critiques > 1 ? 's' : ''} en expiration critique (≤ 7 jours)`}
          action={<Button onClick={() => { setUrgencyFilter('critique'); setCurrentPage(1); }}>Voir les lots critiques</Button>}
        >
          Ces lots expirent dans moins de 7 jours. Appliquez une remise urgente ou retirez-les du catalogue.
        </Alert>
      )}
      {attentions > 0 && critiques === 0 && (
        <Alert
          type="warning"
          header={`${attentions} lot${attentions > 1 ? 's' : ''} proche${attentions > 1 ? 's' : ''} de l'expiration (≤ 30 jours)`}
        >
          Ces lots expirent dans les 30 prochains jours. Activez une remise pour accélérer les ventes.
        </Alert>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <ColumnLayout columns={4} variant="text-grid">
        <Box>
          <Box variant="awsui-key-label">Lots critiques (≤ 7j)</Box>
          <Box variant="h1" color={critiques > 0 ? 'text-status-error' : 'text-status-success'}>
            {critiques}
          </Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Lots attention (≤ 30j)</Box>
          <Box variant="h1" color={attentions > 0 ? 'text-status-warning' : 'text-status-success'}>
            {attentions}
          </Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Stock total géré</Box>
          <Box variant="h1">{stockTotal.toLocaleString('fr-MA')} u</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Valeur à risque (≤ 30j)</Box>
          <Box variant="h1">{fmtMAD(valeurRisque)}</Box>
        </Box>
      </ColumnLayout>

      {/* ── TABLE DES LOTS ────────────────────────────────────────── */}
      <Table
        header={
          <Header
            variant="h2"
            counter={`(${filtered.length})`}
            description="Triés par date d'expiration croissante"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={fetchLots} />
                <Select
                  selectedOption={
                    urgencyFilter === 'all'       ? { label: 'Tous les lots',   value: 'all' } :
                    urgencyFilter === 'critique'  ? { label: 'Critiques ≤7j',   value: 'critique' } :
                    urgencyFilter === 'attention' ? { label: 'Attention ≤30j',  value: 'attention' } :
                                                    { label: 'En promotion',    value: 'promo' }
                  }
                  options={[
                    { label: 'Tous les lots',                        value: 'all' },
                    { label: `Critiques ≤7j (${critiques})`,         value: 'critique' },
                    { label: `Attention ≤30j (${attentions})`,       value: 'attention' },
                    { label: 'En promotion',                         value: 'promo' },
                  ]}
                  onChange={({ detail }) => { setUrgencyFilter(detail.selectedOption.value ?? 'all'); setCurrentPage(1); }}
                />
              </SpaceBetween>
            }
          >
            Lots &amp; DLC
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            filteringPlaceholder="Rechercher par nom, EAN ou n° lot…"
            onChange={({ detail }) => { setFilter(detail.filteringText); setCurrentPage(1); }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={[
          {
            id: 'product',
            header: 'Produit',
            cell: (l) => (
              <SpaceBetween size="xxs">
                <Box fontWeight="bold">{l.product_name}</Box>
                <Box variant="small" color="text-body-secondary">EAN {l.ean} · Lot {l.lot_number}</Box>
              </SpaceBetween>
            ),
            width: 280,
          },
          {
            id: 'dlc',
            header: 'DLC',
            cell: (l) => (
              <SpaceBetween size="xxs">
                <Box>{new Date(l.expiry_date).toLocaleDateString('fr-MA')}</Box>
                {dlcBadge(l.days_remaining)}
              </SpaceBetween>
            ),
          },
          {
            id: 'stock',
            header: 'Stock',
            cell: (l) => <Box fontWeight="bold">{l.qty_available.toLocaleString('fr-MA')} u</Box>,
          },
          {
            id: 'base_price',
            header: 'Prix de base',
            cell: (l) => l.base_price > 0 ? fmtMAD(l.base_price) : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'promo_price',
            header: 'Prix promo',
            cell: (l) => {
              if (l.specific_price === null) return <Box color="text-body-secondary">—</Box>;
              const pct = discountPct(l.base_price, l.specific_price);
              return (
                <SpaceBetween size="xxs">
                  <Box fontWeight="bold" color="text-status-success">{fmtMAD(l.specific_price)}</Box>
                  {pct > 0 && <Badge color="red">−{pct}%</Badge>}
                </SpaceBetween>
              );
            },
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (l) =>
              l.specific_price !== null
                ? <StatusIndicator type="success">En déstockage</StatusIndicator>
                : <StatusIndicator type="stopped">Pas de promo</StatusIndicator>,
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (l) => (
              <SpaceBetween direction="horizontal" size="xs">
                {l.specific_price === null ? (
                  <Button
                    variant="normal"
                    onClick={() => { setSelectedLot(l); setDiscountInput(''); setShowDiscountModal(true); }}
                  >
                    Appliquer remise
                  </Button>
                ) : (
                  <Button variant="link" onClick={() => removePromo(l)}>
                    Désactiver promo
                  </Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={paginated}
        loading={loading}
        loadingText="Chargement des lots…"
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucun lot trouvé</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Aucun lot actif ne correspond aux filtres sélectionnés.
            </Box>
          </Box>
        }
      />

      {/* ── MODAL REMISE URGENTE ──────────────────────────────────── */}
      {showDiscountModal && selectedLot && (
        <Modal
          visible
          header="Appliquer une remise urgente"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDiscountModal(false)}>Annuler</Button>
                <Button
                  variant="primary"
                  loading={saving}
                  onClick={applyDiscount}
                  disabled={!discountInput || parseFloat(discountInput) <= 0 || parseFloat(discountInput) > 80}
                >
                  Appliquer
                </Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setShowDiscountModal(false)}
        >
          <SpaceBetween size="m">
            <Alert type="warning">
              Ce lot expire dans <strong>{selectedLot.days_remaining} jour{selectedLot.days_remaining > 1 ? 's' : ''}</strong>. Une remise activera le badge déstockage côté acheteur.
            </Alert>
            <ColumnLayout columns={2}>
              <FormField label="Produit">
                <Box>{selectedLot.product_name}</Box>
              </FormField>
              <FormField label="Prix de base">
                <Box>{selectedLot.base_price > 0 ? fmtMAD(selectedLot.base_price) : '—'}</Box>
              </FormField>
            </ColumnLayout>
            <FormField
              label="Remise (%)"
              description="Entre 1 et 80 %. Le nouveau prix s'affiche en temps réel."
              errorText={
                discountInput && (parseFloat(discountInput) <= 0 || parseFloat(discountInput) > 80)
                  ? 'Valeur entre 1 et 80'
                  : undefined
              }
            >
              <Input
                value={discountInput}
                onChange={({ detail }) => setDiscountInput(detail.value)}
                placeholder="Ex: 20"
              />
            </FormField>
            {discountPctPreview !== null && (
              <Box color="text-status-success" fontWeight="bold">
                Nouveau prix : {fmtMAD(discountPctPreview)}
              </Box>
            )}
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
