import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, Tabs, Container, SpaceBetween,
  Table, Button, Modal, FormField, Input, Toggle,
  Form, Alert, Spinner, ColumnLayout, Box,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import type { Tier, CreditCost, AdInventoryCap, MarketingConfig } from '../../types/marketing';

// ─── Tiers CRUD ────────────────────────────────────────────────────────────────
function TiersTab() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Tier> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('tiers').select('*').order('display_order');
    setTiers((data ?? []) as Tier[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError('');
    const payload = {
      name: editing.name,
      monthly_price: editing.monthly_price ?? 0,
      max_requests_per_month: editing.max_requests_per_month ?? 3,
      max_active_campaigns: editing.max_active_campaigns ?? 1,
      max_samples_per_month: editing.max_samples_per_month ?? 1,
      max_rfq_per_month: editing.max_rfq_per_month ?? 5,
      priority_queue: editing.priority_queue ?? false,
      analytics_access: editing.analytics_access ?? false,
      active: editing.active ?? true,
    };
    const { error: e } = editing.id
      ? await supabase.from('tiers').update(payload).eq('id', editing.id)
      : await supabase.from('tiers').insert(payload);
    if (e) setError(e.message);
    else { setEditing(null); load(); }
    setSaving(false);
  };

  return (
    <SpaceBetween size="m">
      <Table
        loading={loading}
        items={tiers}
        columnDefinitions={[
          { id: 'name', header: 'Nom', cell: r => r.name },
          { id: 'price', header: 'Prix mensuel', cell: r => `${r.monthly_price} €` },
          { id: 'requests', header: 'Max demandes/mois', cell: r => r.max_requests_per_month },
          { id: 'campaigns', header: 'Max campagnes actives', cell: r => r.max_active_campaigns },
          { id: 'samples', header: 'Max échantillons/mois', cell: r => r.max_samples_per_month },
          { id: 'rfq', header: 'Max RFQ/mois', cell: r => r.max_rfq_per_month },
          { id: 'active', header: 'Actif', cell: r => r.active ? '✓' : '—' },
          { id: 'actions', header: '', cell: r => <Button variant="inline-link" onClick={() => setEditing({ ...r })}>Modifier</Button> },
        ]}
        header={<Header actions={<Button iconName="add-plus" onClick={() => setEditing({})}>Ajouter un tier</Button>}>Tiers acheteurs</Header>}
        empty="Aucun tier configuré"
      />
      {editing && (
        <Modal
          visible header={editing.id ? 'Modifier le tier' : 'Nouveau tier'}
          onDismiss={() => setEditing(null)}
          footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setEditing(null)}>Annuler</Button><Button variant="primary" loading={saving} onClick={save}>Enregistrer</Button></SpaceBetween>}
        >
          <Form errorText={error}>
            <SpaceBetween size="m">
              <FormField label="Nom"><Input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p!, name: e.detail.value }))} /></FormField>
              <FormField label="Prix mensuel (€)"><Input type="number" value={String(editing.monthly_price ?? 0)} onChange={e => setEditing(p => ({ ...p!, monthly_price: Number(e.detail.value) }))} /></FormField>
              <ColumnLayout columns={2}>
                <FormField label="Max demandes/mois"><Input type="number" value={String(editing.max_requests_per_month ?? 3)} onChange={e => setEditing(p => ({ ...p!, max_requests_per_month: Number(e.detail.value) }))} /></FormField>
                <FormField label="Max campagnes actives"><Input type="number" value={String(editing.max_active_campaigns ?? 1)} onChange={e => setEditing(p => ({ ...p!, max_active_campaigns: Number(e.detail.value) }))} /></FormField>
                <FormField label="Max échantillons/mois"><Input type="number" value={String(editing.max_samples_per_month ?? 1)} onChange={e => setEditing(p => ({ ...p!, max_samples_per_month: Number(e.detail.value) }))} /></FormField>
                <FormField label="Max RFQ/mois"><Input type="number" value={String(editing.max_rfq_per_month ?? 5)} onChange={e => setEditing(p => ({ ...p!, max_rfq_per_month: Number(e.detail.value) }))} /></FormField>
              </ColumnLayout>
              <FormField label="File prioritaire"><Toggle checked={editing.priority_queue ?? false} onChange={e => setEditing(p => ({ ...p!, priority_queue: e.detail.checked }))} /></FormField>
              <FormField label="Accès analytics"><Toggle checked={editing.analytics_access ?? false} onChange={e => setEditing(p => ({ ...p!, analytics_access: e.detail.checked }))} /></FormField>
              <FormField label="Actif"><Toggle checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p!, active: e.detail.checked }))} /></FormField>
            </SpaceBetween>
          </Form>
        </Modal>
      )}
    </SpaceBetween>
  );
}

// ─── Credit Costs CRUD ─────────────────────────────────────────────────────────
function CreditCostsTab() {
  const [costs, setCosts] = useState<CreditCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CreditCost> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('credit_costs').select('*').order('action_type');
    setCosts((data ?? []) as CreditCost[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.id) return;
    setSaving(true);
    await supabase.from('credit_costs').update({ credits_per_unit: editing.credits_per_unit }).eq('id', editing.id);
    setEditing(null); load();
    setSaving(false);
  };

  return (
    <SpaceBetween size="m">
      <Table
        loading={loading}
        items={costs}
        columnDefinitions={[
          { id: 'type', header: 'Action', cell: r => r.action_type },
          { id: 'cost', header: 'Coût (crédits)', cell: r => r.credits_per_unit },
          { id: 'unit', header: 'Unité', cell: r => r.unit },
          { id: 'desc', header: 'Description', cell: r => r.description },
          { id: 'actions', header: '', cell: r => <Button variant="inline-link" onClick={() => setEditing({ ...r })}>Modifier</Button> },
        ]}
        header={<Header>Coûts des actions marketing</Header>}
        empty="Aucun coût configuré"
      />
      {editing && (
        <Modal
          visible header="Modifier le coût"
          onDismiss={() => setEditing(null)}
          footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setEditing(null)}>Annuler</Button><Button variant="primary" loading={saving} onClick={save}>Enregistrer</Button></SpaceBetween>}
        >
          <FormField label={`Coût pour "${editing.action_type}" (crédits/${editing.unit})`}>
            <Input type="number" value={String(editing.credits_per_unit ?? 0)} onChange={e => setEditing(p => ({ ...p!, credits_per_unit: Number(e.detail.value) }))} />
          </FormField>
        </Modal>
      )}
    </SpaceBetween>
  );
}

// ─── Inventory Caps CRUD ───────────────────────────────────────────────────────
function InventoryCapsTab() {
  const [caps, setCaps] = useState<AdInventoryCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AdInventoryCap> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('ad_inventory_caps').select('*');
    setCaps((data ?? []) as AdInventoryCap[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = { placement: editing.placement, daily_slots: editing.daily_slots ?? 10, description: editing.description, active: editing.active ?? true };
    if (editing.id) await supabase.from('ad_inventory_caps').update(payload).eq('id', editing.id);
    else await supabase.from('ad_inventory_caps').insert(payload);
    setEditing(null); load();
    setSaving(false);
  };

  return (
    <SpaceBetween size="m">
      <Table
        loading={loading}
        items={caps}
        columnDefinitions={[
          { id: 'placement', header: 'Emplacement', cell: r => r.placement },
          { id: 'slots', header: 'Slots/jour', cell: r => r.daily_slots },
          { id: 'desc', header: 'Description', cell: r => r.description },
          { id: 'active', header: 'Actif', cell: r => r.active ? '✓' : '—' },
          { id: 'actions', header: '', cell: r => <Button variant="inline-link" onClick={() => setEditing({ ...r })}>Modifier</Button> },
        ]}
        header={<Header actions={<Button iconName="add-plus" onClick={() => setEditing({})}>Ajouter</Button>}>Plafonds d'inventaire</Header>}
        empty="Aucun cap configuré"
      />
      {editing && (
        <Modal
          visible header={editing.id ? "Modifier l'emplacement" : 'Nouvel emplacement'}
          onDismiss={() => setEditing(null)}
          footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setEditing(null)}>Annuler</Button><Button variant="primary" loading={saving} onClick={save}>Enregistrer</Button></SpaceBetween>}
        >
          <SpaceBetween size="m">
            <FormField label="Identifiant emplacement"><Input value={editing.placement ?? ''} onChange={e => setEditing(p => ({ ...p!, placement: e.detail.value }))} disabled={!!editing.id} /></FormField>
            <FormField label="Slots par jour"><Input type="number" value={String(editing.daily_slots ?? 10)} onChange={e => setEditing(p => ({ ...p!, daily_slots: Number(e.detail.value) }))} /></FormField>
            <FormField label="Description"><Input value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p!, description: e.detail.value }))} /></FormField>
            <FormField label="Actif"><Toggle checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p!, active: e.detail.checked }))} /></FormField>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}

// ─── General Config ────────────────────────────────────────────────────────────
function GeneralConfigTab() {
  const [config, setConfig] = useState<Partial<MarketingConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('marketing_config').select('*').single();
    if (data) setConfig(data as MarketingConfig);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from('marketing_config').update({
      flash_sale_request_threshold: config.flash_sale_request_threshold,
      seller_low_credits_pct: config.seller_low_credits_pct,
      inventory_alert_pct: config.inventory_alert_pct,
      promotion_stacking_allowed: config.promotion_stacking_allowed,
      min_campaign_duration_days: config.min_campaign_duration_days,
      max_campaign_duration_days: config.max_campaign_duration_days,
      buyer_points_per_dollar: config.buyer_points_per_dollar,
    }).neq('id', '00000000-0000-0000-0000-000000000000');
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  if (loading) return <Spinner />;

  const num = (key: keyof MarketingConfig) => String(config[key] ?? '');
  const setNum = (key: keyof MarketingConfig) => (e: { detail: { value: string } }) =>
    setConfig(p => ({ ...p, [key]: Number(e.detail.value) }));

  return (
    <SpaceBetween size="m">
      {saved && <Alert type="success">Configuration enregistrée.</Alert>}
      <Container header={<Header>Paramètres généraux</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="Seuil demandes flash sale">
              <Input type="number" value={num('flash_sale_request_threshold')} onChange={setNum('flash_sale_request_threshold')} />
            </FormField>
            <FormField label="Alerte crédits bas vendeur (%)">
              <Input type="number" value={num('seller_low_credits_pct')} onChange={setNum('seller_low_credits_pct')} />
            </FormField>
            <FormField label="Alerte inventaire plein (%)">
              <Input type="number" value={num('inventory_alert_pct')} onChange={setNum('inventory_alert_pct')} />
            </FormField>
            <FormField label="Durée min campagne (jours)">
              <Input type="number" value={num('min_campaign_duration_days')} onChange={setNum('min_campaign_duration_days')} />
            </FormField>
            <FormField label="Durée max campagne (jours)">
              <Input type="number" value={num('max_campaign_duration_days')} onChange={setNum('max_campaign_duration_days')} />
            </FormField>
            <FormField label="Points fidélité par € dépensé">
              <Input type="number" value={num('buyer_points_per_dollar')} onChange={setNum('buyer_points_per_dollar')} />
            </FormField>
          </ColumnLayout>
          <FormField label="Stacking promotions autorisé">
            <Toggle
              checked={config.promotion_stacking_allowed ?? false}
              onChange={e => setConfig(p => ({ ...p, promotion_stacking_allowed: e.detail.checked }))}
            />
          </FormField>
          <Button variant="primary" loading={saving} onClick={save}>Enregistrer</Button>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Blocs Merchandising Tab ───────────────────────────────────────────────────
const MERCH_SLOTS = [
  { key: 'homepage_top_banner',   label: 'TopBanner Hero',          costKey: 'top_banner_per_day',        placement: 'homepage',   slots: 3 },
  { key: 'homepage_deal_of_day',  label: 'Deal of the Day',         costKey: 'deal_of_day_per_slot',      placement: 'homepage',   slots: 1 },
  { key: 'homepage_extra_remise', label: 'Extra Remise',            costKey: 'extra_remise_per_day',      placement: 'homepage',   slots: 10 },
  { key: 'homepage_ventes_flash', label: 'Ventes Flash',            costKey: 'flash_sale_per_day',        placement: 'homepage',   slots: 20 },
  { key: 'homepage_recommended',  label: 'Recommandé Pour Vous',    costKey: 'recommended_slot_per_day',  placement: 'homepage',   slots: 50 },
  { key: 'homepage_category_row', label: 'Ligne Catégorie (Sponsorisée)', costKey: 'category_row_per_day', placement: 'homepage',  slots: 30 },
  { key: 'homepage_footer_banner',label: 'Footer Banner',           costKey: 'footer_banner_per_day',     placement: 'homepage',   slots: 4 },
  { key: 'search_sponsored',      label: 'Search Sponsored',        costKey: 'search_sponsored_per_day',  placement: 'catalogue',  slots: 200 },
  { key: 'cart_cross_sell',       label: 'Cart Cross-Sell',         costKey: 'cart_cross_sell_per_day',   placement: 'panier',     slots: 50 },
  { key: 'rfq_boost_homepage',    label: 'RFQ Boost Slot',          costKey: 'rfq_homepage_boost',        placement: 'homepage',   slots: 5 },
];

type SlotStat = { cap: number; active: number; cost: number; capActive: boolean };

function MerchandisingBlocksTab() {
  const [stats, setStats] = useState<Record<string, SlotStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase.from('ad_inventory_caps').select('placement,daily_slots,active'),
      supabase.from('credit_costs').select('action_type,credits_per_unit'),
      supabase.from('campaigns').select('placement')
        .eq('status', 'active').or(`end_date.gte.${today},end_date.is.null`),
    ]).then(([capsRes, costsRes, campsRes]) => {
      const capsMap: Record<string, { slots: number; active: boolean }> = {};
      (capsRes.data ?? []).forEach((c: { placement: string; daily_slots: number; active: boolean }) => {
        capsMap[c.placement] = { slots: c.daily_slots, active: c.active };
      });
      const costsMap: Record<string, number> = {};
      (costsRes.data ?? []).forEach((c: { action_type: string; credits_per_unit: number }) => {
        costsMap[c.action_type] = c.credits_per_unit;
      });
      const activeCount: Record<string, number> = {};
      (campsRes.data ?? []).forEach((c: { placement: string }) => {
        activeCount[c.placement] = (activeCount[c.placement] ?? 0) + 1;
      });
      const result: Record<string, SlotStat> = {};
      MERCH_SLOTS.forEach(s => {
        result[s.key] = {
          cap: capsMap[s.key]?.slots ?? s.slots,
          active: activeCount[s.key] ?? 0,
          cost: costsMap[s.costKey] ?? 0,
          capActive: capsMap[s.key]?.active ?? true,
        };
      });
      setStats(result);
      setLoading(false);
    });
  }, []);

  const PLACEMENT_LABELS: Record<string, string> = {
    homepage: 'Homepage',
    catalogue: 'Catalogue / Recherche',
    panier: 'Page Panier',
  };

  const grouped = MERCH_SLOTS.reduce<Record<string, typeof MERCH_SLOTS>>((acc, s) => {
    acc[s.placement] = [...(acc[s.placement] ?? []), s];
    return acc;
  }, {});

  return (
    <SpaceBetween size="l">
      <Alert type="info">
        Vue en lecture seule des 12 emplacements merchandising. Pour modifier les caps ou les coûts, utilisez les onglets <strong>Inventaire publicitaire</strong> et <strong>Coûts crédits</strong>.
      </Alert>
      {loading ? <Spinner /> : Object.entries(grouped).map(([placement, slots]) => (
        <Container key={placement} header={<Header variant="h2">{PLACEMENT_LABELS[placement]}</Header>}>
          <Table
            items={slots}
            columnDefinitions={[
              {
                id: 'label', header: 'Bloc',
                cell: s => <Box fontWeight="bold">{s.label}</Box>,
              },
              {
                id: 'cap', header: 'Slots/jour',
                cell: s => {
                  const st = stats[s.key];
                  if (!st) return '—';
                  const pct = st.cap > 0 ? Math.round((st.active / st.cap) * 100) : 0;
                  const color = pct >= 90 ? 'text-status-error' : pct >= 60 ? 'text-status-warning' : 'text-status-success';
                  return (
                    <Box color={color}>
                      {st.active} / {st.cap} ({pct}%)
                    </Box>
                  );
                },
              },
              {
                id: 'cost', header: 'Coût (cr./unité)',
                cell: s => {
                  const cost = stats[s.key]?.cost ?? 0;
                  return cost > 0 ? `${cost} cr.` : '—';
                },
              },
              {
                id: 'revenue', header: 'Revenu potentiel/j',
                cell: s => {
                  const st = stats[s.key];
                  if (!st) return '—';
                  return `${(st.active * st.cost).toFixed(0)} cr.`;
                },
              },
              {
                id: 'status', header: 'Statut',
                cell: s => {
                  const st = stats[s.key];
                  if (!st) return '—';
                  if (!st.capActive) return <Box color="text-status-inactive">Désactivé</Box>;
                  if (st.active === 0) return <Box color="text-status-inactive">Aucune campagne</Box>;
                  if (st.active >= st.cap) return <Box color="text-status-error">Complet</Box>;
                  return <Box color="text-status-success">Actif — {st.cap - st.active} slot{st.cap - st.active > 1 ? 's' : ''} libre{st.cap - st.active > 1 ? 's' : ''}</Box>;
                },
              },
            ]}
            empty="Aucun emplacement configuré"
          />
        </Container>
      ))}
    </SpaceBetween>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function AdminMarketingConfig() {
  return (
    <ContentLayout header={<Header variant="h1">Marketing — Configuration</Header>}>
      <Tabs
        tabs={[
          { id: 'blocs',   label: '★ Blocs Merchandising', content: <MerchandisingBlocksTab /> },
          { id: 'tiers',   label: 'Tiers acheteurs',        content: <TiersTab /> },
          { id: 'costs',   label: 'Coûts crédits',          content: <CreditCostsTab /> },
          { id: 'caps',    label: 'Inventaire publicitaire', content: <InventoryCapsTab /> },
          { id: 'general', label: 'Config générale',        content: <GeneralConfigTab /> },
        ]}
      />
    </ContentLayout>
  );
}
