import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SpaceBetween, Header, Button, Box, Badge, Input, Select,
  FormField, Container, Spinner, Pagination, Checkbox,
  ExpandableSection, Alert, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CatalogProduct {
  id: string; name: string; ean: string | null;
  images: string[]; temperature: string; moq: number;
  is_new: boolean; is_on_promotion: boolean; is_sponsored: boolean;
  certifications: string[]; short_description: string | null;
  avg_rating: number; review_count: number; seller_org_id: string;
  organisations: { id: string; name: string } | null;
  categories: { id: string; name: string } | null;
  price_tiers: { qty_min: number; unit_price: number }[];
}
interface Category { id: string; name: string; parent_id: string | null }

const TEMP_OPTIONS = [
  { label: 'Ambiant',    value: 'ambient'      },
  { label: 'Réfrigéré', value: 'refrigerated'  },
  { label: 'Frais',     value: 'fresh'         },
  { label: 'Congelé',   value: 'frozen'        },
];
const CERTIF_OPTIONS = ['Halal', 'Bio', 'ISO 22000', 'ONSSA', 'HACCP', 'Vegan', 'Sans gluten'];
const SORT_OPTIONS = [
  { label: 'Pertinence',      value: 'relevance' },
  { label: 'Prix croissant',  value: 'price_asc' },
  { label: 'Prix décroissant',value: 'price_desc'},
  { label: 'Mieux notés',     value: 'rating'    },
  { label: 'Nouveautés',      value: 'newest'    },
];
const PAGE_SIZE = 24;

function tempLabel(t: string) {
  return t === 'ambient' ? '🌡 Ambiant' : t === 'refrigerated' ? '❄ Réfrigéré'
       : t === 'frozen'  ? '🧊 Congelé' : '🌿 Frais';
}
function tempColor(t: string): React.CSSProperties['color'] {
  return t === 'ambient' ? '#854d0e' : t === 'refrigerated' ? '#075985'
       : t === 'frozen'  ? '#1e3a5f' : '#166534';
}
function basePrice(tiers: { qty_min: number; unit_price: number }[]) {
  if (!tiers?.length) return null;
  return [...tiers].sort((a, b) => a.qty_min - b.qty_min)[0].unit_price;
}
function starRating(avg: number) {
  return '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
}

export default function BuyerCatalog() {
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading,    setLoading]    = useState(true);
  const [products,   setProducts]   = useState<CatalogProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartMsg,    setCartMsg]    = useState('');

  // Filters
  const [search,        setSearch]        = useState(searchParams.get('q') ?? '');
  const [categoryId,    setCategoryId]    = useState(searchParams.get('cat') ?? '');
  const [temperatures,  setTemperatures]  = useState<string[]>([]);
  const [certifications,setCertifications]= useState<string[]>([]);
  const [onlyPromo,     setOnlyPromo]     = useState(false);
  const [onlyNew,       setOnlyNew]       = useState(false);
  const [sort,          setSort]          = useState('relevance');
  const [page,          setPage]          = useState(1);

  // Compare
  const [compareList, setCompareList] = useState<CatalogProduct[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadCategories(); }, []);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, temperatures, certifications, onlyPromo, onlyNew, sort]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(loadProducts, search ? 350 : 0);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, temperatures, certifications, onlyPromo, onlyNew, sort, page]);

  async function loadCategories() {
    const { data } = await supabase
      .from('categories').select('id, name, parent_id')
      .order('name');
    setCategories((data ?? []) as Category[]);
  }

  async function loadProducts() {
    setLoading(true);
    let q = supabase
      .from('products')
      .select(`id, name, ean, images, temperature, moq,
        is_new, is_on_promotion, is_sponsored,
        certifications, short_description, avg_rating, review_count, seller_org_id,
        organisations!seller_org_id (id, name),
        categories (id, name),
        price_tiers (qty_min, unit_price)`, { count: 'exact' })
      .eq('status', 'active');

    if (search.trim())         q = q.ilike('name', `%${search.trim()}%`);
    if (categoryId)            q = q.eq('category_id', categoryId);
    if (temperatures.length)   q = q.in('temperature', temperatures);
    if (onlyPromo)             q = q.eq('is_on_promotion', true);
    if (onlyNew)               q = q.eq('is_new', true);

    if      (sort === 'rating')     q = q.order('avg_rating',    { ascending: false });
    else if (sort === 'newest')     q = q.order('created_at',    { ascending: false });
    else                            q = q.order('is_sponsored',  { ascending: false })
                                        .order('is_new',         { ascending: false });

    q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, count } = await q;

    let list = (data ?? []) as CatalogProduct[];

    // Client-side price sort (requires price_tiers data)
    if (sort === 'price_asc')  list = list.sort((a, b) => (basePrice(a.price_tiers) ?? 99999) - (basePrice(b.price_tiers) ?? 99999));
    if (sort === 'price_desc') list = list.sort((a, b) => (basePrice(b.price_tiers) ?? 0) - (basePrice(a.price_tiers) ?? 0));

    setProducts(list);
    setTotalCount(count ?? 0);
    setLoading(false);
  }

  async function addToCart(product: CatalogProduct) {
    if (!activeOrg) return;
    const price = basePrice(product.price_tiers);
    if (!price) return;
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('buyer_org_id', activeOrg.id)
      .eq('product_id', product.id)
      .is('cart_id', null)
      .maybeSingle();

    if (existing) {
      await supabase.from('cart_items')
        .update({ quantity: existing.quantity + product.moq })
        .eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({
        buyer_org_id: activeOrg.id,
        product_id: product.id,
        quantity: product.moq,
        unit_price: price,
        cart_id: null,
      });
    }
    setCartMsg(`${product.name.slice(0, 30)} ajouté au panier`);
    setTimeout(() => setCartMsg(''), 3000);
  }

  function toggleCompare(p: CatalogProduct) {
    setCompareList(prev =>
      prev.find(c => c.id === p.id)
        ? prev.filter(c => c.id !== p.id)
        : prev.length >= 4 ? prev : [...prev, p],
    );
  }

  function toggleTemp(v: string) {
    setTemperatures(prev => prev.includes(v) ? prev.filter(t => t !== v) : [...prev, v]);
  }
  function toggleCertif(v: string) {
    setCertifications(prev => prev.includes(v) ? prev.filter(c => c !== v) : [...prev, v]);
  }

  const roots = categories.filter(c => !c.parent_id);
  const children = (pid: string) => categories.filter(c => c.parent_id === pid);

  return (
    <SpaceBetween size="m">
      {cartMsg && (
        <Flashbar items={[{ type: 'success', content: cartMsg, dismissible: true, onDismiss: () => setCartMsg('') }]} />
      )}

      <Header
        variant="h1"
        description={`${totalCount} produit${totalCount !== 1 ? 's' : ''} disponible${totalCount !== 1 ? 's' : ''}`}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate('/buyer/destockage')} iconName="remove">Déstockage</Button>
            <Button onClick={() => navigate('/buyer/compare')} iconName="search">Comparateur</Button>
            <Button variant="primary" onClick={() => navigate('/buyer/optimizer')} iconName="settings">Optimiseur</Button>
          </SpaceBetween>
        }
      >
        Catalogue
      </Header>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <SpaceBetween size="s">
            {/* Catégories */}
            <Container>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Catégories</Box>
                <div
                  onClick={() => setCategoryId('')}
                  style={{ cursor: 'pointer', fontWeight: !categoryId ? 700 : 400,
                    color: !categoryId ? '#0972d3' : '#0f1b2d', fontSize: 13 }}
                >
                  Toutes
                </div>
                {roots.map(root => (
                  <ExpandableSection
                    key={root.id}
                    headerText={root.name}
                    variant="footer"
                    defaultExpanded={categoryId === root.id || children(root.id).some(c => c.id === categoryId)}
                  >
                    <SpaceBetween size="xxs">
                      <div onClick={() => setCategoryId(root.id)}
                        style={{ cursor: 'pointer', fontWeight: categoryId === root.id ? 700 : 400,
                          color: categoryId === root.id ? '#0972d3' : '#5f6b7a', fontSize: 13, paddingLeft: 4 }}>
                        Tous — {root.name}
                      </div>
                      {children(root.id).map(child => (
                        <div key={child.id} onClick={() => setCategoryId(child.id)}
                          style={{ cursor: 'pointer', fontWeight: categoryId === child.id ? 700 : 400,
                            color: categoryId === child.id ? '#0972d3' : '#5f6b7a', fontSize: 13, paddingLeft: 12 }}>
                          {child.name}
                        </div>
                      ))}
                    </SpaceBetween>
                  </ExpandableSection>
                ))}
              </SpaceBetween>
            </Container>

            {/* Conservation */}
            <Container>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Conservation</Box>
                {TEMP_OPTIONS.map(opt => (
                  <Checkbox key={opt.value} checked={temperatures.includes(opt.value)}
                    onChange={() => toggleTemp(opt.value)}>{opt.label}</Checkbox>
                ))}
              </SpaceBetween>
            </Container>

            {/* Certifications */}
            <Container>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Certifications</Box>
                {CERTIF_OPTIONS.map(c => (
                  <Checkbox key={c} checked={certifications.includes(c)}
                    onChange={() => toggleCertif(c)}>{c}</Checkbox>
                ))}
              </SpaceBetween>
            </Container>

            {/* Flags */}
            <Container>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Filtres rapides</Box>
                <Checkbox checked={onlyPromo} onChange={({ detail }) => setOnlyPromo(detail.checked)}>
                  En promotion
                </Checkbox>
                <Checkbox checked={onlyNew} onChange={({ detail }) => setOnlyNew(detail.checked)}>
                  Nouveautés
                </Checkbox>
              </SpaceBetween>
            </Container>

            {(categoryId || temperatures.length > 0 || certifications.length > 0 || onlyPromo || onlyNew) && (
              <Button variant="link" onClick={() => {
                setCategoryId(''); setTemperatures([]); setCertifications([]);
                setOnlyPromo(false); setOnlyNew(false);
              }}>
                Effacer tous les filtres
              </Button>
            )}
          </SpaceBetween>
        </div>

        {/* ── Main ────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SpaceBetween size="m">
            {/* Search + sort bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Input value={search} type="search"
                  onChange={({ detail }) => setSearch(detail.value)}
                  placeholder="Nom du produit, EAN, marque…" />
              </div>
              <div style={{ width: 200 }}>
                <Select
                  selectedOption={SORT_OPTIONS.find(o => o.value === sort) ?? SORT_OPTIONS[0]}
                  options={SORT_OPTIONS}
                  onChange={({ detail }) => setSort(detail.selectedOption.value ?? 'relevance')}
                />
              </div>
            </div>

            {/* Compare bar */}
            {compareList.length > 0 && (
              <Alert
                type="info"
                header={`${compareList.length} produit${compareList.length > 1 ? 's' : ''} sélectionné${compareList.length > 1 ? 's' : ''} pour comparaison`}
                action={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/buyer/compare?ids=${compareList.map(p => p.id).join(',')}`)}
                    >
                      Comparer les prix
                    </Button>
                    <Button onClick={() => setCompareList([])}>Effacer</Button>
                  </SpaceBetween>
                }
              >
                {compareList.map(p => p.name).join(' · ')}
              </Alert>
            )}

            {/* Grid */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <Spinner size="large" />
              </div>
            ) : products.length === 0 ? (
              <Box textAlign="center" color="text-body-secondary" padding="xxxl">
                Aucun produit pour ces critères.
              </Box>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 16,
              }}>
                {products.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isComparing={compareList.some(c => c.id === p.id)}
                    onCompare={() => toggleCompare(p)}
                    onAddToCart={() => addToCart(p)}
                    onView={() => navigate(`/buyer/compare?ean=${p.ean ?? p.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalCount > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  currentPageIndex={page}
                  pagesCount={Math.ceil(totalCount / PAGE_SIZE)}
                  onChange={({ detail }) => setPage(detail.currentPageIndex)}
                />
              </div>
            )}
          </SpaceBetween>
        </div>
      </div>
    </SpaceBetween>
  );
}

// ── Product card ────────────────────────────────────────────────────────────
function ProductCard({
  product, isComparing, onCompare, onAddToCart, onView,
}: {
  product: CatalogProduct;
  isComparing: boolean;
  onCompare: () => void;
  onAddToCart: () => void;
  onView: () => void;
}) {
  const price = basePrice(product.price_tiers);
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `2px solid ${isComparing ? '#0972d3' : hover ? '#d1d5db' : '#e5e7eb'}`,
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', background: '#f8f9fa', height: 160, overflow: 'hidden' }}>
        {product.images?.[0]
          ? <img src={product.images[0]} alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 36, color: '#d1d5db' }}>📦</div>
        }
        {/* Badges overlay */}
        <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {product.is_sponsored && <span style={{ background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>SPONSORISÉ</span>}
          {product.is_new && <span style={{ background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>NOUVEAU</span>}
          {product.is_on_promotion && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>PROMO</span>}
        </div>
        {/* Temperature */}
        <div style={{ position: 'absolute', top: 6, right: 6, background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 4, fontSize: 10, fontWeight: 600, padding: '2px 6px', color: tempColor(product.temperature) }}>
          {tempLabel(product.temperature)}
        </div>
        {/* Compare checkbox */}
        <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onCompare(); }}
            style={{
              background: isComparing ? '#0972d3' : '#fff',
              color: isComparing ? '#fff' : '#5f6b7a',
              border: `1px solid ${isComparing ? '#0972d3' : '#d1d5db'}`,
              borderRadius: 4, fontSize: 10, fontWeight: 600,
              padding: '3px 7px', cursor: 'pointer',
            }}
          >
            {isComparing ? '✓ Comparé' : '⊕ Comparer'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Vendor */}
        <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, textTransform: 'uppercase' }}>
          {product.organisations?.name ?? '—'}
        </div>
        {/* Name */}
        <div
          onClick={onView}
          style={{ fontSize: 13, fontWeight: 700, color: '#0f1b2d', lineHeight: 1.3,
            cursor: 'pointer', display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {product.name}
        </div>
        {/* Rating */}
        {product.review_count > 0 && (
          <div style={{ fontSize: 11, color: '#d97706' }}>
            {starRating(product.avg_rating)} <span style={{ color: '#6b7280' }}>({product.review_count})</span>
          </div>
        )}
        {/* Certifications */}
        {product.certifications?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {product.certifications.slice(0, 3).map(c => (
              <span key={c} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                borderRadius: 3, fontSize: 10, fontWeight: 600, padding: '1px 5px' }}>{c}</span>
            ))}
          </div>
        )}
        {/* MOQ + Price */}
        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
          {price != null ? (
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1b2d' }}>
                {price.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                à partir de {product.moq} unité{product.moq > 1 ? 's' : ''}
                {product.price_tiers.length > 1 && ` · ${product.price_tiers.length} paliers`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>Sur devis</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 6 }}>
        <button
          onClick={onAddToCart}
          disabled={!price}
          style={{
            flex: 1, background: price ? '#0972d3' : '#e5e7eb',
            color: price ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: 6, padding: '7px 0',
            fontWeight: 700, fontSize: 12, cursor: price ? 'pointer' : 'not-allowed',
          }}
        >
          + Ajouter au panier
        </button>
        <button
          onClick={onView}
          style={{
            background: '#f3f4f6', border: 'none', borderRadius: 6,
            padding: '7px 10px', fontWeight: 600, fontSize: 12, cursor: 'pointer', color: '#374151',
          }}
        >
          ≡
        </button>
      </div>
    </div>
  );
}
