import { useEffect, useState } from 'react';
import {
  Table, Header, SpaceBetween, Box,
  TextFilter, Select, Badge, Alert,
  Modal, KeyValuePairs,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

const ENTITY_OPTIONS = [
  { label: 'Toutes entités', value: '' },
  { label: 'Produit',       value: 'product'      },
  { label: 'Commande',      value: 'order'        },
  { label: 'Organisation',  value: 'organisation' },
  { label: 'Profil',        value: 'profile'      },
  { label: 'Litige',        value: 'dispute'      },
  { label: 'Prix',          value: 'price_tier'   },
];

const entityBadge = (entity: string): 'blue' | 'green' | 'red' | 'grey' | 'severity-medium' => ({
  product:      'green',
  order:        'blue',
  organisation: 'severity-medium',
  profile:      'grey',
  dispute:      'red',
  price_tier:   'green',
} as Record<string, 'blue' | 'green' | 'red' | 'grey' | 'severity-medium'>)[entity] ?? 'grey';

export default function AdminAuditLogs() {
  const [logs,        setLogs]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterText,  setFilterText]  = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selected,    setSelected]    = useState<any | null>(null);
  const [error,       setError]       = useState('');

  useEffect(() => { loadLogs(); }, [entityFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      let q = supabase
        .from('audit_logs')
        .select('*, profiles!user_id(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (entityFilter) q = q.eq('entity_type', entityFilter);

      const { data, error: err } = await q;
      if (err) {
        // Table might not exist yet — show graceful fallback
        if (err.code === '42P01') {
          setError('La table audit_logs n\'existe pas encore. Elle sera créée automatiquement lors des prochaines actions.');
          setLogs([]);
        } else {
          setError(err.message);
        }
      } else {
        setLogs((data as any[]) ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    }
    setLoading(false);
  }

  const filtered = logs.filter((l) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.entity_type?.toLowerCase().includes(q) ||
      l.entity_id?.toLowerCase().includes(q) ||
      l.profiles?.full_name?.toLowerCase().includes(q) ||
      l.profiles?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <SpaceBetween size="l">
      <Header variant="h1" description="Traçabilité complète des actions effectuées sur la plateforme">
        Journal d'audit
      </Header>

      {error && (
        <Alert type="info" dismissible onDismiss={() => setError('')}>{error}</Alert>
      )}

      <Table
        header={
          <Header
            variant="h2"
            counter={`(${filtered.length})`}
            actions={
              <Select
                selectedOption={ENTITY_OPTIONS.find((o) => o.value === entityFilter) ?? ENTITY_OPTIONS[0]}
                options={ENTITY_OPTIONS}
                onChange={({ detail }) => setEntityFilter(detail.selectedOption.value ?? '')}
              />
            }
          >
            Entrées d'audit (500 dernières)
          </Header>
        }
        loading={loading}
        loadingText="Chargement du journal…"
        trackBy="id"
        items={filtered}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher par action, entité, utilisateur…"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        onRowClick={({ detail }) => setSelected(detail.item)}
        columnDefinitions={[
          {
            id: 'timestamp',
            header: 'Date / Heure',
            cell: (l) => (
              <Box fontSize="body-s" color="text-body-secondary">
                {new Date(l.created_at).toLocaleString('fr-FR')}
              </Box>
            ),
          },
          {
            id: 'user',
            header: 'Acteur',
            cell: (l) => (
              <SpaceBetween size="xxs">
                <Box fontWeight="bold" fontSize="body-s">{l.profiles?.full_name ?? 'Système'}</Box>
                <Box color="text-body-secondary" fontSize="body-s">{l.profiles?.email ?? l.user_id ?? '—'}</Box>
              </SpaceBetween>
            ),
          },
          {
            id: 'action',
            header: 'Action',
            cell: (l) => <Box fontWeight="bold">{l.action ?? '—'}</Box>,
          },
          {
            id: 'entity_type',
            header: 'Entité',
            cell: (l) => l.entity_type
              ? <Badge color={entityBadge(l.entity_type)}>{l.entity_type}</Badge>
              : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'entity_id',
            header: 'ID Entité',
            cell: (l) => (
              <Box fontSize="body-s" color="text-body-secondary">
                {l.entity_id ? l.entity_id.slice(0, 8) + '…' : '—'}
              </Box>
            ),
          },
          {
            id: 'ip',
            header: 'IP',
            cell: (l) => (
              <Box fontSize="body-s" color="text-body-secondary">{l.ip_address ?? '—'}</Box>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="xl">
            <b>Aucune entrée d'audit</b>
            <Box color="text-body-secondary">Les actions seront enregistrées automatiquement.</Box>
          </Box>
        }
      />

      {/* ── Log Detail Modal ──────────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        onDismiss={() => setSelected(null)}
        header="Détail de l'entrée d'audit"
      >
        {selected && (
          <SpaceBetween size="m">
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Acteur',      value: selected.profiles?.full_name ?? selected.user_id ?? 'Système' },
                { label: 'Email',       value: selected.profiles?.email ?? '—'   },
                { label: 'Action',      value: selected.action ?? '—'            },
                { label: 'Entité',      value: selected.entity_type ?? '—'       },
                { label: 'ID Entité',   value: selected.entity_id ?? '—'         },
                { label: 'IP',          value: selected.ip_address ?? '—'        },
                { label: 'Date / Heure', value: new Date(selected.created_at).toLocaleString('fr-FR') },
              ]}
            />
            {selected.details && (
              <Box>
                <Box fontWeight="bold" margin={{ bottom: 'xs' }}>Détails JSON</Box>
                <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '4px', fontSize: '12px', overflow: 'auto', maxHeight: '300px' }}>
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </Box>
            )}
          </SpaceBetween>
        )}
      </Modal>
    </SpaceBetween>
  );
}
