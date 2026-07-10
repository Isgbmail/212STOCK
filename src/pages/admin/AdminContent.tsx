import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Container, ColumnLayout, Box, Table,
  Badge, Button, Modal, FormField, Input, Textarea, Select,
  Flashbar, ButtonDropdown, Toggle,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

interface ContentItem {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
}

const TYPE_OPTIONS = [
  { value: 'banner',     label: 'Bannière homepage' },
  { value: 'popup',      label: 'Pop-up promotionnel' },
  { value: 'highlight',  label: 'Mise en avant catalogue' },
  { value: 'faq',        label: 'FAQ article' },
  { value: 'legal',      label: 'Contenu légal' },
  { value: 'email',      label: 'Template email' },
];

const TYPE_COLOR: Record<string, 'blue' | 'green' | 'grey' | 'red'> = {
  banner: 'blue', popup: 'red', highlight: 'green', faq: 'grey', legal: 'grey', email: 'blue',
};

const EMPTY_FORM = { type: 'banner', title: '', subtitle: '', body: '', cta_label: '', cta_url: '', image_url: '', display_order: '0' };

export default function AdminContent() {
  const [items, setItems]         = useState<ContentItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<ContentItem | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [flash, setFlash]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .order('display_order')
      .order('created_at', { ascending: false });
    setItems((data as ContentItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(item: ContentItem) {
    setEditing(item);
    setForm({
      type:          item.type,
      title:         item.title,
      subtitle:      item.subtitle ?? '',
      body:          item.body ?? '',
      cta_label:     item.cta_label ?? '',
      cta_url:       item.cta_url ?? '',
      image_url:     item.image_url ?? '',
      display_order: String(item.display_order),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      type:          form.type,
      title:         form.title.trim(),
      subtitle:      form.subtitle || null,
      body:          form.body || null,
      cta_label:     form.cta_label || null,
      cta_url:       form.cta_url || null,
      image_url:     form.image_url || null,
      display_order: parseInt(form.display_order) || 0,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from('content_items').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('content_items').insert({ ...payload, active: true }));
    }
    if (err) {
      setFlash({ type: 'error', msg: err.message });
    } else {
      setFlash({ type: 'success', msg: editing ? 'Contenu modifié.' : 'Contenu créé.' });
      setShowModal(false);
      fetchItems();
    }
    setSaving(false);
  }

  async function toggleActive(item: ContentItem) {
    await supabase.from('content_items').update({ active: !item.active }).eq('id', item.id);
    fetchItems();
  }

  async function handleDelete(item: ContentItem) {
    await supabase.from('content_items').delete().eq('id', item.id);
    setFlash({ type: 'success', msg: `"${item.title}" supprimé.` });
    fetchItems();
  }

  const byType = TYPE_OPTIONS.map((opt) => ({
    ...opt,
    count: items.filter((i) => i.type === opt.value).length,
    active: items.filter((i) => i.type === opt.value && i.active).length,
  }));

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Contenus éditoriaux</Header>

      {flash && (
        <Flashbar items={[{ type: flash.type, content: flash.msg, id: '1', dismissible: true, onDismiss: () => setFlash(null) }]} />
      )}

      {/* ── Stats par type ─────────────────────────────────────── */}
      <Container header={<Header variant="h2">Aperçu par type</Header>}>
        <ColumnLayout columns={3} variant="text-grid">
          {byType.filter((t) => t.count > 0 || t.value === 'banner').map((t) => (
            <div key={t.value}>
              <Box variant="awsui-key-label">{t.label}</Box>
              <Box fontSize="heading-l" fontWeight="bold">{t.count}</Box>
              <Box variant="small" color="text-body-secondary">{t.active} actif{t.active > 1 ? 's' : ''}</Box>
            </div>
          ))}
        </ColumnLayout>
      </Container>

      {/* ── Table ─────────────────────────────────────────────── */}
      <Table
        loading={loading}
        loadingText="Chargement…"
        header={
          <Header
            variant="h2"
            actions={<Button variant="primary" onClick={openCreate}>+ Nouveau contenu</Button>}
          >
            Tous les contenus
          </Header>
        }
        items={items}
        trackBy="id"
        columnDefinitions={[
          {
            id: 'type',
            header: 'Type',
            cell: (i) => <Badge color={TYPE_COLOR[i.type] ?? 'grey'}>{TYPE_OPTIONS.find((t) => t.value === i.type)?.label ?? i.type}</Badge>,
            width: 160,
          },
          {
            id: 'title',
            header: 'Titre',
            cell: (i) => <Box fontWeight="bold">{i.title}</Box>,
            minWidth: 200,
          },
          {
            id: 'subtitle',
            header: 'Sous-titre',
            cell: (i) => i.subtitle ?? <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'order',
            header: 'Ordre',
            cell: (i) => i.display_order,
            width: 70,
          },
          {
            id: 'active',
            header: 'Actif',
            cell: (i) => <Toggle checked={i.active} onChange={() => toggleActive(i)} />,
            width: 80,
          },
          {
            id: 'actions',
            header: '',
            cell: (i) => (
              <ButtonDropdown
                items={[{ id: 'edit', text: 'Modifier' }, { id: 'delete', text: 'Supprimer' }]}
                onItemClick={({ detail: d }) => {
                  if (d.id === 'edit')   openEdit(i);
                  if (d.id === 'delete') handleDelete(i);
                }}
              >
                Actions
              </ButtonDropdown>
            ),
            width: 110,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucun contenu éditorial</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Créez vos premières bannières, pop-ups ou articles FAQ.
            </Box>
            <Button variant="primary" onClick={openCreate}>+ Nouveau contenu</Button>
          </Box>
        }
      />

      {/* ── Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        header={editing ? `Modifier — ${editing.title}` : 'Nouveau contenu éditorial'}
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>{editing ? 'Enregistrer' : 'Créer'}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="Type *">
              <Select
                selectedOption={TYPE_OPTIONS.find((t) => t.value === form.type) ?? TYPE_OPTIONS[0]}
                onChange={({ detail }) => setForm({ ...form, type: detail.selectedOption.value ?? 'banner' })}
                options={TYPE_OPTIONS}
              />
            </FormField>
            <FormField label="Ordre d'affichage">
              <Input type="number" value={form.display_order} onChange={({ detail }) => setForm({ ...form, display_order: detail.value })} />
            </FormField>
          </ColumnLayout>
          <FormField label="Titre *">
            <Input value={form.title} onChange={({ detail }) => setForm({ ...form, title: detail.value })} placeholder="Ex: Nouvelle collection automne" />
          </FormField>
          <FormField label="Sous-titre">
            <Input value={form.subtitle} onChange={({ detail }) => setForm({ ...form, subtitle: detail.value })} />
          </FormField>
          <FormField label="Corps / Contenu" description="Texte principal ou HTML">
            <Textarea value={form.body} onChange={({ detail }) => setForm({ ...form, body: detail.value })} rows={3} />
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="Texte bouton CTA">
              <Input value={form.cta_label} onChange={({ detail }) => setForm({ ...form, cta_label: detail.value })} placeholder="Découvrir" />
            </FormField>
            <FormField label="URL du CTA">
              <Input value={form.cta_url} onChange={({ detail }) => setForm({ ...form, cta_url: detail.value })} placeholder="/catalogue" />
            </FormField>
          </ColumnLayout>
          <FormField label="URL de l'image">
            <Input value={form.image_url} onChange={({ detail }) => setForm({ ...form, image_url: detail.value })} placeholder="https://…" />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
