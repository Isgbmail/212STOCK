import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Box,
  TextFilter, Select, StatusIndicator, Badge,
  Modal, KeyValuePairs, Alert, Flashbar, ButtonDropdown,
  FormField, Input, Toggle, ColumnLayout, Tabs,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: '' },
  { label: 'Actif',            value: 'active'   },
  { label: 'Brouillon',        value: 'draft'    },
  { label: 'Inactif',          value: 'inactive' },
  { label: 'Archivé',          value: 'archived' },
];

const TEMP_OPTIONS = [
  { label: 'Toutes conservations', value: '' },
  { label: 'Ambiante',             value: 'ambient'      },
  { label: 'Réfrigéré',            value: 'refrigerated' },
  { label: 'Congelé',              value: 'frozen'       },
  { label: 'Frais',                value: 'fresh'        },
];

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif', draft: 'Brouillon', inactive: 'Inactif', archived: 'Archivé',
};
const statusType = (s: string): 'success' | 'warning' | 'stopped' | 'error' => ({
  active: 'success', draft: 'warning', inactive: 'stopped', archived: 'error',
} as Record<string, 'success' | 'warning' | 'stopped' | 'error'>)[s] ?? 'warning';

const TEMP_LABEL: Record<string, string> = {
  ambient: 'Ambiante', refrigerated: 'Réfrigéré', frozen: 'Congelé', fresh: 'Frais',
};

export default function AdminProducts() {
  const [products,    setProducts]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterText,  setFilterText]  = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter,   setTempFilter]   = useState('');
  const [selected,    setSelected]    = useState<any | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [totalCount,  setTotalCount]  = useState(0);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', ean: '', moq: '', temperature: 'ambient',
    is_new: false, is_on_promotion: false, is_sponsored: false,
  });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [editCategory, setEditCategory] = useState('');

  useEffect(() => { loadProducts(); }, [statusFilter, tempFilter]);

  useEffect(() => {
    supabase.from('categories').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setCategories((data as Array<{ id: string; name: string }>) ?? []));
  }, []);

  async function loadProducts() {
    setLoading(true);
    let q = supabase
      .from('products')
      .select(`
        id, name, ean, status, temperature, moq, pack_size,
        nutri_score, is_new, is_on_promotion, is_sponsored,
        avg_rating, review_count, created_at,
        organisations!seller_org_id(name),
        categories!category_id(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(300);

    if (statusFilter) q = q.eq('status', statusFilter);
    if (tempFilter)   q = q.eq('temperature', tempFilter);

    const { data, count } = await q;
    setProducts((data as any[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }

  function openEdit(p: any) {
    setEditForm({
      name:             p.name ?? '',
      ean:              p.ean ?? '',
      moq:              String(p.moq ?? 1),
      temperature:      p.temperature ?? 'ambient',
      is_new:           p.is_new ?? false,
      is_on_promotion:  p.is_on_promotion ?? false,
      is_sponsored:     p.is_sponsored ?? false,
    });
    setEditCategory(p.category_id ?? p.categories?.id ?? '');
    setEditMode(true);
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    const { error: err } = await supabase.from('products').update({
      name:            editForm.name,
      ean:             editForm.ean || null,
      moq:             parseInt(editForm.moq) || 1,
      temperature:     editForm.temperature,
      category_id:     editCategory || null,
      is_new:          editForm.is_new,
      is_on_promotion: editForm.is_on_promotion,
      is_sponsored:    editForm.is_sponsored,
    }).eq('id', selected.id);
    if (err) { setError(err.message); }
    else {
      setSuccess(`Produit "${editForm.name}" modifié.`);
      setSelected(null);
      setEditMode(false);
      loadProducts();
    }
    setSaving(false);
  }

  async function changeStatus(productId: string, newStatus: string) {
    setSaving(true); setError(''); setSuccess('');
    const { error: err } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', productId);
    if (err) { setError(err.message); }
    else {
      setSuccess(`Produit mis à jour : ${STATUS_LABEL[newStatus]}`);
      setSelected(null);
      loadProducts();
    }
    setSaving(false);
  }

  const filtered = products.filter((p) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.ean?.toLowerCase().includes(q) ||
      p.organisations?.name?.toLowerCase().includes(q) ||
      p.categories?.name?.toLowerCase().includes(q)
    );
  });

  const activeCount   = products.filter((p) => p.status === 'active').length;
  const draftCount    = products.filter((p) => p.status === 'draft').length;
  const inactiveCount = products.filter((p) => p.status === 'inactive').length;

  return (
    <SpaceBetween size="l">
      <Header variant="h1" description="Vue complète de tous les produits référencés sur la plateforme">
        Catalogue — Tous les produits
      </Header>

      {error   && <Flashbar items={[{ type: 'error',   content: error,   dismissible: true, onDismiss: () => setError('')   }]} />}
      {success && <Flashbar items={[{ type: 'success', content: success, dismissible: true, onDismiss: () => setSuccess('') }]} />}

      <Table
        header={
          <Header
            variant="h2"
            counter={`(${filtered.length} affichés / ${totalCount} total)`}
            description={`${activeCount} actifs · ${draftCount} brouillons · ${inactiveCount} inactifs`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Select
                  selectedOption={TEMP_OPTIONS.find((o) => o.value === tempFilter) ?? TEMP_OPTIONS[0]}
                  options={TEMP_OPTIONS}
                  onChange={({ detail }) => setTempFilter(detail.selectedOption.value ?? '')}
                />
                <Select
                  selectedOption={STATUS_OPTIONS.find((o) => o.value === statusFilter) ?? STATUS_OPTIONS[0]}
                  options={STATUS_OPTIONS}
                  onChange={({ detail }) => setStatusFilter(detail.selectedOption.value ?? '')}
                />
              </SpaceBetween>
            }
          >
            Produits
          </Header>
        }
        loading={loading}
        loadingText="Chargement des produits…"
        trackBy="id"
        items={filtered}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher par nom, EAN, vendeur, catégorie…"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        onRowClick={({ detail }) => setSelected(detail.item)}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Produit',
            cell: (p) => (
              <SpaceBetween size="xxs">
                <Box fontWeight="bold">{p.name}</Box>
                <Box color="text-body-secondary" fontSize="body-s">{p.ean ?? '—'}</Box>
              </SpaceBetween>
            ),
          },
          {
            id: 'seller',
            header: 'Vendeur',
            cell: (p) => p.organisations?.name ?? '—',
          },
          {
            id: 'category',
            header: 'Catégorie',
            cell: (p) => <Box color="text-body-secondary" fontSize="body-s">{p.categories?.name ?? '—'}</Box>,
          },
          {
            id: 'temperature',
            header: 'Conservation',
            cell: (p) => <Badge color={p.temperature === 'frozen' ? 'blue' : p.temperature === 'refrigerated' ? 'severity-medium' : 'grey'}>{TEMP_LABEL[p.temperature] ?? p.temperature}</Badge>,
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (p) => (
              <StatusIndicator type={statusType(p.status)}>
                {STATUS_LABEL[p.status] ?? p.status}
              </StatusIndicator>
            ),
          },
          {
            id: 'badges',
            header: 'Tags',
            cell: (p) => (
              <SpaceBetween direction="horizontal" size="xxs">
                {p.is_new          && <Badge color="green">Nouveau</Badge>}
                {p.is_on_promotion && <Badge color="red">Promo</Badge>}
                {p.is_sponsored    && <Badge color="blue">Sponsorisé</Badge>}
              </SpaceBetween>
            ),
          },
          {
            id: 'rating',
            header: 'Note',
            cell: (p) => p.avg_rating ? `${p.avg_rating.toFixed(1)} / 5 (${p.review_count})` : '—',
          },
          {
            id: 'actions',
            header: '',
            cell: (p) => (
              <ButtonDropdown
                items={[
                  { id: 'active',   text: 'Activer',    disabled: p.status === 'active'   },
                  { id: 'inactive', text: 'Désactiver', disabled: p.status === 'inactive'  },
                  { id: 'archived', text: 'Archiver',   disabled: p.status === 'archived'  },
                ]}
                onItemClick={({ detail }) => changeStatus(p.id, detail.id)}
                expandToViewport
              >
                Action
              </ButtonDropdown>
            ),
          },
        ]}
        empty={<Box textAlign="center" color="inherit" padding="l"><b>Aucun produit</b></Box>}
      />

      {/* ── Product Detail Modal ──────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        onDismiss={() => { setSelected(null); setEditMode(false); }}
        size="large"
        header={selected?.name}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => { setSelected(null); setEditMode(false); }}>Fermer</Button>
              {editMode ? (
                <Button variant="primary" loading={saving} onClick={saveEdit}>Enregistrer les modifications</Button>
              ) : (
                <>
                  <Button onClick={() => openEdit(selected)}>Modifier</Button>
                  {selected?.status !== 'active' && (
                    <Button variant="primary" onClick={() => changeStatus(selected.id, 'active')} loading={saving}>Activer</Button>
                  )}
                  {selected?.status === 'active' && (
                    <Button onClick={() => changeStatus(selected.id, 'inactive')} loading={saving}>Désactiver</Button>
                  )}
                  <Button onClick={() => changeStatus(selected?.id, 'archived')} loading={saving}>Archiver</Button>
                </>
              )}
            </SpaceBetween>
          </Box>
        }
      >
        {selected && !editMode && (
          <Tabs
            tabs={[
              {
                id: 'info',
                label: 'Informations',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Vendeur',      value: selected.organisations?.name ?? '—' },
                      { label: 'Catégorie',    value: selected.categories?.name ?? '—'    },
                      { label: 'EAN',          value: selected.ean ?? '—'                 },
                      { label: 'Conservation', value: TEMP_LABEL[selected.temperature] ?? selected.temperature },
                      { label: 'MOQ',          value: String(selected.moq)               },
                      { label: 'Colisage',     value: String(selected.pack_size ?? '—')  },
                      { label: 'Nutri-Score',  value: selected.nutri_score ?? '—'        },
                      { label: 'Note moy.',    value: selected.avg_rating ? `${selected.avg_rating.toFixed(1)} / 5` : '—' },
                      { label: 'Avis',         value: String(selected.review_count ?? 0)  },
                      { label: 'Statut',       value: STATUS_LABEL[selected.status] ?? selected.status },
                      { label: 'Nouveau',      value: selected.is_new ? 'Oui' : 'Non'    },
                      { label: 'En promotion', value: selected.is_on_promotion ? 'Oui' : 'Non' },
                      { label: 'Sponsorisé',   value: selected.is_sponsored ? 'Oui' : 'Non' },
                      { label: 'Créé le',      value: new Date(selected.created_at).toLocaleDateString('fr-FR') },
                    ]}
                  />
                ),
              },
            ]}
          />
        )}

        {selected && editMode && (
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <FormField label="Nom du produit *">
                <Input value={editForm.name} onChange={({ detail }) => setEditForm({ ...editForm, name: detail.value })} />
              </FormField>
              <FormField label="EAN / GTIN-13">
                <Input value={editForm.ean} onChange={({ detail }) => setEditForm({ ...editForm, ean: detail.value })} placeholder="3760123456789" />
              </FormField>
              <FormField label="MOQ (quantité minimale)">
                <Input type="number" value={editForm.moq} onChange={({ detail }) => setEditForm({ ...editForm, moq: detail.value })} />
              </FormField>
              <FormField label="Conservation">
                <Select
                  selectedOption={TEMP_OPTIONS.find((t) => t.value === editForm.temperature) ?? TEMP_OPTIONS[0]}
                  onChange={({ detail }) => setEditForm({ ...editForm, temperature: detail.selectedOption.value ?? 'ambient' })}
                  options={TEMP_OPTIONS.filter((t) => t.value)}
                />
              </FormField>
              <FormField label="Catégorie">
                <Select
                  selectedOption={
                    editCategory
                      ? { value: editCategory, label: categories.find((c) => c.id === editCategory)?.name ?? editCategory }
                      : { value: '', label: 'Non catégorisé' }
                  }
                  onChange={({ detail }) => setEditCategory(detail.selectedOption.value ?? '')}
                  options={[{ value: '', label: 'Non catégorisé' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                />
              </FormField>
            </ColumnLayout>
            <ColumnLayout columns={3}>
              <Toggle checked={editForm.is_new} onChange={({ detail }) => setEditForm({ ...editForm, is_new: detail.checked })}>Nouveau produit</Toggle>
              <Toggle checked={editForm.is_on_promotion} onChange={({ detail }) => setEditForm({ ...editForm, is_on_promotion: detail.checked })}>En promotion</Toggle>
              <Toggle checked={editForm.is_sponsored} onChange={({ detail }) => setEditForm({ ...editForm, is_sponsored: detail.checked })}>Sponsorisé</Toggle>
            </ColumnLayout>
          </SpaceBetween>
        )}
      </Modal>
    </SpaceBetween>
  );
}
