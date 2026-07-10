import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Box, Modal, FormField,
  Input, Textarea, Flashbar, TextFilter, ButtonDropdown,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

interface Brand {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

const EMPTY_FORM = { name: '', description: '', logo_url: '' };

export default function AdminBrands() {
  const [brands, setBrands]     = useState<Brand[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Brand | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState<Brand | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function fetchBrands() {
    setLoading(true);
    const { data } = await supabase.from('brands').select('*').order('name');
    setBrands((data as Brand[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchBrands(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(b: Brand) {
    setEditing(b);
    setForm({ name: b.name, description: b.description ?? '', logo_url: b.logo_url ?? '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name:        form.name.trim(),
      description: form.description || null,
      logo_url:    form.logo_url || null,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from('brands').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('brands').insert(payload));
    }
    if (err) {
      setFlash({ type: 'error', msg: err.message });
    } else {
      setFlash({ type: 'success', msg: editing ? `Marque "${form.name}" modifiée.` : `Marque "${form.name}" créée.` });
      setShowModal(false);
      fetchBrands();
    }
    setSaving(false);
  }

  async function handleDelete(b: Brand) {
    await supabase.from('brands').delete().eq('id', b.id);
    setConfirmDel(null);
    setFlash({ type: 'success', msg: `Marque "${b.name}" supprimée.` });
    fetchBrands();
  }

  const filtered = brands.filter((b) => !filterText || b.name.toLowerCase().includes(filterText.toLowerCase()));

  return (
    <SpaceBetween size="l">
      {flash && (
        <Flashbar items={[{ type: flash.type, content: flash.msg, id: '1', dismissible: true, onDismiss: () => setFlash(null) }]} />
      )}

      <Table
        header={
          <Header
            variant="h1"
            counter={`(${brands.length})`}
            actions={<Button variant="primary" onClick={openCreate}>+ Nouvelle marque</Button>}
            description="Marques fabricants référencées dans le catalogue produit."
          >
            Marques
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher une marque…"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        loading={loading}
        loadingText="Chargement…"
        trackBy="id"
        items={filtered}
        columnDefinitions={[
          {
            id: 'logo',
            header: '',
            cell: (b) => b.logo_url
              ? <img src={b.logo_url} alt={b.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
              : <Box color="text-body-secondary">—</Box>,
            width: 60,
          },
          {
            id: 'name',
            header: 'Marque',
            cell: (b) => <Box fontWeight="bold">{b.name}</Box>,
            sortingField: 'name',
          },
          {
            id: 'description',
            header: 'Description',
            cell: (b) => b.description ?? <Box color="text-body-secondary">—</Box>,
            minWidth: 200,
          },
          {
            id: 'created',
            header: 'Ajoutée le',
            cell: (b) => new Date(b.created_at).toLocaleDateString('fr-FR'),
            width: 120,
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (b) => (
              <ButtonDropdown
                items={[
                  { id: 'edit',   text: 'Modifier' },
                  { id: 'delete', text: 'Supprimer' },
                ]}
                onItemClick={({ detail: d }) => {
                  if (d.id === 'edit')   openEdit(b);
                  if (d.id === 'delete') setConfirmDel(b);
                }}
              >
                Actions
              </ButtonDropdown>
            ),
            width: 110,
          },
        ]}
        empty={<Box textAlign="center" color="inherit"><b>Aucune marque</b></Box>}
      />

      {/* ── Create / Edit modal ─────────────────────────── */}
      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        header={editing ? `Modifier — ${editing.name}` : 'Nouvelle marque'}
        size="small"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Enregistrer' : 'Créer'}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Nom *">
            <Input value={form.name} onChange={({ detail }) => setForm({ ...form, name: detail.value })} placeholder="Ex: Nestlé" />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={({ detail }) => setForm({ ...form, description: detail.value })} rows={2} />
          </FormField>
          <FormField label="URL du logo" description="Lien direct vers l'image (HTTPS)">
            <Input value={form.logo_url} onChange={({ detail }) => setForm({ ...form, logo_url: detail.value })} placeholder="https://…" />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* ── Delete confirm ──────────────────────────────── */}
      {confirmDel && (
        <Modal
          visible
          onDismiss={() => setConfirmDel(null)}
          header="Confirmer la suppression"
          size="small"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirmDel(null)}>Annuler</Button>
                <Button variant="primary" onClick={() => handleDelete(confirmDel)}>Supprimer</Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Box>Supprimer la marque <strong>{confirmDel.name}</strong> ? Les produits associés perdront leur référence marque.</Box>
        </Modal>
      )}
    </SpaceBetween>
  );
}
