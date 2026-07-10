import { useEffect, useState } from 'react';
import {
  Cards, Header, Button, SpaceBetween, Badge, Box,
  Modal, Tabs, FormField, Input, Textarea, Select, Toggle,
  ColumnLayout, Alert, Multiselect, Flashbar, Spinner,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Brand {
  id: string; name: string; slug: string;
  logo?: string; initials: string; primary_color: string;
  tagline?: string; country: string; year: number;
  active: boolean; verified: boolean; featured: boolean;
  categories: string[]; certifications: string[];
  product_count: number;
  // Infos
  description_short: string; description_long: string;
  target_market: string; price_segment: string; values: string[];
  // Distribution
  channels: string[]; export_countries: string[];
  moq: string; payment_conditions: string;
  // SEO
  meta_title: string; meta_desc: string; keywords: string;
  visibility: 'public' | 'draft' | 'archived';
  // Contact
  website: string; email: string; phone: string;
  instagram: string; tiktok: string; facebook: string;
  linkedin: string; youtube: string;
  // Médias
  video_url: string; gallery: string[];
}


const CATS_OPTIONS = ['Laitiers', 'Épicerie', 'Boissons', 'Hygiène', 'Entretien', 'Frais', 'Surgelés', 'Conserves', 'Viandes', 'Desserts'].map((c) => ({ label: c, value: c }));
const CERTIF_OPTIONS = ['ONSSA', 'HACCP', 'Halal', 'Bio', 'ISO 22000', 'ECOCERT', 'Kosher'].map((c) => ({ label: c, value: c }));
const CHANNEL_OPTIONS = ['GMS', 'HORECA', 'Export', 'E-commerce', 'Collectivités', 'Pharmacie'].map((c) => ({ label: c, value: c }));
const COUNTRY_OPTIONS = ['France', 'Espagne', 'Belgique', 'Canada', 'Sénégal', 'Côte d\'Ivoire', 'Emirats'].map((c) => ({ label: c, value: c }));

// ── Helpers DB → Brand UI ─────────────────────────────────────────────────────
type DbBrand = {
  id: string; name: string; description: string | null; logo_url: string | null;
  initials: string | null; primary_color: string | null; tagline: string | null;
  country: string | null; founding_year: number | null;
  is_active: boolean | null; is_verified: boolean | null; is_featured: boolean | null;
  categories: string[] | null; certifications: string[] | null;
  target_market: string | null; price_segment: string | null;
  brand_values: string[] | null; channels: string[] | null; export_countries: string[] | null;
  moq: string | null; payment_conditions: string | null;
  meta_title: string | null; meta_desc: string | null; keywords: string | null;
  visibility: string | null; website: string | null; email: string | null;
  phone: string | null; instagram: string | null; tiktok: string | null;
  facebook: string | null; linkedin: string | null; youtube: string | null;
  video_url: string | null; gallery: string[] | null;
};

function dbToBrand(row: DbBrand, productCount: number): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.name.toLowerCase().replace(/\s+/g, '-'),
    initials: row.initials ?? row.name.substring(0, 2).toUpperCase(),
    primary_color: row.primary_color ?? '#1a5c8f',
    tagline: row.tagline ?? '',
    country: row.country ?? 'Maroc',
    year: row.founding_year ?? 2020,
    active: row.is_active ?? true,
    verified: row.is_verified ?? false,
    featured: row.is_featured ?? false,
    categories: row.categories ?? [],
    certifications: row.certifications ?? [],
    product_count: productCount,
    description_short: row.description ?? '',
    description_long: '',
    target_market: row.target_market ?? '',
    price_segment: row.price_segment ?? 'Moyen',
    values: row.brand_values ?? [],
    channels: row.channels ?? [],
    export_countries: row.export_countries ?? [],
    moq: row.moq ?? '',
    payment_conditions: row.payment_conditions ?? '',
    meta_title: row.meta_title ?? '',
    meta_desc: row.meta_desc ?? '',
    keywords: row.keywords ?? '',
    visibility: (row.visibility ?? 'public') as 'public' | 'draft' | 'archived',
    website: row.website ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    instagram: row.instagram ?? '',
    tiktok: row.tiktok ?? '',
    facebook: row.facebook ?? '',
    linkedin: row.linkedin ?? '',
    youtube: row.youtube ?? '',
    video_url: row.video_url ?? '',
    gallery: row.gallery ?? [],
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VendorBrands() {
  const { activeOrg } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string }[]>([]);

  function flash(type: 'success' | 'error', content: string) {
    setFlashItems([{ type, content }]);
    setTimeout(() => setFlashItems([]), 4000);
  }

  async function fetchBrands() {
    if (!activeOrg) return;
    setLoading(true);

    // Récupérer les brand_id distincts des produits du vendeur
    const { data: products } = await supabase
      .from('products')
      .select('brand_id')
      .eq('seller_org_id', activeOrg.id)
      .not('brand_id', 'is', null);

    const brandIds = [...new Set((products ?? []).map((p: { brand_id: string | null }) => p.brand_id).filter(Boolean))] as string[];

    if (brandIds.length === 0) {
      setBrands([]);
      setLoading(false);
      return;
    }

    // Compter les produits par brand
    const countMap: Record<string, number> = {};
    for (const id of brandIds) {
      countMap[id] = (products ?? []).filter((p: { brand_id: string | null }) => p.brand_id === id).length;
    }

    const { data: brandsData, error } = await supabase
      .from('brands')
      .select('id, name, description, logo_url, initials, primary_color, tagline, country, founding_year, is_active, is_verified, is_featured, categories, certifications, target_market, price_segment, brand_values, channels, export_countries, moq, payment_conditions, meta_title, meta_desc, keywords, visibility, website, email, phone, instagram, tiktok, facebook, linkedin, youtube, video_url, gallery')
      .in('id', brandIds);

    if (error) { flash('error', error.message); setLoading(false); return; }

    setBrands(((brandsData ?? []) as DbBrand[]).map((b) => dbToBrand(b, countMap[b.id] ?? 0)));
    setLoading(false);
  }

  useEffect(() => { fetchBrands(); }, [activeOrg]);

  function toggleActive(id: string) {
    setBrands((prev) => prev.map((b) => b.id === id ? { ...b, active: !b.active } : b));
  }

  async function saveBrand(brand: Brand) {
    setSaving(true);
    const { error } = await supabase.from('brands')
      .update({
        name: brand.name,
        description: brand.description_short,
        initials: brand.initials,
        primary_color: brand.primary_color,
        tagline: brand.tagline,
        country: brand.country,
        founding_year: brand.year,
        is_active: brand.active,
        is_verified: brand.verified,
        is_featured: brand.featured,
        categories: brand.categories,
        certifications: brand.certifications,
        target_market: brand.target_market,
        price_segment: brand.price_segment,
        brand_values: brand.values,
        channels: brand.channels,
        export_countries: brand.export_countries,
        moq: brand.moq,
        payment_conditions: brand.payment_conditions,
        meta_title: brand.meta_title,
        meta_desc: brand.meta_desc,
        keywords: brand.keywords,
        visibility: brand.visibility,
        website: brand.website,
        email: brand.email,
        phone: brand.phone,
        instagram: brand.instagram,
        tiktok: brand.tiktok,
        facebook: brand.facebook,
        linkedin: brand.linkedin,
        youtube: brand.youtube,
        video_url: brand.video_url,
        gallery: brand.gallery,
      })
      .eq('id', brand.id);
    setSaving(false);
    if (error) { flash('error', error.message); return; }
    setBrands((prev) => prev.map((b) => b.id === brand.id ? brand : b));
    setEditBrand(null);
    flash('success', `Marque ${brand.name} enregistrée.`);
  }

  function fb(field: keyof Brand, val: unknown) {
    if (!editBrand) return;
    setEditBrand({ ...editBrand, [field]: val } as Brand);
  }

  if (loading) {
    return <Box textAlign="center" padding="xl"><Spinner size="large" /></Box>;
  }

  return (
    <SpaceBetween size="l">
      {flashItems.length > 0 && (
        <Flashbar items={flashItems.map((f, i) => ({ ...f, id: String(i), dismissible: true, onDismiss: () => setFlashItems([]) }))} />
      )}

      <Header
        variant="h1"
        description="Marques liées à vos produits dans le catalogue"
        actions={<Button variant="primary" disabled>+ Nouvelle marque (bientôt)</Button>}
      >
        Mes marques
      </Header>

      <Cards
        items={brands}
        cardDefinition={{
          header: (brand) => (
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: brand.primary_color }}>
                {brand.name}
              </span>
              {brand.verified && <Badge color="green">Vérifié</Badge>}
              {brand.featured && <Badge color="blue">Vedette</Badge>}
            </SpaceBetween>
          ),
          sections: [
            {
              id: 'meta',
              content: (brand) => (
                <SpaceBetween size="xs">
                  <Box color="text-body-secondary">{brand.tagline}</Box>
                  <SpaceBetween direction="horizontal" size="xs">
                    {brand.categories.map((c) => <Badge key={c} color="grey">{c}</Badge>)}
                  </SpaceBetween>
                  <SpaceBetween direction="horizontal" size="xs">
                    {brand.certifications.map((c) => <Badge key={c} color="severity-medium">{c}</Badge>)}
                  </SpaceBetween>
                  <Box color="text-body-secondary">{brand.product_count} produits · {brand.country} · Depuis {brand.year}</Box>
                  <Toggle
                    checked={brand.active}
                    onChange={() => toggleActive(brand.id)}
                  >
                    {brand.active ? 'Marque active' : 'Marque inactive'}
                  </Toggle>
                  <Button variant="normal" onClick={() => setEditBrand(brand)}>
                    Modifier la fiche marque
                  </Button>
                </SpaceBetween>
              ),
            },
          ],
        }}
        empty={<Box>Aucune marque. Créez votre première marque.</Box>}
      />

      {/* ── MODAL ÉDITION MARQUE (7 onglets) ─────────────────────── */}
      {editBrand && (
        <Modal
          visible
          size="max"
          header={`Modifier — ${editBrand.name}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setEditBrand(null)}>Annuler</Button>
                <Button variant="primary" loading={saving} onClick={() => saveBrand(editBrand)}>Enregistrer</Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setEditBrand(null)}
        >
          <Tabs
            tabs={[
              // ── 1. Identité visuelle ───────────────────────────────
              {
                id: 'identity',
                label: 'Identité visuelle',
                content: (
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2}>
                      <FormField label="Nom de la marque *">
                        <Input value={editBrand.name} onChange={({ detail }) => fb('name', detail.value)} />
                      </FormField>
                      <FormField label="Slug URL (ex: copag)">
                        <Input value={editBrand.slug} onChange={({ detail }) => fb('slug', detail.value)} />
                      </FormField>
                      <FormField label="Initiales (si pas de logo)">
                        <Input value={editBrand.initials} onChange={({ detail }) => fb('initials', detail.value)} />
                      </FormField>
                      <FormField label="Couleur principale (hex)">
                        <Input value={editBrand.primary_color} onChange={({ detail }) => fb('primary_color', detail.value)} placeholder="#0d1f38" />
                      </FormField>
                    </ColumnLayout>
                    <ColumnLayout columns={3}>
                      <FormField label="Statut actif">
                        <Toggle checked={editBrand.active} onChange={({ detail }) => fb('active', detail.checked)}>Visible acheteurs</Toggle>
                      </FormField>
                      <FormField label="Vérifié">
                        <Toggle checked={editBrand.verified} onChange={({ detail }) => fb('verified', detail.checked)}>Badge vérifié</Toggle>
                      </FormField>
                      <FormField label="Marque vedette">
                        <Toggle checked={editBrand.featured} onChange={({ detail }) => fb('featured', detail.checked)}>Mise en avant</Toggle>
                      </FormField>
                    </ColumnLayout>
                    <Alert type="info">Le logo et la bannière peuvent être uploadés via la section Médias.</Alert>
                  </SpaceBetween>
                ),
              },

              // ── 2. Informations ───────────────────────────────────
              {
                id: 'info',
                label: 'Informations',
                content: (
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2}>
                      <FormField label="Slogan / Tagline">
                        <Input value={editBrand.tagline ?? ''} onChange={({ detail }) => fb('tagline', detail.value)} />
                      </FormField>
                      <FormField label="Pays d'origine">
                        <Input value={editBrand.country} onChange={({ detail }) => fb('country', detail.value)} />
                      </FormField>
                      <FormField label="Année de création">
                        <Input type="number" value={String(editBrand.year)} onChange={({ detail }) => fb('year', parseInt(detail.value))} />
                      </FormField>
                      <FormField label="Marché cible">
                        <Input value={editBrand.target_market} onChange={({ detail }) => fb('target_market', detail.value)} />
                      </FormField>
                      <FormField label="Segment prix">
                        <Select
                          selectedOption={{ label: editBrand.price_segment, value: editBrand.price_segment }}
                          options={['Accessible', 'Moyen', 'Premium', 'Luxe'].map((s) => ({ label: s, value: s }))}
                          onChange={({ detail }) => fb('price_segment', detail.selectedOption.value ?? '')}
                        />
                      </FormField>
                    </ColumnLayout>
                    <FormField label="Description courte">
                      <Textarea value={editBrand.description_short} onChange={({ detail }) => fb('description_short', detail.value)} rows={2} />
                    </FormField>
                    <FormField label="Description longue">
                      <Textarea value={editBrand.description_long} onChange={({ detail }) => fb('description_long', detail.value)} rows={5} />
                    </FormField>
                  </SpaceBetween>
                ),
              },

              // ── 3. Distribution ───────────────────────────────────
              {
                id: 'distrib',
                label: 'Distribution',
                content: (
                  <SpaceBetween size="m">
                    <FormField label="Canaux de distribution">
                      <Multiselect
                        selectedOptions={editBrand.channels.map((c) => ({ label: c, value: c }))}
                        options={CHANNEL_OPTIONS}
                        onChange={({ detail }) => fb('channels', detail.selectedOptions.map((o) => o.value ?? ''))}
                      />
                    </FormField>
                    <FormField label="Pays d'export">
                      <Multiselect
                        selectedOptions={editBrand.export_countries.map((c) => ({ label: c, value: c }))}
                        options={COUNTRY_OPTIONS}
                        onChange={({ detail }) => fb('export_countries', detail.selectedOptions.map((o) => o.value ?? ''))}
                      />
                    </FormField>
                    <ColumnLayout columns={2}>
                      <FormField label="MOQ (unités)">
                        <Input value={editBrand.moq} onChange={({ detail }) => fb('moq', detail.value)} />
                      </FormField>
                      <FormField label="Conditions de paiement">
                        <Input value={editBrand.payment_conditions} onChange={({ detail }) => fb('payment_conditions', detail.value)} />
                      </FormField>
                    </ColumnLayout>
                  </SpaceBetween>
                ),
              },

              // ── 4. SEO & Visibilité ───────────────────────────────
              {
                id: 'seo',
                label: 'SEO & Visibilité',
                content: (
                  <SpaceBetween size="m">
                    <FormField label="Meta title">
                      <Input value={editBrand.meta_title} onChange={({ detail }) => fb('meta_title', detail.value)} />
                    </FormField>
                    <FormField label="Meta description">
                      <Textarea value={editBrand.meta_desc} onChange={({ detail }) => fb('meta_desc', detail.value)} rows={2} />
                    </FormField>
                    <FormField label="Mots-clés (séparés par virgule)">
                      <Input value={editBrand.keywords} onChange={({ detail }) => fb('keywords', detail.value)} />
                    </FormField>
                    <FormField label="Visibilité">
                      <Select
                        selectedOption={
                          editBrand.visibility === 'public'   ? { label: 'Public', value: 'public' } :
                          editBrand.visibility === 'draft'    ? { label: 'Brouillon', value: 'draft' } :
                                                                 { label: 'Archivé', value: 'archived' }
                        }
                        options={[
                          { label: 'Public (visible catalogue)', value: 'public' },
                          { label: 'Brouillon (non visible)', value: 'draft' },
                          { label: 'Archivé', value: 'archived' },
                        ]}
                        onChange={({ detail }) => fb('visibility', detail.selectedOption.value)}
                      />
                    </FormField>
                  </SpaceBetween>
                ),
              },

              // ── 5. Contact & Réseaux ──────────────────────────────
              {
                id: 'contact',
                label: 'Contact & Réseaux',
                content: (
                  <ColumnLayout columns={2}>
                    <FormField label="Site web"><Input value={editBrand.website} onChange={({ detail }) => fb('website', detail.value)} /></FormField>
                    <FormField label="Email"><Input type="email" value={editBrand.email} onChange={({ detail }) => fb('email', detail.value)} /></FormField>
                    <FormField label="Téléphone"><Input value={editBrand.phone} onChange={({ detail }) => fb('phone', detail.value)} /></FormField>
                    <FormField label="Instagram"><Input value={editBrand.instagram} onChange={({ detail }) => fb('instagram', detail.value)} /></FormField>
                    <FormField label="TikTok"><Input value={editBrand.tiktok} onChange={({ detail }) => fb('tiktok', detail.value)} /></FormField>
                    <FormField label="Facebook"><Input value={editBrand.facebook} onChange={({ detail }) => fb('facebook', detail.value)} /></FormField>
                    <FormField label="LinkedIn"><Input value={editBrand.linkedin} onChange={({ detail }) => fb('linkedin', detail.value)} /></FormField>
                    <FormField label="YouTube"><Input value={editBrand.youtube} onChange={({ detail }) => fb('youtube', detail.value)} /></FormField>
                  </ColumnLayout>
                ),
              },

              // ── 6. Médias ─────────────────────────────────────────
              {
                id: 'media',
                label: 'Médias',
                content: (
                  <SpaceBetween size="m">
                    <FormField label="URL vidéo (YouTube / Vimeo)">
                      <Input value={editBrand.video_url} onChange={({ detail }) => fb('video_url', detail.value)} placeholder="https://youtube.com/watch?v=..." />
                    </FormField>
                    <Alert type="info">
                      Le logo, la bannière et la galerie photos seront uploadables lors de la prochaine mise à jour (stockage Supabase).
                    </Alert>
                  </SpaceBetween>
                ),
              },

              // ── 7. Catalogue ──────────────────────────────────────
              {
                id: 'catalogue',
                label: 'Catalogue',
                content: (
                  <SpaceBetween size="m">
                    <FormField label="Catégories FMCG couvertes">
                      <Multiselect
                        selectedOptions={editBrand.categories.map((c) => ({ label: c, value: c }))}
                        options={CATS_OPTIONS}
                        onChange={({ detail }) => fb('categories', detail.selectedOptions.map((o) => o.value ?? ''))}
                      />
                    </FormField>
                    <FormField label="Certifications">
                      <Multiselect
                        selectedOptions={editBrand.certifications.map((c) => ({ label: c, value: c }))}
                        options={CERTIF_OPTIONS}
                        onChange={({ detail }) => fb('certifications', detail.selectedOptions.map((o) => o.value ?? ''))}
                      />
                    </FormField>
                    <Box color="text-body-secondary">
                      {editBrand.product_count} produits liés à cette marque. Gérez-les depuis le catalogue produits.
                    </Box>
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </Modal>
      )}
    </SpaceBetween>
  );
}
