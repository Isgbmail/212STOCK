import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Box, Badge, StatusIndicator,
  TextFilter, Select, ColumnLayout, KeyValuePairs, Modal, Pagination,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

interface Supplier {
  id: string;
  name: string;
  sub_type: string | null;
  country: string;
  city: string | null;
  siret: string | null;
  vat_number: string | null;
  validation_status: string;
  created_at: string;
  product_count: number;
  order_count: number;
}

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]   = useState<Supplier | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  async function fetchSuppliers() {
    setLoading(true);
    let query = supabase
      .from('organisations')
      .select('id, name, sub_type, country, city, siret, vat_number, validation_status, created_at', { count: 'exact' })
      .eq('org_type', 'seller')
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    if (statusFilter) query = query.eq('validation_status', statusFilter);
    if (filterText)   query = query.ilike('name', `%${filterText}%`);

    const { data, count } = await query;
    const orgs = (data ?? []) as Array<{
      id: string; name: string; sub_type: string | null; country: string;
      city: string | null; siret: string | null; vat_number: string | null;
      validation_status: string; created_at: string;
    }>;

    // Count products & orders per supplier
    const ids = orgs.map((o) => o.id);
    const [prodRes, ordRes] = ids.length
      ? await Promise.all([
          supabase.from('products').select('seller_org_id').in('seller_org_id', ids).eq('status', 'active'),
          supabase.from('orders').select('seller_org_id').in('seller_org_id', ids),
        ])
      : [{ data: [] }, { data: [] }];

    const prodCount: Record<string, number> = {};
    const ordCount: Record<string, number>  = {};
    (prodRes.data ?? []).forEach((p: { seller_org_id: string }) => { prodCount[p.seller_org_id] = (prodCount[p.seller_org_id] ?? 0) + 1; });
    (ordRes.data ?? []).forEach((o: { seller_org_id: string }) => { ordCount[o.seller_org_id] = (ordCount[o.seller_org_id] ?? 0) + 1; });

    setSuppliers(orgs.map((o) => ({
      ...o,
      product_count: prodCount[o.id] ?? 0,
      order_count:   ordCount[o.id]  ?? 0,
    })));
    setTotalPages(Math.ceil((count ?? 0) / pageSize));
    setLoading(false);
  }

  useEffect(() => { fetchSuppliers(); }, [currentPage, statusFilter]);

  const statusType = (s: string): 'success' | 'warning' | 'stopped' => {
    if (s === 'active') return 'success';
    if (s === 'pending') return 'warning';
    return 'stopped';
  };

  return (
    <SpaceBetween size="l">
      <Table
        header={
          <Header
            variant="h1"
            counter={`(${suppliers.length})`}
            description="Toutes les organisations vendeurs/fournisseurs inscrits sur la plateforme."
          >
            Fournisseurs & Vendeurs
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Rechercher par nom…"
              onChange={({ detail }) => { setFilterText(detail.filteringText); setCurrentPage(1); }}
            />
            <Select
              selectedOption={{ value: statusFilter, label: statusFilter || 'Tous statuts' }}
              onChange={({ detail }) => { setStatusFilter(detail.selectedOption.value ?? ''); setCurrentPage(1); }}
              options={[
                { value: '', label: 'Tous statuts' },
                { value: 'active', label: 'Actifs' },
                { value: 'pending', label: 'En attente' },
                { value: 'rejected', label: 'Rejetés' },
              ]}
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        loading={loading}
        loadingText="Chargement des fournisseurs…"
        trackBy="id"
        items={suppliers}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Fournisseur',
            cell: (s) => <Box fontWeight="bold">{s.name}</Box>,
            sortingField: 'name',
            minWidth: 180,
          },
          {
            id: 'sub_type',
            header: 'Catégorie',
            cell: (s) => s.sub_type
              ? <Badge color="blue">{s.sub_type}</Badge>
              : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'country',
            header: 'Pays / Ville',
            cell: (s) => `${s.country}${s.city ? ` / ${s.city}` : ''}`,
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (s) => (
              <StatusIndicator type={statusType(s.validation_status)}>
                {{ active: 'Actif', pending: 'En attente', rejected: 'Rejeté' }[s.validation_status] ?? s.validation_status}
              </StatusIndicator>
            ),
          },
          {
            id: 'products',
            header: 'Produits actifs',
            cell: (s) => s.product_count,
            sortingField: 'product_count',
          },
          {
            id: 'orders',
            header: 'Commandes',
            cell: (s) => s.order_count,
            sortingField: 'order_count',
          },
          {
            id: 'created',
            header: 'Inscrit le',
            cell: (s) => new Date(s.created_at).toLocaleDateString('fr-FR'),
          },
          {
            id: 'actions',
            header: '',
            cell: (s) => (
              <Button variant="inline-link" onClick={() => setSelected(s)}>Détails</Button>
            ),
          },
        ]}
        empty={<Box textAlign="center" color="inherit"><b>Aucun fournisseur</b></Box>}
      />

      {selected && (
        <Modal
          visible
          onDismiss={() => setSelected(null)}
          header={selected.name}
          size="medium"
          footer={<Box float="right"><Button variant="link" onClick={() => setSelected(null)}>Fermer</Button></Box>}
        >
          <SpaceBetween size="m">
            <KeyValuePairs
              columns={3}
              items={[
                { label: 'Nom',        value: selected.name },
                { label: 'Sous-type',  value: selected.sub_type ?? '—' },
                { label: 'Pays',       value: selected.country },
                { label: 'Ville',      value: selected.city ?? '—' },
                { label: 'SIRET / RC', value: selected.siret ?? '—' },
                { label: 'TVA / ICE',  value: selected.vat_number ?? '—' },
                { label: 'Produits actifs', value: String(selected.product_count) },
                { label: 'Commandes',  value: String(selected.order_count) },
                { label: 'Inscrit le', value: new Date(selected.created_at).toLocaleDateString('fr-FR') },
              ]}
            />
            <ColumnLayout columns={3}>
              <StatusIndicator type={statusType(selected.validation_status)}>
                {{ active: 'Actif', pending: 'En attente', rejected: 'Rejeté' }[selected.validation_status] ?? selected.validation_status}
              </StatusIndicator>
            </ColumnLayout>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
