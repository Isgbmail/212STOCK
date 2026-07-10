import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  Badge,
  StatusIndicator,
  TextFilter,
  Pagination,
  Box,
  Modal,
  Form,
  FormField,
  Input,
  Select,
  Textarea,
  Toggle,
  Link,
  Alert,
  ColumnLayout,
  ProgressBar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PRODUCT_STATUS_LABELS as STATUS_LABELS } from '../../lib/vendorUtils';
import type { Product } from '../../types';

export default function VendorCatalog() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Product[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageSize = 20;

  // New product form state
  const [form, setForm] = useState({
    name: '',
    short_description: '',
    ean: '',
    price: '',
    status: 'draft',
    moq: '1',
    currency: 'EUR',
    temperature: 'ambient',
    estimated_lead_days: '7',
  });

  async function fetchProducts() {
    if (!activeOrg) return;
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, price_tiers(*)', { count: 'exact' })
      .eq('seller_org_id', activeOrg.id)
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    if (filterText) {
      query = query.ilike('name', `%${filterText}%`);
    }

    const { data, count } = await query;
    setProducts((data as Product[]) ?? []);
    setTotalPages(Math.ceil((count ?? 0) / pageSize));
    setLoading(false);
  }

  useEffect(() => { fetchProducts(); }, [activeOrg, currentPage, filterText]);

  async function handleArchiveSelected() {
    if (!selectedItems.length) return;
    const ids = selectedItems.map((p) => p.id);
    await supabase.from('products').update({ status: 'archived' }).in('id', ids);
    setSelectedItems([]);
    fetchProducts();
  }

  async function handleCreate() {
    if (!activeOrg || !form.name) return;
    setSaving(true);
    setError('');
    setUploadProgress(0);
    try {
      const { data: newProduct, error: err } = await supabase.from('products').insert({
        seller_org_id: activeOrg.id,
        name: form.name,
        short_description: form.short_description || null,
        ean: form.ean || null,
        status: form.status,
        moq: parseInt(form.moq) || 1,
        currency: form.currency,
        temperature: form.temperature,
        estimated_lead_days: parseInt(form.estimated_lead_days) || 7,
      }).select('id').single();
      if (err) throw err;

      // Create initial price tier if price was provided
      const unitPrice = parseFloat(form.price);
      if (newProduct?.id && unitPrice > 0) {
        await supabase.from('price_tiers').insert({
          product_id: newProduct.id,
          qty_min:    parseInt(form.moq) || 1,
          unit_price: unitPrice,
          currency:   form.currency,
        });
      }

      // Upload images if any were selected
      if (imageFiles.length > 0 && newProduct?.id) {
        const urls: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const ext = file.name.split('.').pop();
          const path = `${activeOrg.id}/${newProduct.id}/${Date.now()}-${i}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(path, file, { upsert: true });
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
            urls.push(publicUrl);
          }
          setUploadProgress(Math.round(((i + 1) / imageFiles.length) * 100));
        }
        if (urls.length > 0) {
          await supabase.from('products').update({ images: urls }).eq('id', newProduct.id);
        }
      }

      setShowNewModal(false);
      setImageFiles([]);
      setUploadProgress(0);
      setForm({ name: '', short_description: '', ean: '', price: '', status: 'draft', moq: '1', currency: 'EUR', temperature: 'ambient', estimated_lead_days: '7' });
      fetchProducts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(product: Product) {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    await supabase.from('products').update({ status: newStatus }).eq('id', product.id);
    fetchProducts();
  }

  return (
    <SpaceBetween size="l">
      <Table
        header={
          <Header
            variant="h1"
            counter={`(${products.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={handleArchiveSelected}
                >
                  Archiver la sélection ({selectedItems.length})
                </Button>
                <Button variant="primary" onClick={() => setShowNewModal(true)}>
                  + Nouveau produit
                </Button>
              </SpaceBetween>
            }
          >
            Gestion du catalogue
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher par nom..."
            onChange={({ detail }) => { setFilterText(detail.filteringText); setCurrentPage(1); }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        loading={loading}
        loadingText="Chargement du catalogue..."
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems as Product[])}
        trackBy="id"
        items={products}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Produit',
            cell: (p: Product) => (
              <Link onFollow={() => navigate(`/vendor/catalog/${p.id}`)}>
                {p.name}
              </Link>
            ),
            sortingField: 'name',
            minWidth: 200,
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (p: Product) => {
              const typeMap: Record<string, 'success' | 'warning' | 'error' | 'stopped'> = {
                active: 'success', draft: 'warning', inactive: 'stopped', archived: 'error',
              };
              return (
                <StatusIndicator type={typeMap[p.status] ?? 'info'}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </StatusIndicator>
              );
            },
          },
          {
            id: 'moq',
            header: 'MOQ',
            cell: (p: Product) => p.moq,
          },
          {
            id: 'price',
            header: 'Prix de base',
            cell: (p: Product) => {
              const tier = p.price_tiers?.sort((a, b) => a.qty_min - b.qty_min)[0];
              return tier ? `${tier.unit_price.toFixed(2)} ${p.currency}` : '—';
            },
          },
          {
            id: 'stock',
            header: 'Stock',
            cell: (p: Product) => p.stock_qty != null ? p.stock_qty : '—',
          },
          {
            id: 'temperature',
            header: 'Conservation',
            cell: (p: Product) => (
              <Badge color={p.temperature === 'frozen' ? 'blue' : p.temperature === 'refrigerated' ? 'green' : 'grey'}>
                {p.temperature}
              </Badge>
            ),
          },
          {
            id: 'toggle',
            header: 'Activer',
            cell: (p: Product) => (
              <Toggle
                checked={p.status === 'active'}
                onChange={() => handleToggleStatus(p)}
              />
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (p: Product) => (
              <Button
                variant="inline-link"
                onClick={() => navigate(`/vendor/catalog/${p.id}`)}
              >
                Modifier
              </Button>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Catalogue vide</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Ajoutez votre premier produit pour commencer.
            </Box>
            <Button variant="primary" onClick={() => setShowNewModal(true)}>
              + Nouveau produit
            </Button>
          </Box>
        }
      />

      {/* New product modal */}
      <Modal
        visible={showNewModal}
        onDismiss={() => setShowNewModal(false)}
        header="Nouveau produit"
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowNewModal(false)}>Annuler</Button>
              <Button variant="primary" loading={saving} onClick={handleCreate}>
                Créer le produit
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form>
          {error && <Alert type="error" header="Erreur">{error}</Alert>}
          <SpaceBetween size="m">
            <FormField label="Nom du produit *" stretch>
              <Input
                value={form.name}
                onChange={({ detail }) => setForm({ ...form, name: detail.value })}
                placeholder="Ex: Café 500g Premium"
              />
            </FormField>
            <FormField label="Description courte" stretch>
              <Textarea
                value={form.short_description}
                onChange={({ detail }) => setForm({ ...form, short_description: detail.value })}
                placeholder="Description en quelques mots"
                rows={2}
              />
            </FormField>
            <ColumnLayout columns={2}>
              <FormField label="EAN / Code-barres" description="13 chiffres (GTIN-13)">
                <Input
                  value={form.ean}
                  onChange={({ detail }) => setForm({ ...form, ean: detail.value })}
                  placeholder="Ex: 3760123456789"
                />
              </FormField>
              <FormField label="Prix unitaire HT *" description="Premier palier = MOQ">
                <Input
                  type="number"
                  value={form.price}
                  onChange={({ detail }) => setForm({ ...form, price: detail.value })}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="MOQ (qté minimale)">
                <Input
                  type="number"
                  value={form.moq}
                  onChange={({ detail }) => setForm({ ...form, moq: detail.value })}
                />
              </FormField>
              <FormField label="Devise">
                <Select
                  selectedOption={{ value: form.currency, label: form.currency }}
                  onChange={({ detail }) => setForm({ ...form, currency: detail.selectedOption.value ?? 'EUR' })}
                  options={[
                    { value: 'EUR', label: 'EUR — Euro' },
                    { value: 'USD', label: 'USD — Dollar' },
                    { value: 'GBP', label: 'GBP — Livre sterling' },
                    { value: 'MAD', label: 'MAD — Dirham marocain' },
                  ]}
                />
              </FormField>
              <FormField label="Conservation">
                <Select
                  selectedOption={{ value: form.temperature, label: form.temperature }}
                  onChange={({ detail }) => setForm({ ...form, temperature: detail.selectedOption.value ?? 'ambient' })}
                  options={[
                    { value: 'ambient', label: 'Ambiant' },
                    { value: 'refrigerated', label: 'Réfrigéré' },
                    { value: 'fresh', label: 'Frais' },
                    { value: 'frozen', label: 'Surgelé' },
                  ]}
                />
              </FormField>
              <FormField label="Délai de livraison (jours)">
                <Input
                  type="number"
                  value={form.estimated_lead_days}
                  onChange={({ detail }) => setForm({ ...form, estimated_lead_days: detail.value })}
                />
              </FormField>
            </ColumnLayout>
            <FormField label="Images produit" description="JPEG, PNG ou WebP — max 5 Mo par image">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={e => setImageFiles(Array.from(e.target.files ?? []))}
              />
              <SpaceBetween size="xs">
                <Button
                  iconName="upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imageFiles.length > 0 ? `${imageFiles.length} image(s) sélectionnée(s)` : 'Sélectionner des images'}
                </Button>
                {imageFiles.length > 0 && (
                  <Box fontSize="xs" color="text-status-info">
                    {imageFiles.map(f => f.name).join(', ')}
                  </Box>
                )}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <ProgressBar value={uploadProgress} label="Upload en cours..." />
                )}
              </SpaceBetween>
            </FormField>
            <FormField label="Statut initial">
              <Select
                selectedOption={{ value: form.status, label: STATUS_LABELS[form.status] }}
                onChange={({ detail }) => setForm({ ...form, status: detail.selectedOption.value ?? 'draft' })}
                options={[
                  { value: 'draft', label: 'Brouillon' },
                  { value: 'active', label: 'Actif (visible dans le catalogue)' },
                ]}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>
    </SpaceBetween>
  );
}

