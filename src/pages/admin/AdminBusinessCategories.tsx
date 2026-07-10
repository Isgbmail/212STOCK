import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Container, ColumnLayout, Box, Table,
  Badge, Button, Modal, FormField, Input, Textarea,
  Flashbar, ButtonDropdown, TextFilter,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

interface SubTypeRow {
  sub_type: string;
  org_type: string;
  count: number;
}

interface SubTypeDef {
  id: string;
  name: string;
  org_type: string;
  description: string | null;
}

const ORG_TYPE_COLOR: Record<string, 'blue' | 'green' | 'grey'> = {
  buyer:    'blue',
  seller:   'green',
  delivery: 'grey',
};

const ORG_TYPE_LABEL: Record<string, string> = {
  buyer: 'Acheteur', seller: 'Vendeur', delivery: 'Livreur',
};

export default function AdminBusinessCategories() {
  const [usedSubTypes, setUsedSubTypes]   = useState<SubTypeRow[]>([]);
  const [definitions, setDefinitions]     = useState<SubTypeDef[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filterText, setFilterText]       = useState('');
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editDef, setEditDef]     = useState<SubTypeDef | null>(null);
  const [form, setForm] = useState({ name: '', org_type: 'buyer', description: '' });
  const [saving, setSaving]       = useState(false);

  async function load() {
    setLoading(true);
    const [orgRes, defRes] = await Promise.all([
      supabase.from('organisations').select('sub_type, org_type').not('sub_type', 'is', null),
      supabase.from('org_subtypes').select('*').order('org_type').order('name').catch(() => ({ data: null, error: null })),
    ]);

    // Aggregate used sub_types
    const agg: Record<string, SubTypeRow> = {};
    ((orgRes.data ?? []) as Array<{ sub_type: string; org_type: string }>).forEach((o) => {
      const key = `${o.org_type}::${o.sub_type}`;
      if (!agg[key]) agg[key] = { sub_type: o.sub_type, org_type: o.org_type, count: 0 };
      agg[key].count++;
    });
    setUsedSubTypes(Object.values(agg).sort((a, b) => b.count - a.count));

    if ((defRes as { data: SubTypeDef[] | null }).data) {
      setDefinitions(((defRes as { data: SubTypeDef[] | null }).data) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditDef(null);
    setForm({ name: '', org_type: 'buyer', description: '' });
    setShowModal(true);
  }

  function openEdit(d: SubTypeDef) {
    setEditDef(d);
    setForm({ name: d.name, org_type: d.org_type, description: d.description ?? '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), org_type: form.org_type, description: form.description || null };
    let err;
    if (editDef) {
      ({ error: err } = await supabase.from('org_subtypes').update(payload).eq('id', editDef.id));
    } else {
      ({ error: err } = await supabase.from('org_subtypes').insert(payload));
    }
    if (err) {
      setFlash({ type: 'error', msg: err.message });
    } else {
      setFlash({ type: 'success', msg: editDef ? 'Type modifié.' : 'Type créé.' });
      setShowModal(false);
      load();
    }
    setSaving(false);
  }

  async function handleDelete(d: SubTypeDef) {
    await supabase.from('org_subtypes').delete().eq('id', d.id);
    setFlash({ type: 'success', msg: `Type "${d.name}" supprimé.` });
    load();
  }

  const filteredUsed = usedSubTypes.filter((r) =>
    !filterText || r.sub_type.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Types d'acteurs (sous-types)</Header>

      {flash && (
        <Flashbar items={[{ type: flash.type, content: flash.msg, id: '1', dismissible: true, onDismiss: () => setFlash(null) }]} />
      )}

      {/* ── Répartition en base ───────────────────────────────────── */}
      <Container header={<Header variant="h2">Répartition actuelle des sous-types</Header>}>
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filtrer…"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
          <Table
            loading={loading}
            loadingText="Chargement…"
            items={filteredUsed}
            trackBy="sub_type"
            columnDefinitions={[
              {
                id: 'type',
                header: 'Catégorie d\'acteur',
                cell: (r) => <Badge color={ORG_TYPE_COLOR[r.org_type] ?? 'grey'}>{ORG_TYPE_LABEL[r.org_type] ?? r.org_type}</Badge>,
              },
              {
                id: 'sub_type',
                header: 'Sous-type',
                cell: (r) => <Box fontWeight="bold">{r.sub_type}</Box>,
              },
              {
                id: 'count',
                header: 'Organisations',
                cell: (r) => r.count,
              },
            ]}
            empty={<Box textAlign="center">Aucun sous-type renseigné dans les organisations</Box>}
          />
        </SpaceBetween>
      </Container>

      {/* ── Définitions officielles ───────────────────────────────── */}
      <Container
        header={
          <Header
            variant="h2"
            actions={<Button variant="primary" onClick={openCreate}>+ Nouveau type</Button>}
            description="Définissez les types autorisés — les vendeurs/acheteurs les voient pendant l'onboarding."
          >
            Définitions officielles
          </Header>
        }
      >
        <Table
          loading={loading}
          items={definitions}
          trackBy="id"
          columnDefinitions={[
            {
              id: 'org_type',
              header: 'Type d\'acteur',
              cell: (d) => <Badge color={ORG_TYPE_COLOR[d.org_type] ?? 'grey'}>{ORG_TYPE_LABEL[d.org_type] ?? d.org_type}</Badge>,
            },
            {
              id: 'name',
              header: 'Nom',
              cell: (d) => <Box fontWeight="bold">{d.name}</Box>,
            },
            {
              id: 'description',
              header: 'Description',
              cell: (d) => d.description ?? <Box color="text-body-secondary">—</Box>,
              minWidth: 200,
            },
            {
              id: 'actions',
              header: '',
              cell: (d) => (
                <ButtonDropdown
                  items={[{ id: 'edit', text: 'Modifier' }, { id: 'delete', text: 'Supprimer' }]}
                  onItemClick={({ detail: det }) => {
                    if (det.id === 'edit')   openEdit(d);
                    if (det.id === 'delete') handleDelete(d);
                  }}
                >
                  Actions
                </ButtonDropdown>
              ),
            },
          ]}
          empty={
            <Box textAlign="center" color="inherit">
              <b>Aucune définition</b>
              <Box padding={{ bottom: 's' }} variant="p">
                Créez les types officiels (ex: GMS, Distributeur, Importateur…)
              </Box>
              <Button variant="primary" onClick={openCreate}>+ Nouveau type</Button>
            </Box>
          }
        />
      </Container>

      {/* ── Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        header={editDef ? `Modifier — ${editDef.name}` : 'Nouveau type d\'acteur'}
        size="small"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>{editDef ? 'Enregistrer' : 'Créer'}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Nom *" description="Ex: Distributeur, GMS, Importateur">
            <Input value={form.name} onChange={({ detail }) => setForm({ ...form, name: detail.value })} placeholder="Distributeur" />
          </FormField>
          <FormField label="Type d'acteur concerné">
            <ColumnLayout columns={3}>
              {(['buyer', 'seller', 'delivery'] as const).map((t) => (
                <Button
                  key={t}
                  variant={form.org_type === t ? 'primary' : 'normal'}
                  onClick={() => setForm({ ...form, org_type: t })}
                >
                  {ORG_TYPE_LABEL[t]}
                </Button>
              ))}
            </ColumnLayout>
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={({ detail }) => setForm({ ...form, description: detail.value })} rows={2} />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
