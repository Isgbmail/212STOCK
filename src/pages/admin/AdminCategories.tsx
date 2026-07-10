import { useEffect, useState } from 'react';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  Badge,
  Box,
  Modal,
  FormField,
  Input,
  Select,
  Toggle,
  Alert,
  TextFilter,
  ButtonDropdown,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    parent_id: '',
    description: '',
    display_order: '0',
  });

  // Edit state
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState({ name: '', parent_id: '', description: '', display_order: '0' });
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchCategories() {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('display_order');
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchCategories(); }, []);

  async function handleCreate() {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('categories').insert({
        name: form.name,
        parent_id: form.parent_id || null,
        description: form.description || null,
        display_order: parseInt(form.display_order) || 0,
        active: true,
      });
      if (err) throw err;
      setShowNew(false);
      setForm({ name: '', parent_id: '', description: '', display_order: '0' });
      fetchCategories();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cat: Category) {
    await supabase.from('categories').update({ active: !cat.active }).eq('id', cat.id);
    fetchCategories();
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    setEditForm({
      name:          cat.name,
      parent_id:     cat.parent_id ?? '',
      description:   (cat as unknown as { description: string }).description ?? '',
      display_order: String(cat.display_order),
    });
  }

  async function saveEdit() {
    if (!editCat) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('categories').update({
      name:          editForm.name,
      parent_id:     editForm.parent_id || null,
      description:   editForm.description || null,
      display_order: parseInt(editForm.display_order) || 0,
    }).eq('id', editCat.id);
    if (err) setError(err.message);
    else { setEditCat(null); fetchCategories(); }
    setSaving(false);
  }

  async function handleDelete(cat: Category) {
    setDeleting(true);
    await supabase.from('categories').delete().eq('id', cat.id);
    setConfirmDelete(null);
    setDeleting(false);
    fetchCategories();
  }

  const rootCategories = categories.filter((c) => !c.parent_id);
  const filtered = categories.filter((c) =>
    !filterText || c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      <Table
        header={
          <Header
            variant="h1"
            counter={`(${categories.length})`}
            actions={
              <Button variant="primary" onClick={() => setShowNew(true)}>+ Nouvelle catégorie</Button>
            }
          >
            Gestion des catégories
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher..."
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
            cell: (c: Category) => c.name,
            sortingField: 'name',
          },
          {
            id: 'parent',
            header: 'Catégorie parente',
            cell: (c: Category) => {
              if (!c.parent_id) return <Badge color="blue">Racine</Badge>;
              const parent = categories.find((p) => p.id === c.parent_id);
              return parent?.name ?? '—';
            },
          },
          {
            id: 'order',
            header: 'Ordre',
            cell: (c: Category) => c.display_order,
            sortingField: 'display_order',
          },
          {
            id: 'active',
            header: 'Actif',
            cell: (c: Category) => (
              <Toggle checked={c.active} onChange={() => toggleActive(c)} />
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (c: Category) => (
              <ButtonDropdown
                items={[
                  { id: 'edit',   text: 'Modifier' },
                  { id: 'delete', text: 'Supprimer', disabled: !c.parent_id && categories.some((x) => x.parent_id === c.id) },
                ]}
                onItemClick={({ detail: d }) => {
                  if (d.id === 'edit')   openEdit(c);
                  if (d.id === 'delete') setConfirmDelete(c);
                }}
              >
                Actions
              </ButtonDropdown>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune catégorie</b>
          </Box>
        }
      />

      <Modal
        visible={showNew}
        onDismiss={() => setShowNew(false)}
        header="Nouvelle catégorie"
        size="small"
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
          <FormField label="Nom *">
            <Input value={form.name} onChange={({ detail }) => setForm({ ...form, name: detail.value })} placeholder="Ex: Café" />
          </FormField>
          <FormField label="Catégorie parente">
            <Select
              selectedOption={
                form.parent_id
                  ? { value: form.parent_id, label: categories.find((c) => c.id === form.parent_id)?.name ?? '' }
                  : { value: '', label: 'Catégorie racine' }
              }
              onChange={({ detail }) => setForm({ ...form, parent_id: detail.selectedOption.value ?? '' })}
              options={[
                { value: '', label: 'Catégorie racine' },
                ...rootCategories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </FormField>
          <FormField label="Description">
            <Input value={form.description} onChange={({ detail }) => setForm({ ...form, description: detail.value })} />
          </FormField>
          <FormField label="Ordre d'affichage">
            <Input type="number" value={form.display_order} onChange={({ detail }) => setForm({ ...form, display_order: detail.value })} />
          </FormField>
        </SpaceBetween>
      </Modal>
      {/* ── EDIT MODAL ──────────────────────────────────── */}
      {editCat && (
        <Modal
          visible
          onDismiss={() => setEditCat(null)}
          header={`Modifier — ${editCat.name}`}
          size="small"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setEditCat(null)}>Annuler</Button>
                <Button variant="primary" loading={saving} onClick={saveEdit}>Enregistrer</Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            {error && <Alert type="error">{error}</Alert>}
            <FormField label="Nom *">
              <Input value={editForm.name} onChange={({ detail }) => setEditForm({ ...editForm, name: detail.value })} />
            </FormField>
            <FormField label="Catégorie parente">
              <Select
                selectedOption={
                  editForm.parent_id
                    ? { value: editForm.parent_id, label: categories.find((c) => c.id === editForm.parent_id)?.name ?? '' }
                    : { value: '', label: 'Catégorie racine' }
                }
                onChange={({ detail }) => setEditForm({ ...editForm, parent_id: detail.selectedOption.value ?? '' })}
                options={[
                  { value: '', label: 'Catégorie racine' },
                  ...rootCategories.filter((c) => c.id !== editCat.id).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </FormField>
            <FormField label="Description">
              <Input value={editForm.description} onChange={({ detail }) => setEditForm({ ...editForm, description: detail.value })} />
            </FormField>
            <FormField label="Ordre d'affichage">
              <Input type="number" value={editForm.display_order} onChange={({ detail }) => setEditForm({ ...editForm, display_order: detail.value })} />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}

      {/* ── DELETE CONFIRM ───────────────────────────── */}
      {confirmDelete && (
        <Modal
          visible
          onDismiss={() => setConfirmDelete(null)}
          header="Confirmer la suppression"
          size="small"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setConfirmDelete(null)}>Annuler</Button>
                <Button variant="primary" loading={deleting} onClick={() => handleDelete(confirmDelete)}>
                  Supprimer
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Box>
            Supprimer définitivement la catégorie <strong>{confirmDelete.name}</strong> ? Cette action est irréversible.
          </Box>
        </Modal>
      )}
    </SpaceBetween>
  );
}
