import { useEffect, useState } from 'react';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  Badge,
  TextFilter,
  Box,
  Modal,
  FormField,
  Input,
  Select,
  Toggle,
  Alert,
  StatusIndicator,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Promotion } from '../../types';

export default function VendorPromotions() {
  const { activeOrg } = useAuth();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    promo_type: 'percentage',
    discount_value: '',
    application: 'all_products',
    min_qty: '1',
    starts_at: '',
    ends_at: '',
    stackable: false,
  });

  async function fetchPromos() {
    if (!activeOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('promotions')
      .select('*')
      .eq('seller_org_id', activeOrg.id)
      .order('created_at', { ascending: false });
    setPromos((data as Promotion[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchPromos(); }, [activeOrg]);

  async function handleCreate() {
    if (!activeOrg || !form.name || !form.discount_value) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('promotions').insert({
        seller_org_id: activeOrg.id,
        name: form.name,
        promo_type: form.promo_type,
        discount_value: parseFloat(form.discount_value),
        application: form.application,
        min_qty: parseInt(form.min_qty) || 1,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        stackable: form.stackable,
        active: true,
      });
      if (err) throw err;
      setShowNew(false);
      setForm({ name: '', promo_type: 'percentage', discount_value: '', application: 'all_products', min_qty: '1', starts_at: '', ends_at: '', stackable: false });
      fetchPromos();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    await supabase.from('promotions').update({ active: !promo.active }).eq('id', promo.id);
    fetchPromos();
  }

  const now = new Date();
  const filtered = promos.filter((p) =>
    !filterText || p.name.toLowerCase().includes(filterText.toLowerCase())
  );

  function promoStatus(promo: Promotion): 'success' | 'warning' | 'stopped' {
    if (!promo.active) return 'stopped';
    if (promo.ends_at && new Date(promo.ends_at) < now) return 'stopped';
    if (promo.starts_at && new Date(promo.starts_at) > now) return 'warning';
    return 'success';
  }

  return (
    <SpaceBetween size="l">
      <Table
        header={
          <Header
            variant="h1"
            counter={`(${filtered.length})`}
            actions={
              <Button variant="primary" onClick={() => setShowNew(true)}>+ Nouvelle promotion</Button>
            }
          >
            Promotions
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Nom de la promotion..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        loading={loading}
        loadingText="Chargement..."
        trackBy="id"
        items={filtered}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Nom',
            cell: (p: Promotion) => p.name,
            sortingField: 'name',
          },
          {
            id: 'type',
            header: 'Type',
            cell: (p: Promotion) => (
              <Badge color={p.promo_type === 'percentage' ? 'blue' : 'green'}>
                {p.promo_type === 'percentage' ? `${p.discount_value}%` : `${p.discount_value} €`}
              </Badge>
            ),
          },
          {
            id: 'application',
            header: 'Application',
            cell: (p: Promotion) => ({
              all_products: 'Tous produits',
              specific_products: 'Produits spécifiques',
              category: 'Catégorie',
            }[p.application] ?? p.application),
          },
          {
            id: 'validity',
            header: 'Validité',
            cell: (p: Promotion) => {
              const start = p.starts_at ? new Date(p.starts_at).toLocaleDateString('fr-FR') : '—';
              const end = p.ends_at ? new Date(p.ends_at).toLocaleDateString('fr-FR') : '—';
              return `${start} → ${end}`;
            },
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (p: Promotion) => (
              <StatusIndicator type={promoStatus(p)}>
                {promoStatus(p) === 'success' ? 'Active' : promoStatus(p) === 'warning' ? 'À venir' : 'Inactive'}
              </StatusIndicator>
            ),
          },
          {
            id: 'active',
            header: 'Activer',
            cell: (p: Promotion) => (
              <Toggle checked={p.active} onChange={() => toggleActive(p)} />
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune promotion</b>
            <Box variant="p" color="inherit">Créez votre première promotion.</Box>
            <Button variant="primary" onClick={() => setShowNew(true)}>+ Créer</Button>
          </Box>
        }
      />

      <Modal
        visible={showNew}
        onDismiss={() => setShowNew(false)}
        header="Nouvelle promotion"
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowNew(false)}>Annuler</Button>
              <Button variant="primary" loading={saving} onClick={handleCreate}>Créer</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {error && <Alert type="error">{error}</Alert>}
          <FormField label="Nom de la promotion *">
            <Input value={form.name} onChange={({ detail }) => setForm({ ...form, name: detail.value })} placeholder="Promo été 2026" />
          </FormField>
          <FormField label="Type de remise">
            <Select
              selectedOption={{ value: form.promo_type, label: form.promo_type === 'percentage' ? 'Pourcentage (%)' : 'Montant fixe (€)' }}
              onChange={({ detail }) => setForm({ ...form, promo_type: detail.selectedOption.value ?? 'percentage' })}
              options={[
                { value: 'percentage', label: 'Pourcentage (%)' },
                { value: 'fixed', label: 'Montant fixe (€)' },
                { value: 'volume', label: 'Remise volume' },
              ]}
            />
          </FormField>
          <FormField label={form.promo_type === 'percentage' ? 'Valeur de la remise (%)' : 'Montant de la remise (€)'}>
            <Input
              type="number"
              value={form.discount_value}
              onChange={({ detail }) => setForm({ ...form, discount_value: detail.value })}
              placeholder={form.promo_type === 'percentage' ? 'Ex: 10' : 'Ex: 5.00'}
            />
          </FormField>
          <FormField label="Application">
            <Select
              selectedOption={{ value: form.application, label: form.application === 'all_products' ? 'Tous les produits' : 'Produits spécifiques' }}
              onChange={({ detail }) => setForm({ ...form, application: detail.selectedOption.value ?? 'all_products' })}
              options={[
                { value: 'all_products', label: 'Tous les produits' },
                { value: 'specific_products', label: 'Produits spécifiques' },
                { value: 'category', label: 'Catégorie' },
              ]}
            />
          </FormField>
          <FormField label="Quantité minimale">
            <Input type="number" value={form.min_qty} onChange={({ detail }) => setForm({ ...form, min_qty: detail.value })} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="Date de début">
              <Input type="datetime-local" value={form.starts_at} onChange={({ detail }) => setForm({ ...form, starts_at: detail.value })} />
            </FormField>
            <FormField label="Date de fin">
              <Input type="datetime-local" value={form.ends_at} onChange={({ detail }) => setForm({ ...form, ends_at: detail.value })} />
            </FormField>
          </div>
          <FormField label="Cumulable avec d'autres promotions">
            <Toggle checked={form.stackable} onChange={({ detail }) => setForm({ ...form, stackable: detail.checked })}>
              {form.stackable ? 'Oui' : 'Non'}
            </Toggle>
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
