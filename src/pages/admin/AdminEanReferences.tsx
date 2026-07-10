import { useState, useEffect, useMemo } from 'react';
import {
  Table, Header, Button, SpaceBetween, Box,
  TextFilter, Select, Badge, Modal, FormField, Input, Textarea,
  ColumnLayout, Alert, Multiselect, Flashbar, StatusIndicator,
  Tabs, Container,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EanRef {
  id: string;
  ean: string;
  name: string;
  short_description: string | null;
  images: string[];
  category_id: string | null;
  brand_id: string | null;
  temperature: string;
  physical_form: string | null;
  net_weight: number | null;
  weight_unit: string | null;
  certifications: string[];
  allergens: string[];
  nutri_score: string | null;
  pack_size: number;
  shelf_life_days: number | null;
  origin_country: string | null;
  hs_code: string | null;
  packaging_type: string | null;
  manufacturer_name: string | null;
  status: 'active' | 'pending' | 'rejected';
  source: 'platform' | 'vendor';
  created_at: string;
  // joined
  category_name?: string;
  brand_name?: string;
}

interface Cat { id: string; name: string }
interface Br  { id: string; name: string }

type FormState = {
  ean: string; name: string; short_description: string; images: string;
  category_id: string; brand_id: string; temperature: string;
  physical_form: string; net_weight: string; weight_unit: string;
  certifications: string[]; allergens: string[]; nutri_score: string;
  pack_size: string; shelf_life_days: string; origin_country: string;
  hs_code: string; packaging_type: string; manufacturer_name: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  ean: '', name: '', short_description: '', images: '',
  category_id: '', brand_id: '', temperature: 'ambient',
  physical_form: '', net_weight: '', weight_unit: 'g',
  certifications: [], allergens: [], nutri_score: '',
  pack_size: '1', shelf_life_days: '', origin_country: '',
  hs_code: '', packaging_type: '', manufacturer_name: '',
  status: 'active',
};

// ── Options ──────────────────────────────────────────────────────────────────
const TEMP_OPTS = [
  { label: 'Ambiant',    value: 'ambient'      },
  { label: 'Réfrigéré',  value: 'refrigerated' },
  { label: 'Frais',      value: 'fresh'        },
  { label: 'Surgelé',    value: 'frozen'       },
];
const FORM_OPTS = [
  { label: '—',       value: '' },
  { label: 'Liquide', value: 'liquid'  }, { label: 'Solide',    value: 'solid'   },
  { label: 'Poudre',  value: 'powder'  }, { label: 'Gel',       value: 'gel'     },
  { label: 'Aérosol', value: 'aerosol' }, { label: 'Crème',     value: 'cream'   },
  { label: 'Comprimé',value: 'tablet'  }, { label: 'Autre',     value: 'other'   },
];
const NUTRI_OPTS = [
  { label: '—', value: '' },
  { label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' },
  { label: 'D', value: 'D' }, { label: 'E', value: 'E' },
];
const STATUS_OPTS = [
  { label: 'Tous',     value: 'all'      },
  { label: 'Actifs',   value: 'active'   },
  { label: 'En attente', value: 'pending' },
  { label: 'Rejetés',  value: 'rejected' },
];
const CERTIF_OPTS = ['Bio','Halal','Kasher','Fairtrade','ISO 22000','IFS','BRC','HACCP','MSC','FSC','ONSSA','ECOCERT']
  .map(c => ({ label: c, value: c }));
const ALLERGEN_OPTS = ['Lait','Gluten','Arachides','Œufs','Poisson','Crustacés','Soja','Fruits à coque','Céleri','Moutarde','Sésame','Lupin','Mollusques','SO₂']
  .map(a => ({ label: a, value: a }));
const WEIGHT_UNIT_OPTS = ['g','kg','ml','cl','L'].map(u => ({ label: u, value: u }));

function statusType(s: string): 'success' | 'warning' | 'error' | 'pending' {
  if (s === 'active')   return 'success';
  if (s === 'pending')  return 'pending';
  return 'error';
}

function refToForm(r: EanRef): FormState {
  return {
    ean:              r.ean,
    name:             r.name,
    short_description: r.short_description ?? '',
    images:           (r.images ?? []).join('\n'),
    category_id:      r.category_id ?? '',
    brand_id:         r.brand_id    ?? '',
    temperature:      r.temperature,
    physical_form:    r.physical_form   ?? '',
    net_weight:       r.net_weight != null ? String(r.net_weight) : '',
    weight_unit:      r.weight_unit     ?? 'g',
    certifications:   r.certifications  ?? [],
    allergens:        r.allergens       ?? [],
    nutri_score:      r.nutri_score     ?? '',
    pack_size:        String(r.pack_size ?? 1),
    shelf_life_days:  r.shelf_life_days != null ? String(r.shelf_life_days) : '',
    origin_country:   r.origin_country  ?? '',
    hs_code:          r.hs_code         ?? '',
    packaging_type:   r.packaging_type  ?? '',
    manufacturer_name: r.manufacturer_name ?? '',
    status:           r.status,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminEanReferences() {
  const [refs, setRefs]           = useState<EanRef[]>([]);
  const [cats, setCats]           = useState<Cat[]>([]);
  const [brands, setBrands]       = useState<Br[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [flash, setFlash]         = useState('');
  const [flashErr, setFlashErr]   = useState('');

  const [filterText, setFilterText]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected]       = useState<EanRef[]>([]);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editItem, setEditItem]       = useState<EanRef | null>(null);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [formErr, setFormErr]         = useState('');

  useEffect(() => {
    load();
    supabase.from('categories').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setCats((data ?? []) as Cat[]));
    supabase.from('brands').select('id, name').order('name')
      .then(({ data }) => setBrands((data ?? []) as Br[]));
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('ean_references')
      .select('*, categories:category_id(name), brands:brand_id(name)')
      .order('created_at', { ascending: false });
    const rows: EanRef[] = (data ?? []).map((r: any) => ({
      ...r,
      category_name: r.categories?.name ?? null,
      brand_name:    r.brands?.name     ?? null,
    }));
    setRefs(rows);
    setLoading(false);
  }

  const filtered = useMemo(() => refs.filter(r =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (r.ean.includes(filterText) || r.name.toLowerCase().includes(filterText.toLowerCase()))
  ), [refs, statusFilter, filterText]);

  function ff(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openCreate() { setEditItem(null); setForm(EMPTY_FORM); setFormErr(''); setModalOpen(true); }
  function openEdit(item: EanRef) { setEditItem(item); setForm(refToForm(item)); setFormErr(''); setModalOpen(true); }

  async function save() {
    if (!form.ean.trim()) { setFormErr('Le code EAN est obligatoire.'); return; }
    if (!form.name.trim()) { setFormErr('Le nom est obligatoire.'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = {
        ean:              form.ean.trim(),
        name:             form.name.trim(),
        short_description: form.short_description || null,
        images:           form.images.split('\n').map(l => l.trim()).filter(Boolean),
        category_id:      form.category_id  || null,
        brand_id:         form.brand_id     || null,
        temperature:      form.temperature,
        physical_form:    form.physical_form || null,
        net_weight:       parseFloat(form.net_weight) || null,
        weight_unit:      form.weight_unit || 'g',
        certifications:   form.certifications,
        allergens:        form.allergens,
        nutri_score:      form.nutri_score || null,
        pack_size:        parseInt(form.pack_size) || 1,
        shelf_life_days:  parseInt(form.shelf_life_days) || null,
        origin_country:   form.origin_country || null,
        hs_code:          form.hs_code        || null,
        packaging_type:   form.packaging_type || null,
        manufacturer_name: form.manufacturer_name || null,
        status:           form.status,
        source:           editItem?.source ?? 'platform',
        updated_at:       new Date().toISOString(),
      };
      if (editItem) {
        const { error } = await supabase.from('ean_references').update(payload).eq('id', editItem.id);
        if (error) throw error;
        setFlash('Référence mise à jour.');
      } else {
        const { error } = await supabase.from('ean_references').insert({ ...payload, source: 'platform' });
        if (error) throw error;
        setFlash('Référence créée.');
      }
      setModalOpen(false);
      setSelected([]);
      load();
    } catch (e: any) {
      setFormErr(e.message ?? 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: EanRef, newStatus: 'active' | 'rejected') {
    const { error } = await supabase.from('ean_references')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) { setFlashErr(error.message); return; }
    setFlash(newStatus === 'active' ? 'Référence approuvée.' : 'Référence rejetée.');
    setSelected([]);
    load();
  }

  const catOpts  = [{ label: '— Aucune —', value: '' }, ...cats.map(c  => ({ label: c.name,  value: c.id  }))];
  const brandOpts = [{ label: '— Aucune —', value: '' }, ...brands.map(b => ({ label: b.name, value: b.id }))];

  return (
    <SpaceBetween size="l">
      {flash    && <Flashbar items={[{ type: 'success', content: flash,    onDismiss: () => setFlash('')    }]} />}
      {flashErr && <Flashbar items={[{ type: 'error',   content: flashErr, onDismiss: () => setFlashErr('') }]} />}

      <Table
        items={filtered}
        loading={loading}
        loadingText="Chargement des références…"
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        columnDefinitions={[
          {
            id: 'ean', header: 'EAN',
            cell: r => <Box variant="code">{r.ean}</Box>,
            width: 160,
          },
          { id: 'name',     header: 'Nom',       cell: r => r.name,            isRowHeader: true },
          { id: 'category', header: 'Catégorie',  cell: r => r.category_name ?? '—' },
          { id: 'brand',    header: 'Marque',     cell: r => r.brand_name    ?? '—' },
          {
            id: 'status', header: 'Statut',
            cell: r => (
              <StatusIndicator type={statusType(r.status)}>
                {r.status === 'active' ? 'Actif' : r.status === 'pending' ? 'En attente' : 'Rejeté'}
              </StatusIndicator>
            ),
            width: 130,
          },
          {
            id: 'source', header: 'Source',
            cell: r => <Badge color={r.source === 'platform' ? 'blue' : 'grey'}>
              {r.source === 'platform' ? 'Plateforme' : 'Vendeur'}
            </Badge>,
            width: 110,
          },
          { id: 'date', header: 'Date', cell: r => r.created_at.slice(0, 10), width: 110 },
        ]}
        header={
          <Header
            counter={`(${filtered.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {selected[0]?.status === 'pending' && (
                  <>
                    <Button onClick={() => changeStatus(selected[0], 'active')}>Approuver</Button>
                    <Button onClick={() => changeStatus(selected[0], 'rejected')}>Rejeter</Button>
                  </>
                )}
                <Button
                  disabled={!selected[0]}
                  onClick={() => selected[0] && openEdit(selected[0])}
                >Modifier</Button>
                <Button variant="primary" onClick={openCreate}>+ Ajouter</Button>
              </SpaceBetween>
            }
          >
            Références EAN
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Rechercher EAN ou nom…"
              onChange={({ detail }) => setFilterText(detail.filteringText)}
            />
            <Select
              selectedOption={STATUS_OPTS.find(o => o.value === statusFilter) ?? STATUS_OPTS[0]}
              options={STATUS_OPTS}
              onChange={({ detail }) => setStatusFilter(detail.selectedOption.value)}
            />
          </SpaceBetween>
        }
        empty={
          <Box textAlign="center" color="inherit" padding="xl">
            <b>Aucune référence EAN</b>
            <Box padding={{ top: 's' }} color="inherit">
              Cliquez sur &quot;+ Ajouter&quot; pour créer la première référence.
            </Box>
          </Box>
        }
      />

      {/* ── Modal création/édition ── */}
      <Modal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        header={editItem ? `Modifier — ${editItem.ean}` : 'Nouvelle référence EAN'}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button variant="primary" loading={saving} onClick={save}>
                {editItem ? 'Enregistrer' : 'Créer'}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {formErr && <Alert type="error">{formErr}</Alert>}

          <Tabs tabs={[
            {
              id: 'basic',
              label: 'Informations générales',
              content: (
                <SpaceBetween size="m">
                  <ColumnLayout columns={2}>
                    <FormField label="Code EAN *">
                      <Input value={form.ean} onChange={({ detail }) => ff('ean', detail.value)} placeholder="3760123456789" />
                    </FormField>
                    <FormField label="Nom du produit *">
                      <Input value={form.name} onChange={({ detail }) => ff('name', detail.value)} placeholder="Ex: Yaourt nature 500g" />
                    </FormField>
                    <FormField label="Catégorie">
                      <Select
                        selectedOption={catOpts.find(o => o.value === form.category_id) ?? catOpts[0]}
                        options={catOpts}
                        onChange={({ detail }) => ff('category_id', detail.selectedOption.value)}
                      />
                    </FormField>
                    <FormField label="Marque">
                      <Select
                        selectedOption={brandOpts.find(o => o.value === form.brand_id) ?? brandOpts[0]}
                        options={brandOpts}
                        onChange={({ detail }) => ff('brand_id', detail.selectedOption.value)}
                      />
                    </FormField>
                    <FormField label="Température">
                      <Select
                        selectedOption={TEMP_OPTS.find(o => o.value === form.temperature) ?? TEMP_OPTS[0]}
                        options={TEMP_OPTS}
                        onChange={({ detail }) => ff('temperature', detail.selectedOption.value)}
                      />
                    </FormField>
                    <FormField label="Statut">
                      <Select
                        selectedOption={STATUS_OPTS.slice(1).find(o => o.value === form.status) ?? STATUS_OPTS[1]}
                        options={STATUS_OPTS.slice(1)}
                        onChange={({ detail }) => ff('status', detail.selectedOption.value)}
                      />
                    </FormField>
                  </ColumnLayout>
                  <FormField label="Description courte">
                    <Textarea
                      value={form.short_description}
                      onChange={({ detail }) => ff('short_description', detail.value)}
                      rows={2}
                    />
                  </FormField>
                  <FormField label="Images (une URL par ligne)">
                    <Textarea
                      value={form.images}
                      onChange={({ detail }) => ff('images', detail.value)}
                      placeholder="https://…/image1.jpg&#10;https://…/image2.jpg"
                      rows={3}
                    />
                  </FormField>
                </SpaceBetween>
              ),
            },
            {
              id: 'tech',
              label: 'Détails techniques',
              content: (
                <SpaceBetween size="m">
                  <ColumnLayout columns={3}>
                    <FormField label="Poids net">
                      <Input value={form.net_weight} onChange={({ detail }) => ff('net_weight', detail.value)} type="number" placeholder="500" />
                    </FormField>
                    <FormField label="Unité">
                      <Select
                        selectedOption={WEIGHT_UNIT_OPTS.find(o => o.value === form.weight_unit) ?? WEIGHT_UNIT_OPTS[0]}
                        options={WEIGHT_UNIT_OPTS}
                        onChange={({ detail }) => ff('weight_unit', detail.selectedOption.value)}
                      />
                    </FormField>
                    <FormField label="Forme physique">
                      <Select
                        selectedOption={FORM_OPTS.find(o => o.value === form.physical_form) ?? FORM_OPTS[0]}
                        options={FORM_OPTS}
                        onChange={({ detail }) => ff('physical_form', detail.selectedOption.value)}
                      />
                    </FormField>
                    <FormField label="Colisage (pack_size)">
                      <Input value={form.pack_size} onChange={({ detail }) => ff('pack_size', detail.value)} type="number" />
                    </FormField>
                    <FormField label="DLC / DDM (jours)">
                      <Input value={form.shelf_life_days} onChange={({ detail }) => ff('shelf_life_days', detail.value)} type="number" />
                    </FormField>
                    <FormField label="Nutri-Score">
                      <Select
                        selectedOption={NUTRI_OPTS.find(o => o.value === form.nutri_score) ?? NUTRI_OPTS[0]}
                        options={NUTRI_OPTS}
                        onChange={({ detail }) => ff('nutri_score', detail.selectedOption.value)}
                      />
                    </FormField>
                    <FormField label="Pays d'origine">
                      <Input value={form.origin_country} onChange={({ detail }) => ff('origin_country', detail.value)} placeholder="France" />
                    </FormField>
                    <FormField label="Code SH / HS">
                      <Input value={form.hs_code} onChange={({ detail }) => ff('hs_code', detail.value)} placeholder="0401.10.00" />
                    </FormField>
                    <FormField label="Conditionnement">
                      <Input value={form.packaging_type} onChange={({ detail }) => ff('packaging_type', detail.value)} placeholder="Boîte, Sachet…" />
                    </FormField>
                    <FormField label="Fabricant">
                      <Input value={form.manufacturer_name} onChange={({ detail }) => ff('manufacturer_name', detail.value)} />
                    </FormField>
                  </ColumnLayout>
                  <ColumnLayout columns={2}>
                    <FormField label="Certifications">
                      <Multiselect
                        selectedOptions={form.certifications.map(c => ({ label: c, value: c }))}
                        options={CERTIF_OPTS}
                        onChange={({ detail }) =>
                          setForm(f => ({ ...f, certifications: detail.selectedOptions.map(o => o.value as string) }))
                        }
                        placeholder="Sélectionner…"
                      />
                    </FormField>
                    <FormField label="Allergènes">
                      <Multiselect
                        selectedOptions={form.allergens.map(a => ({ label: a, value: a }))}
                        options={ALLERGEN_OPTS}
                        onChange={({ detail }) =>
                          setForm(f => ({ ...f, allergens: detail.selectedOptions.map(o => o.value as string) }))
                        }
                        placeholder="Sélectionner…"
                      />
                    </FormField>
                  </ColumnLayout>
                </SpaceBetween>
              ),
            },
          ]} />
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
