import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Tabs, Header, Button, SpaceBetween, Box,
  FormField, Input, Autosuggest, Textarea, Select, Toggle,
  ColumnLayout, Container, Alert, Badge,
  Multiselect, Spinner, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { ProductDocument } from '../../types/index';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EanRefData {
  id: string; ean: string; name: string;
  short_description: string | null; images: string[];
  category_id: string | null; brand_id: string | null;
  temperature: string; physical_form: string | null;
  net_weight: number | null; weight_unit: string | null;
  certifications: string[]; allergens: string[];
  nutri_score: string | null; pack_size: number;
  shelf_life_days: number | null; origin_country: string | null;
  hs_code: string | null; packaging_type: string | null;
  manufacturer_name: string | null;
}

interface PriceTier { qty_min: number; unit_price: number }
interface Variant { id: string; label: string; ean: string; colisage: number; stock: number }

type DocType = 'datasheet' | 'certificate' | 'logistics' | 'fds' | 'other';
interface ProductDoc { id: string; name: string; url: string; type: DocType }

const DOC_TYPE_OPTIONS: { label: string; value: DocType }[] = [
  { label: 'Fiche technique',   value: 'datasheet'   },
  { label: 'Certificat',        value: 'certificate' },
  { label: 'Fiche logistique',  value: 'logistics'   },
  { label: 'FDS',               value: 'fds'         },
  { label: 'Autre',             value: 'other'       },
];

const CERTIF_OPTIONS = ['Halal', 'Bio', 'ISO 22000', 'ONSSA', 'HACCP', 'ECOCERT', 'Nutri-Score A'].map((c) => ({ label: c, value: c }));
const ALLERGEN_LIST  = ['Lait', 'Gluten', 'Arachides', 'Œufs', 'Poisson', 'Crustacés', 'Soja', 'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Lupin', 'Mollusques', 'SO₂'];

const DELIVERY_METHODS_OPTIONS = [
  { label: 'Livraison directe',       value: 'livraison_directe'  },
  { label: 'Enlèvement entrepôt',     value: 'enlevement'         },
  { label: 'Froid Express',           value: 'cold_chain_express' },
  { label: 'Transporteur partenaire', value: 'carrier'            },
  { label: 'Express J+1',             value: 'express'            },
];

const INCOTERM_OPTIONS = [
  { label: 'EXW — Départ usine',           value: 'EXW' },
  { label: 'FOB — Franco à bord',          value: 'FOB' },
  { label: 'CIF — Coût, assurance, fret',  value: 'CIF' },
  { label: 'DAP — Rendu au lieu',          value: 'DAP' },
  { label: 'DDP — Rendu droits acquittés', value: 'DDP' },
];

const DISTRIBUTION_CH_OPTIONS = [
  { label: 'Grande distribution (GMS)',   value: 'supermarket' },
  { label: 'HoReCa',                      value: 'horeca'      },
  { label: 'Pharmacie / parapharmacie',   value: 'pharmacy'    },
  { label: 'E-commerce',                  value: 'ecommerce'   },
  { label: 'Grossiste',                   value: 'wholesale'   },
  { label: 'Épicerie fine / spécialisée', value: 'specialty'   },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FicheProduitEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  // ── Recherche catalogue (par nom, étape 1 création) ─────────────────────
  const [catalogSearch, setCatalogSearch]         = useState('');
  const [catalogSuggestions, setCatalogSuggestions] = useState<EanRefData[]>([]);
  const [catalogSearching, setCatalogSearching]   = useState(false);
  const catalogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lookup EAN (onglet 1, secondaire) ───────────────────────────────────
  const [eanRef, setEanRef]                   = useState<EanRefData | null>(null);
  const [eanStatus, setEanStatus]             = useState<'idle' | 'found' | 'not_found' | 'searching'>('idle');
  const [eanSuggestions, setEanSuggestions]   = useState<EanRefData[]>([]);
  const [eanLinkedRefId, setEanLinkedRefId]   = useState<string | null>(null);
  const eanTimerRef                           = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Produit ───────────────────────────────────────────────────────────
  const [product, setProduct] = useState({
    name: '', ean: '', hs_code: '', brand: '', description: '', long_description: '',
    category: '', temperature: 'ambient', moq: '1', colisage: '12',
    net_weight: '', gross_weight: '', weight_unit: 'kg',
    physical_form: '' as 'liquid' | 'solid' | 'powder' | 'gel' | 'aerosol' | 'cream' | 'tablet' | 'other' | '',
  });

  // ── 2. Tarification ──────────────────────────────────────────────────────
  const [tiers, setTiers]             = useState<PriceTier[]>([{ qty_min: 1, unit_price: 0 }]);
  const [certifications, setCertifications] = useState<string[]>([]);

  // ── 3. Fiche produit ─────────────────────────────────────────────────────
  const [nutrition, setNutrition] = useState({
    kcal: '', proteins: '', carbs: '', fat: '', salt: '', fiber: '',
    net_weight: '', nutriscore: 'C', dlc_type: 'DDM',
    origin_country: '', ingredients: '', additives: '',
  });
  const [allergens, setAllergens] = useState<string[]>([]);

  // ── 4. Emballage ─────────────────────────────────────────────────────────
  const [packaging, setPackaging] = useState({
    packaging_type: '', packaging_material: '', units_per_inner: '',
    recyclable: false, eco_score: '',
    dim_l: '', dim_w: '', dim_h: '', dim_weight: '',
    incoterms: [] as string[],
  });

  // ── 5. Logistique ────────────────────────────────────────────────────────
  const [logistics, setLogistics] = useState({
    volume_cbm_carton: '', pallet_weight_kg: '', stackability_max: '',
    fragility_level: '' as 'low' | 'medium' | 'high' | '',
    hazard_class: '', shelf_life_days: '', after_opening_days: '',
    min_shelf_temp: '', max_shelf_temp: '',
    fifo_required: false, humidity_sensitive: false, light_sensitive: false,
    delivery_methods: [] as string[],
  });

  // ── 6. Variantes ─────────────────────────────────────────────────────────
  const [variants, setVariants] = useState<Variant[]>([]);

  // ── 7. Médias ────────────────────────────────────────────────────────────
  const [mediaVideo, setMediaVideo] = useState('');

  // ── 8. Visibilité ────────────────────────────────────────────────────────
  const [visibility, setVisibility] = useState({
    active: true, sponsored: false, is_new: true, is_promo: false,
  });

  // ── 9. Fabricant & Qualité ───────────────────────────────────────────────
  const [manufacturer, setManufacturer] = useState({
    manufacturer_name: '', manufacturer_country: '',
    production_method: '' as 'industrial' | 'artisanal' | 'hybrid' | '',
    traceability_level: '' as 'lot' | 'ean' | 'serial' | '',
    haccp_compliant: false, msds_available: false,
  });

  // ── 10. Commerce & Marché ────────────────────────────────────────────────
  const [commerce, setCommerce] = useState({
    distribution_channels: [] as string[],
    exclusive_dist: false, territory_allocation: '',
    target_segment: '', usp: '',
    value_proposition: '' as 'price' | 'quality' | 'eco' | 'luxury' | 'professional' | '',
  });

  // ── 11. Documents ────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<ProductDoc[]>([]);
  const [newDoc, setNewDoc] = useState<Omit<ProductDoc, 'id'>>({ name: '', url: '', type: 'datasheet' });

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => { if (!isNew && id) loadProduct(id); }, [id, isNew]);

  async function loadProduct(productId: string) {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('products')
      .select('*, price_tiers(*)')
      .eq('id', productId)
      .single();

    if (err || !data) { setError('Produit introuvable.'); setLoading(false); return; }

    setProduct({
      name:             data.name             ?? '',
      ean:              data.ean              ?? '',
      hs_code:          data.hs_code          ?? '',
      brand:            data.brand_id         ?? '',
      description:      data.short_description ?? '',
      long_description: data.long_description  ?? '',
      category:         data.category_id      ?? '',
      temperature:      data.temperature       ?? 'ambient',
      moq:              String(data.moq        ?? 1),
      colisage:         String(data.pack_size  ?? 12),
      net_weight:       String(data.net_weight  ?? ''),
      gross_weight:     String(data.gross_weight ?? ''),
      weight_unit:      data.weight_unit       ?? 'kg',
      physical_form:    data.physical_form     ?? '',
    });

    setPackaging({
      packaging_type:     data.packaging_type     ?? '',
      packaging_material: data.packaging_material ?? '',
      units_per_inner:    String(data.units_per_inner ?? ''),
      recyclable:         data.recyclable          ?? false,
      eco_score:          data.eco_score           ?? '',
      dim_l:    String(data.dimensions_unit?.length      ?? ''),
      dim_w:    String(data.dimensions_unit?.width       ?? ''),
      dim_h:    String(data.dimensions_unit?.height      ?? ''),
      dim_weight: String(data.dimensions_unit?.weight_brut ?? ''),
      incoterms: data.incoterms ?? [],
    });

    setLogistics({
      volume_cbm_carton:  String(data.volume_cbm_carton  ?? ''),
      pallet_weight_kg:   String(data.pallet_weight_kg   ?? ''),
      stackability_max:   String(data.stackability_max   ?? ''),
      fragility_level:    data.fragility_level           ?? '',
      hazard_class:       data.hazard_class              ?? '',
      shelf_life_days:    String(data.shelf_life_days    ?? ''),
      after_opening_days: String(data.after_opening_days ?? ''),
      min_shelf_temp:     String(data.min_shelf_temp     ?? ''),
      max_shelf_temp:     String(data.max_shelf_temp     ?? ''),
      fifo_required:      data.fifo_required             ?? false,
      humidity_sensitive: data.humidity_sensitive        ?? false,
      light_sensitive:    data.light_sensitive           ?? false,
      delivery_methods:   data.delivery_methods          ?? [],
    });

    if (data.price_tiers?.length) {
      setTiers(data.price_tiers.map((t: { qty_min: number; unit_price: number }) => ({ qty_min: t.qty_min, unit_price: t.unit_price })));
    }
    if (data.certifications?.length) setCertifications(data.certifications);
    if (data.allergens?.length)      setAllergens(data.allergens);

    const nv = data.nutritional_values ?? {};
    setNutrition({
      kcal:           String(nv.energy_kcal  ?? ''),
      proteins:       String(nv.protein_g    ?? ''),
      carbs:          String(nv.carbs_g      ?? ''),
      fat:            String(nv.fat_g        ?? ''),
      salt:           String(nv.salt_g       ?? ''),
      fiber:          String(nv.fiber_g      ?? ''),
      net_weight:     String(nv.net_weight_g ?? ''),
      nutriscore:     data.nutri_score        ?? 'C',
      dlc_type:       data.dlc_type           ?? 'DDM',
      origin_country: data.origin_country     ?? '',
      ingredients:    data.ingredients        ?? '',
      additives:      '',
    });

    setVisibility({
      active:    data.status           === 'active',
      sponsored: data.is_sponsored     ?? false,
      is_new:    data.is_new           ?? false,
      is_promo:  data.is_on_promotion  ?? false,
    });

    setManufacturer({
      manufacturer_name:    data.manufacturer_name    ?? '',
      manufacturer_country: data.manufacturer_country ?? '',
      production_method:    data.production_method    ?? '',
      traceability_level:   data.traceability_level   ?? '',
      haccp_compliant:      data.haccp_compliant       ?? false,
      msds_available:       data.msds_available        ?? false,
    });

    setCommerce({
      distribution_channels: data.distribution_channels ?? [],
      exclusive_dist:        data.exclusive_dist         ?? false,
      territory_allocation:  data.territory_allocation   ?? '',
      target_segment:        data.target_segment         ?? '',
      usp:                   data.usp                    ?? '',
      value_proposition:     data.value_proposition      ?? '',
    });

    if (data.document_urls?.length) {
      setDocuments(data.document_urls.map((d: ProductDocument, i: number) => ({ ...d, id: String(i) })));
    }
    if (data.videos?.length) setMediaVideo(data.videos[0]);

    setLoading(false);
  }

  // ── Recherche catalogue par nom / EAN (création) ────────────────────────
  useEffect(() => {
    const q = catalogSearch.trim();
    if (q.length < 2) { setCatalogSuggestions([]); setCatalogSearching(false); return; }
    if (catalogTimerRef.current) clearTimeout(catalogTimerRef.current);
    setCatalogSearching(true);
    catalogTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('ean_references')
        .select('*')
        .eq('status', 'active')
        .or(`name.ilike.%${q}%,ean.ilike.%${q}%`)
        .limit(10);
      setCatalogSuggestions((data ?? []) as EanRefData[]);
      setCatalogSearching(false);
    }, 350);
    return () => { if (catalogTimerRef.current) clearTimeout(catalogTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogSearch]);

  // ── Lookup EAN en temps réel ──────────────────────────────────────────────
  useEffect(() => {
    const ean = product.ean.trim();
    if (ean.length < 3) {
      setEanRef(null); setEanStatus('idle'); setEanSuggestions([]);
      return;
    }
    if (eanTimerRef.current) clearTimeout(eanTimerRef.current);
    setEanStatus('searching');
    eanTimerRef.current = setTimeout(async () => {
      const { data: suggestions } = await supabase
        .from('ean_references')
        .select('*')
        .eq('status', 'active')
        .or(`ean.ilike.%${ean}%,name.ilike.%${ean}%`)
        .limit(8);

      const list = (suggestions ?? []) as EanRefData[];
      setEanSuggestions(list);

      // Correspondance exacte uniquement sur EAN complet (≥ 8 chiffres)
      if (ean.length >= 8) {
        const exact = list.find(s => s.ean === ean);
        if (exact) { setEanRef(exact); setEanStatus('found'); }
        else        { setEanRef(null); setEanStatus('not_found'); }
      } else {
        setEanStatus('idle');
      }
    }, 400);
    return () => { if (eanTimerRef.current) clearTimeout(eanTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.ean]);

  function importFromRef(ref: EanRefData) {
    // Synchroniser la barre de recherche catalogue avec le produit sélectionné
    setCatalogSearch(ref.name);
    setCatalogSuggestions([]);
    setEanLinkedRefId(ref.id);
    setEanRef(ref);
    setEanStatus('found');

    setProduct(p => ({
      ...p,
      ean:           ref.ean,
      name:          ref.name            || p.name,
      description:   ref.short_description ?? p.description,
      hs_code:       ref.hs_code          || p.hs_code,
      brand:         ref.brand_id         || p.brand,
      category:      ref.category_id      || p.category,
      temperature:   (ref.temperature     || p.temperature) as typeof p.temperature,
      physical_form: (ref.physical_form   || p.physical_form) as typeof p.physical_form,
      net_weight:    ref.net_weight != null ? String(ref.net_weight) : p.net_weight,
      weight_unit:   ref.weight_unit       || p.weight_unit,
      colisage:      ref.pack_size         ? String(ref.pack_size)   : p.colisage,
    }));
    if (ref.certifications?.length)    setCertifications(ref.certifications);
    if (ref.allergens?.length)         setAllergens(ref.allergens);
    if (ref.nutri_score)               setNutrition(n => ({ ...n, nutriscore: ref.nutri_score! }));
    if (ref.origin_country)            setNutrition(n => ({ ...n, origin_country: ref.origin_country! }));
    if (ref.shelf_life_days != null)   setLogistics(l => ({ ...l, shelf_life_days: String(ref.shelf_life_days!) }));
    if (ref.packaging_type)            setPackaging(pk => ({ ...pk, packaging_type: ref.packaging_type! }));
    if (ref.manufacturer_name)         setManufacturer(m => ({ ...m, manufacturer_name: ref.manufacturer_name! }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!activeOrg) return;
    if (!product.name.trim()) { setError('Le nom du produit est obligatoire.'); return; }
    if (!tiers.some((t) => t.unit_price > 0)) { setError('Définissez au moins un palier de prix.'); return; }

    setSaving(true); setError(''); setSuccess(false);

    try {
      const payload = {
        seller_org_id:      activeOrg.id,
        name:               product.name.trim(),
        short_description:  product.description    || null,
        long_description:   product.long_description || null,
        ean:                product.ean             || null,
        hs_code:            product.hs_code         || null,
        temperature:        product.temperature as 'ambient' | 'refrigerated' | 'fresh' | 'frozen',
        moq:                parseInt(product.moq)    || 1,
        pack_size:          parseInt(product.colisage) || 1,
        currency:           'MAD',
        status:             (visibility.active ? 'active' : 'draft') as 'active' | 'draft',
        is_new:             visibility.is_new,
        is_on_promotion:    visibility.is_promo,
        is_sponsored:       visibility.sponsored,
        certifications,
        allergens,
        nutritional_values: {
          energy_kcal:  parseFloat(nutrition.kcal)       || null,
          protein_g:    parseFloat(nutrition.proteins)   || null,
          carbs_g:      parseFloat(nutrition.carbs)      || null,
          fat_g:        parseFloat(nutrition.fat)        || null,
          salt_g:       parseFloat(nutrition.salt)       || null,
          fiber_g:      parseFloat(nutrition.fiber)      || null,
          net_weight_g: parseFloat(nutrition.net_weight) || null,
        },
        nutri_score:    nutrition.nutriscore   as 'A' | 'B' | 'C' | 'D' | 'E',
        dlc_type:       nutrition.dlc_type     as 'DLC' | 'DDM',
        origin_country: nutrition.origin_country || null,
        ingredients:    nutrition.ingredients    || null,
        document_urls:  documents.length > 0
          ? documents.map((d) => ({ name: d.name, url: d.url, type: d.type }))
          : null,
        videos: mediaVideo ? [mediaVideo] : [],
        // Caractéristiques physiques
        net_weight:    parseFloat(product.net_weight)   || null,
        gross_weight:  parseFloat(product.gross_weight) || null,
        weight_unit:   product.weight_unit              || 'kg',
        physical_form: product.physical_form            || null,
        // Emballage
        packaging_type:     packaging.packaging_type     || null,
        packaging_material: packaging.packaging_material || null,
        units_per_inner:    parseInt(packaging.units_per_inner) || null,
        recyclable:         packaging.recyclable,
        eco_score:          packaging.eco_score          || null,
        incoterms:          packaging.incoterms,
        dimensions_unit: (packaging.dim_l || packaging.dim_w || packaging.dim_h) ? {
          length:      parseFloat(packaging.dim_l)      || null,
          width:       parseFloat(packaging.dim_w)      || null,
          height:      parseFloat(packaging.dim_h)      || null,
          weight_brut: parseFloat(packaging.dim_weight) || null,
        } : null,
        // Logistique
        volume_cbm_carton:  parseFloat(logistics.volume_cbm_carton)  || null,
        pallet_weight_kg:   parseFloat(logistics.pallet_weight_kg)   || null,
        stackability_max:   parseInt(logistics.stackability_max)      || null,
        fragility_level:    logistics.fragility_level                 || null,
        hazard_class:       logistics.hazard_class                    || null,
        shelf_life_days:    parseInt(logistics.shelf_life_days)       || null,
        after_opening_days: parseInt(logistics.after_opening_days)    || null,
        min_shelf_temp:     parseFloat(logistics.min_shelf_temp)      || null,
        max_shelf_temp:     parseFloat(logistics.max_shelf_temp)      || null,
        fifo_required:      logistics.fifo_required,
        humidity_sensitive: logistics.humidity_sensitive,
        light_sensitive:    logistics.light_sensitive,
        delivery_methods:   logistics.delivery_methods,
        // Fabricant & Qualité
        manufacturer_name:    manufacturer.manufacturer_name    || null,
        manufacturer_country: manufacturer.manufacturer_country || null,
        production_method:    manufacturer.production_method    || null,
        traceability_level:   manufacturer.traceability_level   || null,
        haccp_compliant:      manufacturer.haccp_compliant,
        msds_available:       manufacturer.msds_available,
        // Commerce
        distribution_channels: commerce.distribution_channels,
        exclusive_dist:        commerce.exclusive_dist,
        territory_allocation:  commerce.territory_allocation || null,
        target_segment:        commerce.target_segment       || null,
        usp:                   commerce.usp                  || null,
        value_proposition:     commerce.value_proposition    || null,
      };

      let productId: string;
      if (isNew) {
        const { data, error: err } = await supabase.from('products').insert(payload).select('id').single();
        if (err) throw err;
        productId = data.id;
      } else {
        const { error: err } = await supabase.from('products').update(payload).eq('id', id!);
        if (err) throw err;
        productId = id!;
      }

      await supabase.from('price_tiers').delete().eq('product_id', productId);
      const validTiers = tiers.filter((t) => t.qty_min >= 0 && t.unit_price > 0);
      if (validTiers.length) {
        const { error: tierErr } = await supabase.from('price_tiers').insert(
          validTiers.map((t) => ({ product_id: productId, variant_id: null, qty_min: t.qty_min, unit_price: t.unit_price })),
        );
        if (tierErr) throw tierErr;
      }

      // Si EAN saisi, absent du catalogue et pas encore lié → soumettre une référence pending
      if (product.ean.trim() && eanStatus === 'not_found' && !eanLinkedRefId) {
        await supabase.from('ean_references').insert({
          ean:              product.ean.trim(),
          name:             product.name.trim(),
          short_description: product.description || null,
          category_id:      product.category     || null,
          brand_id:         product.brand         || null,
          temperature:      product.temperature,
          physical_form:    product.physical_form || null,
          net_weight:       parseFloat(product.net_weight)   || null,
          weight_unit:      product.weight_unit              || 'g',
          certifications,
          allergens,
          nutri_score:      nutrition.nutriscore   || null,
          pack_size:        parseInt(product.colisage)       || 1,
          shelf_life_days:  parseInt(logistics.shelf_life_days) || null,
          origin_country:   nutrition.origin_country || null,
          hs_code:          product.hs_code          || null,
          packaging_type:   packaging.packaging_type  || null,
          manufacturer_name: manufacturer.manufacturer_name || null,
          status:           'pending',
          source:           'vendor',
          created_by_org_id: activeOrg.id,
        }).then(); // ne bloque pas la sauvegarde du produit
      }

      setSuccess(true);
      setTimeout(() => navigate('/vendor/catalog'), 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const pf  = (f: string, v: string | boolean) => setProduct((p)      => ({ ...p, [f]: v }));
  const nf  = (f: string, v: string)           => setNutrition((n)    => ({ ...n, [f]: v }));
  const pkg = (f: string, v: string | boolean | string[]) => setPackaging((p) => ({ ...p, [f]: v }));
  const lf  = (f: string, v: string | boolean | string[]) => setLogistics((l) => ({ ...l, [f]: v }));
  const mf  = (f: string, v: string | boolean) => setManufacturer((m) => ({ ...m, [f]: v }));
  const cf  = (f: string, v: string | boolean | string[]) => setCommerce((c) => ({ ...c, [f]: v }));

  function addTier()             { setTiers((t) => [...t, { qty_min: 0, unit_price: 0 }]); }
  function removeTier(i: number) { setTiers((t) => t.filter((_, idx) => idx !== i)); }
  function updateTier(i: number, field: 'qty_min' | 'unit_price', val: number) {
    setTiers((t) => t.map((tier, idx) => idx === i ? { ...tier, [field]: val } : tier));
  }
  function addVariant() {
    setVariants((v) => [...v, { id: Date.now().toString(), label: '', ean: '', colisage: 12, stock: 0 }]);
  }
  function addDocument() {
    if (!newDoc.name || !newDoc.url) return;
    setDocuments((d) => [...d, { ...newDoc, id: Date.now().toString() }]);
    setNewDoc({ name: '', url: '', type: 'datasheet' });
  }
  function removeDocument(docId: string) { setDocuments((d) => d.filter((doc) => doc.id !== docId)); }

  const coldChain = ['refrigerated', 'fresh', 'frozen'].includes(product.temperature);

  if (loading) {
    return (
      <SpaceBetween size="l">
        <Header variant="h1">Chargement du produit…</Header>
        <Spinner size="large" />
      </SpaceBetween>
    );
  }

  const fragLabel = (v: string) =>
    v === 'low' ? 'Faible' : v === 'medium' ? 'Moyen' : v === 'high' ? 'Élevé' : 'Non renseigné';

  const prodMethodLabel = (v: string) =>
    v === 'industrial' ? 'Industriel' : v === 'artisanal' ? 'Artisanal' : v === 'hybrid' ? 'Hybride' : 'Non renseigné';

  const tracLabel = (v: string) =>
    v === 'lot' ? 'Numéro de lot' : v === 'ean' ? 'EAN unitaire' : v === 'serial' ? 'Numéro de série' : 'Non renseigné';

  const vpLabel = (v: string) =>
    v === 'price' ? 'Prix compétitif' : v === 'quality' ? 'Qualité premium' : v === 'eco' ? 'Éco-responsable' : v === 'luxury' ? 'Luxe / prestige' : v === 'professional' ? 'Usage professionnel' : 'Non renseigné';

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate('/vendor/catalog')}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
              {isNew ? 'Créer le produit' : 'Enregistrer'}
            </Button>
          </SpaceBetween>
        }
      >
        {isNew ? 'Nouveau produit' : 'Modifier le produit'}
      </Header>

      {error   && <Flashbar items={[{ type: 'error',   content: error, dismissible: true, onDismiss: () => setError('') }]} />}
      {success && <Flashbar items={[{ type: 'success', content: 'Produit enregistré avec succès. Redirection…' }]} />}

      {/* ── Étape 1 : recherche produit dans le catalogue (création uniquement) ── */}
      {isNew && (
        <Container
          header={
            <Header
              variant="h2"
              description="Cherchez si ce produit est déjà référencé sur la plateforme. Si un autre vendeur le vend déjà, l'EAN et les données techniques se remplissent automatiquement."
            >
              Quel produit souhaitez-vous vendre ?
            </Header>
          }
        >
          <SpaceBetween size="m">
            <FormField label="Nom du produit ou EAN">
              <Autosuggest
                value={catalogSearch}
                onChange={({ detail }) => {
                  setCatalogSearch(detail.value);
                  // Si le vendeur modifie après une sélection → réinitialiser le lien
                  if (eanLinkedRefId && detail.value !== eanRef?.name) {
                    setEanLinkedRefId(null);
                    setEanRef(null);
                    setEanStatus('idle');
                  }
                }}
                onSelect={({ detail }) => {
                  const selected = catalogSuggestions.find(
                    s => s.name === detail.value || s.ean === detail.value,
                  );
                  if (selected) importFromRef(selected);
                }}
                options={catalogSuggestions.map(s => ({
                  value: s.name,
                  label: s.name,
                  description: [
                    s.ean ? `EAN ${s.ean}` : null,
                    s.manufacturer_name,
                    s.temperature === 'ambient'      ? 'Ambiant'
                    : s.temperature === 'refrigerated' ? 'Réfrigéré'
                    : s.temperature === 'frozen'       ? 'Congelé'
                    : s.temperature === 'fresh'        ? 'Frais' : null,
                  ].filter(Boolean).join(' · '),
                  tags: s.certifications?.slice(0, 3),
                }))}
                filteringType="manual"
                statusType={catalogSearching ? 'loading' : 'finished'}
                loadingText="Recherche dans le catalogue plateforme…"
                empty={
                  catalogSearch.trim().length >= 2
                    ? 'Aucun produit correspondant — vous pouvez le créer manuellement ci-dessous.'
                    : ''
                }
                placeholder="Ex : Coca-Cola 1,5L, 6111073111091, Yaourt nature…"
                enteredTextLabel={v => `Créer "${v}" comme nouveau produit`}
              />
            </FormField>

            {/* Produit lié depuis le catalogue */}
            {eanLinkedRefId && eanRef && (
              <Alert
                type="success"
                header={`Produit trouvé dans le catalogue : ${eanRef.name}`}
                dismissible
                onDismiss={() => {
                  setEanLinkedRefId(null); setEanRef(null);
                  setEanStatus('idle'); setCatalogSearch('');
                  setProduct(p => ({ ...p, ean: '', name: '' }));
                }}
              >
                <SpaceBetween size="xs" direction="horizontal">
                  <Box>EAN : <strong>{eanRef.ean}</strong></Box>
                  {eanRef.manufacturer_name && <Box>· {eanRef.manufacturer_name}</Box>}
                  {eanRef.temperature && <Box>· {eanRef.temperature}</Box>}
                </SpaceBetween>
                <Box>
                  Les données techniques ont été pré-remplies dans les onglets ci-dessous.
                  Personnalisez librement vos <strong>prix</strong>, <strong>photos</strong>,
                  {' '}<strong>lots / DLCs</strong> et descriptions commerciales — cela ne modifie
                  pas la fiche de référence commune.
                </Box>
              </Alert>
            )}

            {/* Produit non trouvé → nouvelle référence */}
            {!eanLinkedRefId && catalogSearch.trim().length >= 2
              && !catalogSearching && catalogSuggestions.length === 0 && (
              <Alert type="warning" header="Ce produit n'est pas encore dans le catalogue">
                Renseignez ses informations manuellement dans les onglets ci-dessous.
                Une demande de création de référence catalogue sera automatiquement soumise
                à l'administration à l'enregistrement — votre produit sera créé sans attendre.
              </Alert>
            )}
          </SpaceBetween>
        </Container>
      )}

      <Tabs
        tabs={[

          // ── 1. Produit ────────────────────────────────────────────────────
          {
            id: 'product',
            label: '1. Produit',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Informations générales</Header>}>
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2}>
                      <FormField
                        label="Nom du produit *"
                        description={eanLinkedRefId ? 'Pré-rempli depuis le catalogue — modifiable (ex : nom commercial spécifique)' : undefined}
                      >
                        <Input
                          value={product.name}
                          onChange={({ detail }) => pf('name', detail.value)}
                          placeholder="Ex: Yaourt nature 500g"
                        />
                      </FormField>
                      <FormField
                        label="EAN / Code-barres GS1"
                        description={
                          eanStatus === 'searching' ? 'Recherche dans le catalogue de références…' :
                          eanStatus === 'found'     ? '✓ Référence catalogue trouvée' :
                          eanStatus === 'not_found' ? '⚠ EAN non référencé — une demande sera soumise à l\'admin' :
                          'Tapez l\'EAN ou le nom du produit pour rechercher dans le catalogue'
                        }
                      >
                        <Autosuggest
                          value={product.ean}
                          onChange={({ detail }) => {
                            pf('ean', detail.value);
                            if (eanLinkedRefId) setEanLinkedRefId(null);
                          }}
                          onSelect={({ detail }) => {
                            const selected = eanSuggestions.find(s => s.ean === detail.value);
                            if (selected) importFromRef(selected);
                          }}
                          options={eanSuggestions.map(s => ({
                            value: s.ean,
                            label: s.name,
                            description: [
                              `EAN : ${s.ean}`,
                              s.temperature,
                              s.manufacturer_name,
                            ].filter(Boolean).join(' · '),
                          }))}
                          filteringType="manual"
                          statusType={eanStatus === 'searching' ? 'loading' : 'finished'}
                          loadingText="Recherche dans le catalogue…"
                          empty={
                            product.ean.trim().length >= 3
                              ? 'Aucune correspondance dans le catalogue de références'
                              : ''
                          }
                          placeholder="6111073111091 ou nom du produit"
                          enteredTextLabel={v => `Utiliser : "${v}"`}
                        />
                      </FormField>
                      <FormField label="Marque">
                        <Input value={product.brand} onChange={({ detail }) => pf('brand', detail.value)} />
                      </FormField>
                      <FormField label="Code SH / HS Code">
                        <Input value={product.hs_code} onChange={({ detail }) => pf('hs_code', detail.value)} placeholder="Ex: 0401.10.00" />
                      </FormField>
                      <FormField label="Catégorie">
                        <Select
                          selectedOption={{ label: product.category || 'Sélectionner…', value: product.category }}
                          options={[
                            { label: 'Laitiers & Fromages', value: 'A' },
                            { label: 'Épicerie sèche',      value: 'B' },
                            { label: 'Boissons',            value: 'C' },
                            { label: 'Hygiène & Beauté',    value: 'D' },
                            { label: 'Entretien',           value: 'E' },
                            { label: 'Frais & Surgelés',    value: 'F' },
                            { label: 'Épicerie fine',       value: 'G' },
                          ]}
                          onChange={({ detail }) => pf('category', detail.selectedOption.value ?? '')}
                        />
                      </FormField>
                      <FormField label="Conservation *">
                        <Select
                          selectedOption={{
                            label: product.temperature === 'ambient'      ? 'Ambiante'
                                 : product.temperature === 'refrigerated'  ? 'Réfrigéré (0–4°C)'
                                 : product.temperature === 'frozen'        ? 'Congelé (-18°C)' : 'Frais',
                            value: product.temperature,
                          }}
                          options={[
                            { label: 'Ambiante',           value: 'ambient'      },
                            { label: 'Réfrigéré (0–4°C)', value: 'refrigerated' },
                            { label: 'Congelé (-18°C)',    value: 'frozen'       },
                            { label: 'Frais',              value: 'fresh'        },
                          ]}
                          onChange={({ detail }) => pf('temperature', detail.selectedOption.value ?? 'ambient')}
                        />
                      </FormField>
                      <FormField label="Commande minimale (unités)">
                        <Input type="number" value={product.moq}     onChange={({ detail }) => pf('moq',     detail.value)} />
                      </FormField>
                      <FormField label="Colisage (u/carton)">
                        <Input type="number" value={product.colisage} onChange={({ detail }) => pf('colisage', detail.value)} />
                      </FormField>
                    </ColumnLayout>
                    {/* Bandeau import référence EAN */}
                    {eanStatus === 'found' && eanRef && !eanLinkedRefId && (
                      <Alert
                        type="success"
                        header={`Référence catalogue trouvée : ${eanRef.name}`}
                        action={
                          <Button onClick={() => importFromRef(eanRef)}>
                            Importer les données de référence
                          </Button>
                        }
                      >
                        Température : {eanRef.temperature}
                        {eanRef.manufacturer_name && ` · ${eanRef.manufacturer_name}`}
                        {' '}— Cliquez sur « Importer » pour pré-remplir le formulaire à partir de la fiche catalogue.
                        Vous pourrez ensuite personnaliser librement tous les champs.
                      </Alert>
                    )}
                    {eanStatus === 'found' && eanRef && eanLinkedRefId && (
                      <Alert type="success" header={`Données importées depuis la référence catalogue : ${eanRef.name}`}>
                        Les informations ont été pré-remplies à partir de la fiche de référence.
                        Vous pouvez modifier librement tous les champs — vos personnalisations
                        (prix, descriptions, paramètres logistiques) ne modifient pas la référence commune.
                      </Alert>
                    )}
                    {eanStatus === 'not_found' && product.ean.trim().length >= 8 && (
                      <Alert type="warning" header="Produit non encore référencé dans le catalogue">
                        L'EAN <strong>{product.ean.trim()}</strong> n'existe pas encore dans le catalogue
                        de référence de la plateforme. En enregistrant ce produit, une demande de création
                        de référence sera automatiquement soumise à l'administration pour validation.
                        Votre produit sera créé normalement et ne sera pas bloqué pendant ce processus.
                      </Alert>
                    )}

                    <FormField label="Description courte (accroche catalogue)">
                      <Textarea value={product.description} onChange={({ detail }) => pf('description', detail.value)} rows={2} placeholder="1-2 phrases percutantes…" />
                    </FormField>
                    <FormField label="Description longue (fiche produit acheteur)">
                      <Textarea value={product.long_description} onChange={({ detail }) => pf('long_description', detail.value)} rows={5} placeholder="Caractéristiques, usages, avantages, contexte de consommation…" />
                    </FormField>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Caractéristiques physiques</Header>}>
                  <ColumnLayout columns={4}>
                    <FormField label="Poids net">
                      <Input type="number" value={product.net_weight}  onChange={({ detail }) => pf('net_weight',  detail.value)} placeholder="Ex: 500" />
                    </FormField>
                    <FormField label="Poids brut">
                      <Input type="number" value={product.gross_weight} onChange={({ detail }) => pf('gross_weight', detail.value)} placeholder="Ex: 560" />
                    </FormField>
                    <FormField label="Unité">
                      <Select
                        selectedOption={{ label: product.weight_unit, value: product.weight_unit }}
                        options={[
                          { label: 'g',  value: 'g'  },
                          { label: 'kg', value: 'kg' },
                          { label: 'mL', value: 'ml' },
                          { label: 'L',  value: 'l'  },
                        ]}
                        onChange={({ detail }) => pf('weight_unit', detail.selectedOption.value ?? 'kg')}
                      />
                    </FormField>
                    <FormField label="Forme physique">
                      <Select
                        selectedOption={{ label: product.physical_form || 'Sélectionner…', value: product.physical_form }}
                        options={[
                          { label: 'Sélectionner…', value: ''        },
                          { label: 'Liquide',        value: 'liquid'  },
                          { label: 'Solide',         value: 'solid'   },
                          { label: 'Poudre',         value: 'powder'  },
                          { label: 'Gel',            value: 'gel'     },
                          { label: 'Aérosol',        value: 'aerosol' },
                          { label: 'Crème',          value: 'cream'   },
                          { label: 'Comprimé',       value: 'tablet'  },
                          { label: 'Autre',          value: 'other'   },
                        ]}
                        onChange={({ detail }) => pf('physical_form', detail.selectedOption.value ?? '')}
                      />
                    </FormField>
                  </ColumnLayout>
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 2. Tarification ───────────────────────────────────────────────
          {
            id: 'pricing',
            label: '2. Tarification *',
            content: (
              <Container header={<Header variant="h2">Paliers de prix B2B</Header>}>
                <SpaceBetween size="m">
                  <Box color="text-body-secondary">Les acheteurs voient automatiquement le prix le plus avantageux selon leur quantité commandée.</Box>
                  {tiers.map((tier, i) => (
                    <ColumnLayout key={i} columns={4} variant="text-grid">
                      <FormField label={`Palier ${i + 1} — Qté min`}>
                        <Input type="number" value={String(tier.qty_min)}    onChange={({ detail }) => updateTier(i, 'qty_min',    parseInt(detail.value)   || 0)} />
                      </FormField>
                      <FormField label="Prix unitaire HT (MAD)">
                        <Input type="number" value={String(tier.unit_price)} onChange={({ detail }) => updateTier(i, 'unit_price', parseFloat(detail.value) || 0)} />
                      </FormField>
                      <FormField label="Total minimum">
                        <Box fontWeight="bold">{(tier.qty_min * tier.unit_price).toFixed(2)} MAD</Box>
                      </FormField>
                      <FormField label=" ">
                        {i > 0 && <Button variant="link" onClick={() => removeTier(i)}>Supprimer</Button>}
                      </FormField>
                    </ColumnLayout>
                  ))}
                  <Button onClick={addTier}>+ Ajouter un palier</Button>
                  <Header variant="h3">Certifications</Header>
                  <Multiselect
                    selectedOptions={certifications.map((c) => ({ label: c, value: c }))}
                    options={CERTIF_OPTIONS}
                    onChange={({ detail }) => setCertifications(detail.selectedOptions.map((o) => o.value ?? ''))}
                    placeholder="Sélectionner les certifications"
                  />
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 3. Fiche produit ──────────────────────────────────────────────
          {
            id: 'sheet',
            label: '3. Fiche produit',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Valeurs nutritionnelles</Header>}>
                  <SpaceBetween size="m">
                    <ColumnLayout columns={3}>
                      <FormField label="Énergie (kcal/100g)"><Input type="number" value={nutrition.kcal}       onChange={({ detail }) => nf('kcal',       detail.value)} /></FormField>
                      <FormField label="Protéines (g)">       <Input type="number" value={nutrition.proteins}   onChange={({ detail }) => nf('proteins',   detail.value)} /></FormField>
                      <FormField label="Glucides (g)">        <Input type="number" value={nutrition.carbs}      onChange={({ detail }) => nf('carbs',      detail.value)} /></FormField>
                      <FormField label="Lipides (g)">         <Input type="number" value={nutrition.fat}        onChange={({ detail }) => nf('fat',        detail.value)} /></FormField>
                      <FormField label="Sel (g)">             <Input type="number" value={nutrition.salt}       onChange={({ detail }) => nf('salt',       detail.value)} /></FormField>
                      <FormField label="Fibres (g)">          <Input type="number" value={nutrition.fiber}      onChange={({ detail }) => nf('fiber',      detail.value)} /></FormField>
                      <FormField label="Poids net (g)">       <Input type="number" value={nutrition.net_weight} onChange={({ detail }) => nf('net_weight', detail.value)} /></FormField>
                      <FormField label="Nutri-Score">
                        <Select
                          selectedOption={{ label: `Nutri-Score ${nutrition.nutriscore}`, value: nutrition.nutriscore }}
                          options={['A','B','C','D','E'].map((s) => ({ label: `Nutri-Score ${s}`, value: s }))}
                          onChange={({ detail }) => nf('nutriscore', detail.selectedOption.value ?? 'C')}
                        />
                      </FormField>
                      <FormField label="Type DLC">
                        <Select
                          selectedOption={{ label: nutrition.dlc_type, value: nutrition.dlc_type }}
                          options={[{ label: 'DDM', value: 'DDM' }, { label: 'DLC', value: 'DLC' }]}
                          onChange={({ detail }) => nf('dlc_type', detail.selectedOption.value ?? 'DDM')}
                        />
                      </FormField>
                    </ColumnLayout>
                    <FormField label="Pays d'origine"><Input value={nutrition.origin_country} onChange={({ detail }) => nf('origin_country', detail.value)} /></FormField>
                    <FormField label="Ingrédients"><Textarea value={nutrition.ingredients} onChange={({ detail }) => nf('ingredients', detail.value)} rows={3} /></FormField>
                    <FormField label="Additifs / E-numbers"><Input value={nutrition.additives} onChange={({ detail }) => nf('additives', detail.value)} /></FormField>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Allergènes</Header>}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ALLERGEN_LIST.map((a) => (
                      <Button
                        key={a}
                        variant={allergens.includes(a) ? 'primary' : 'normal'}
                        onClick={() => setAllergens((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])}
                      >
                        {a}
                      </Button>
                    ))}
                  </div>
                  {allergens.length > 0 && (
                    <Box margin={{ top: 's' }}>
                      <SpaceBetween direction="horizontal" size="xxs">
                        {allergens.map((a) => <Badge key={a} color="red">{a}</Badge>)}
                      </SpaceBetween>
                    </Box>
                  )}
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 4. Emballage ──────────────────────────────────────────────────
          {
            id: 'packaging',
            label: '4. Emballage',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Emballage unitaire</Header>}>
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2}>
                      <FormField label="Type d'emballage">
                        <Input value={packaging.packaging_type}     onChange={({ detail }) => pkg('packaging_type',     detail.value)} placeholder="Ex: Bouteille, Sachet, Boîte conserve…" />
                      </FormField>
                      <FormField label="Matériau">
                        <Input value={packaging.packaging_material} onChange={({ detail }) => pkg('packaging_material', detail.value)} placeholder="Ex: HDPE, Verre, Carton FSC…" />
                      </FormField>
                      <FormField label="Unités par inner (sous-carton)">
                        <Input type="number" value={packaging.units_per_inner} onChange={({ detail }) => pkg('units_per_inner', detail.value)} />
                      </FormField>
                      <FormField label="Éco-Score">
                        <Select
                          selectedOption={{ label: packaging.eco_score ? `Éco-Score ${packaging.eco_score}` : 'Non renseigné', value: packaging.eco_score }}
                          options={[
                            { label: 'Non renseigné', value: '' },
                            ...['A','B','C','D','E'].map((s) => ({ label: `Éco-Score ${s}`, value: s })),
                          ]}
                          onChange={({ detail }) => pkg('eco_score', detail.selectedOption.value ?? '')}
                        />
                      </FormField>
                    </ColumnLayout>
                    <FormField label="Emballage recyclable">
                      <Toggle checked={packaging.recyclable} onChange={({ detail }) => pkg('recyclable', detail.checked)}>
                        {packaging.recyclable ? 'Oui — recyclable' : 'Non recyclable / non renseigné'}
                      </Toggle>
                    </FormField>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Dimensions unitaires (cm / g)</Header>}>
                  <ColumnLayout columns={4}>
                    <FormField label="Longueur (cm)"><Input type="number" value={packaging.dim_l}      onChange={({ detail }) => pkg('dim_l',      detail.value)} /></FormField>
                    <FormField label="Largeur (cm)"> <Input type="number" value={packaging.dim_w}      onChange={({ detail }) => pkg('dim_w',      detail.value)} /></FormField>
                    <FormField label="Hauteur (cm)"> <Input type="number" value={packaging.dim_h}      onChange={({ detail }) => pkg('dim_h',      detail.value)} /></FormField>
                    <FormField label="Poids brut (g)"><Input type="number" value={packaging.dim_weight} onChange={({ detail }) => pkg('dim_weight', detail.value)} /></FormField>
                  </ColumnLayout>
                </Container>

                <Container header={<Header variant="h2">Incoterms proposés</Header>}>
                  <Multiselect
                    selectedOptions={packaging.incoterms.map((v) => INCOTERM_OPTIONS.find((o) => o.value === v) ?? { label: v, value: v })}
                    options={INCOTERM_OPTIONS}
                    onChange={({ detail }) => pkg('incoterms', detail.selectedOptions.map((o) => o.value ?? ''))}
                    placeholder="Sélectionner les incoterms acceptés"
                  />
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 5. Logistique ─────────────────────────────────────────────────
          {
            id: 'logistics',
            label: '5. Logistique',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Transport & Palettisation</Header>}>
                  <ColumnLayout columns={3}>
                    <FormField label="Volume carton (m³)">
                      <Input type="number" value={logistics.volume_cbm_carton} onChange={({ detail }) => lf('volume_cbm_carton', detail.value)} placeholder="Ex: 0.024" />
                    </FormField>
                    <FormField label="Poids palette (kg)">
                      <Input type="number" value={logistics.pallet_weight_kg}  onChange={({ detail }) => lf('pallet_weight_kg',  detail.value)} />
                    </FormField>
                    <FormField label="Gerbage max (palettes)">
                      <Input type="number" value={logistics.stackability_max}  onChange={({ detail }) => lf('stackability_max',  detail.value)} />
                    </FormField>
                    <FormField label="Niveau de fragilité">
                      <Select
                        selectedOption={{ label: fragLabel(logistics.fragility_level), value: logistics.fragility_level }}
                        options={[
                          { label: 'Non renseigné', value: ''       },
                          { label: 'Faible',         value: 'low'    },
                          { label: 'Moyen',          value: 'medium' },
                          { label: 'Élevé',          value: 'high'   },
                        ]}
                        onChange={({ detail }) => lf('fragility_level', detail.selectedOption.value ?? '')}
                      />
                    </FormField>
                    <FormField label="Classe de danger (ADR)">
                      <Input value={logistics.hazard_class} onChange={({ detail }) => lf('hazard_class', detail.value)} placeholder="Ex: 3 (liquide inflammable)" />
                    </FormField>
                    {coldChain && (
                      <FormField label="Chaîne du froid">
                        <Badge color="blue">Requise — calculée depuis la conservation</Badge>
                      </FormField>
                    )}
                  </ColumnLayout>
                </Container>

                <Container header={<Header variant="h2">Durée de vie & Conditions de stockage</Header>}>
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2}>
                      <FormField label="DLC / DDM (jours)">
                        <Input type="number" value={logistics.shelf_life_days}    onChange={({ detail }) => lf('shelf_life_days',    detail.value)} placeholder="Ex: 365" />
                      </FormField>
                      <FormField label="DLC après ouverture (jours)">
                        <Input type="number" value={logistics.after_opening_days} onChange={({ detail }) => lf('after_opening_days', detail.value)} placeholder="Ex: 7" />
                      </FormField>
                      <FormField label="Température min de stockage (°C)">
                        <Input type="number" value={logistics.min_shelf_temp}     onChange={({ detail }) => lf('min_shelf_temp',     detail.value)} />
                      </FormField>
                      <FormField label="Température max de stockage (°C)">
                        <Input type="number" value={logistics.max_shelf_temp}     onChange={({ detail }) => lf('max_shelf_temp',     detail.value)} />
                      </FormField>
                    </ColumnLayout>
                    <ColumnLayout columns={2}>
                      <FormField label="FIFO obligatoire">
                        <Toggle checked={logistics.fifo_required}      onChange={({ detail }) => lf('fifo_required',      detail.checked)}>
                          {logistics.fifo_required ? 'Oui — rotation FIFO requise' : 'Non obligatoire'}
                        </Toggle>
                      </FormField>
                      <FormField label="Sensibilités">
                        <SpaceBetween size="xs">
                          <Toggle checked={logistics.humidity_sensitive} onChange={({ detail }) => lf('humidity_sensitive', detail.checked)}>Sensible à l'humidité</Toggle>
                          <Toggle checked={logistics.light_sensitive}    onChange={({ detail }) => lf('light_sensitive',    detail.checked)}>Sensible à la lumière</Toggle>
                        </SpaceBetween>
                      </FormField>
                    </ColumnLayout>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Modes de livraison proposés</Header>}>
                  <SpaceBetween size="s">
                    <Multiselect
                      selectedOptions={logistics.delivery_methods.map((v) => DELIVERY_METHODS_OPTIONS.find((o) => o.value === v) ?? { label: v, value: v })}
                      options={DELIVERY_METHODS_OPTIONS}
                      onChange={({ detail }) => lf('delivery_methods', detail.selectedOptions.map((o) => o.value ?? ''))}
                      placeholder="Sélectionner les modes de livraison disponibles"
                    />
                    {coldChain && logistics.delivery_methods.length > 0 && !logistics.delivery_methods.includes('cold_chain_express') && (
                      <Alert type="warning">Ce produit nécessite une chaîne du froid — pensez à activer "Froid Express".</Alert>
                    )}
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 6. Variantes ──────────────────────────────────────────────────
          {
            id: 'variants',
            label: '6. Variantes',
            content: (
              <Container header={<Header variant="h2" actions={<Button onClick={addVariant}>+ Ajouter une variante</Button>}>Déclinaisons produit</Header>}>
                <SpaceBetween size="m">
                  <Box color="text-body-secondary">Gérez les déclinaisons (contenance, taille, format). Chaque variante a son propre EAN et stock.</Box>
                  {variants.length === 0 && <Alert type="info">Aucune variante. Le produit est vendu en version unique.</Alert>}
                  {variants.map((v, i) => (
                    <ColumnLayout key={v.id} columns={5}>
                      <FormField label="Libellé (ex: 500g)">
                        <Input value={v.label}        onChange={({ detail }) => setVariants((vv) => vv.map((x, idx) => idx === i ? { ...x, label:   detail.value                  } : x))} />
                      </FormField>
                      <FormField label="EAN">
                        <Input value={v.ean}          onChange={({ detail }) => setVariants((vv) => vv.map((x, idx) => idx === i ? { ...x, ean:     detail.value                  } : x))} />
                      </FormField>
                      <FormField label="Colisage">
                        <Input type="number" value={String(v.colisage)} onChange={({ detail }) => setVariants((vv) => vv.map((x, idx) => idx === i ? { ...x, colisage: parseInt(detail.value) || 0 } : x))} />
                      </FormField>
                      <FormField label="Stock">
                        <Input type="number" value={String(v.stock)}    onChange={({ detail }) => setVariants((vv) => vv.map((x, idx) => idx === i ? { ...x, stock:    parseInt(detail.value) || 0 } : x))} />
                      </FormField>
                      <FormField label=" ">
                        <Button variant="link" onClick={() => setVariants((vv) => vv.filter((_, idx) => idx !== i))}>Supprimer</Button>
                      </FormField>
                    </ColumnLayout>
                  ))}
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 7. Médias ─────────────────────────────────────────────────────
          {
            id: 'media',
            label: '7. Médias',
            content: (
              <Container header={<Header variant="h2">Médias produit</Header>}>
                <SpaceBetween size="m">
                  <Alert type="info">
                    Pour les images, utilisez le bouton <strong>+ Nouveau produit</strong> dans la liste catalogue — il prend en charge l'upload Supabase Storage.
                  </Alert>
                  <FormField label="Vidéo produit (YouTube / Vimeo)">
                    <Input value={mediaVideo} onChange={({ detail }) => setMediaVideo(detail.value)} placeholder="https://youtube.com/watch?v=…" />
                  </FormField>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 8. Visibilité ─────────────────────────────────────────────────
          {
            id: 'visibility',
            label: '8. Visibilité',
            content: (
              <Container header={<Header variant="h2">Options de visibilité</Header>}>
                <SpaceBetween size="m">
                  <ColumnLayout columns={2}>
                    <FormField label="Produit actif">
                      <Toggle checked={visibility.active}    onChange={({ detail }) => setVisibility((v) => ({ ...v, active:    detail.checked }))}>
                        {visibility.active ? 'Visible dans le catalogue' : 'Masqué (brouillon)'}
                      </Toggle>
                    </FormField>
                    <FormField label="Listing sponsorisé">
                      <Toggle checked={visibility.sponsored} onChange={({ detail }) => setVisibility((v) => ({ ...v, sponsored: detail.checked }))}>
                        Mise en avant dans les résultats
                      </Toggle>
                    </FormField>
                    <FormField label="Badge Nouveauté">
                      <Toggle checked={visibility.is_new}    onChange={({ detail }) => setVisibility((v) => ({ ...v, is_new:    detail.checked }))}>
                        Affiché 30 jours
                      </Toggle>
                    </FormField>
                    <FormField label="En promotion / Déstockage">
                      <Toggle checked={visibility.is_promo}  onChange={({ detail }) => setVisibility((v) => ({ ...v, is_promo:  detail.checked }))}>
                        Badge Promo + mise en avant déstockage
                      </Toggle>
                    </FormField>
                  </ColumnLayout>
                  <Container header={<Header variant="h3">Aperçu carte produit</Header>}>
                    <div style={{ border: '1px solid var(--color-border-divider-default)', borderRadius: '4px', padding: '8px', maxWidth: '220px' }}>
                      <SpaceBetween size="xxs">
                        <Box fontWeight="bold">{product.name || 'Nom du produit'}</Box>
                        {visibility.is_new    && <Badge color="green">Nouveauté</Badge>}
                        {visibility.is_promo  && <Badge color="red">Promo</Badge>}
                        {visibility.sponsored && <Badge color="blue">Sponsorisé</Badge>}
                        <Box color="text-body-secondary">
                          {tiers[0]?.unit_price > 0 ? `À partir de ${tiers[0].unit_price.toFixed(2)} MAD/u` : 'Prix non défini'}
                        </Box>
                      </SpaceBetween>
                    </div>
                  </Container>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── 9. Fabricant & Qualité ────────────────────────────────────────
          {
            id: 'manufacturer',
            label: '9. Fabricant & Qualité',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Fabricant & Traçabilité</Header>}>
                  <ColumnLayout columns={2}>
                    <FormField label="Nom du fabricant">
                      <Input value={manufacturer.manufacturer_name}    onChange={({ detail }) => mf('manufacturer_name',    detail.value)} placeholder="Ex: Laiterie Centrale" />
                    </FormField>
                    <FormField label="Pays du fabricant">
                      <Input value={manufacturer.manufacturer_country} onChange={({ detail }) => mf('manufacturer_country', detail.value)} placeholder="Ex: Maroc" />
                    </FormField>
                    <FormField label="Mode de production">
                      <Select
                        selectedOption={{ label: prodMethodLabel(manufacturer.production_method), value: manufacturer.production_method }}
                        options={[
                          { label: 'Non renseigné', value: ''           },
                          { label: 'Industriel',     value: 'industrial' },
                          { label: 'Artisanal',      value: 'artisanal'  },
                          { label: 'Hybride',        value: 'hybrid'     },
                        ]}
                        onChange={({ detail }) => mf('production_method', detail.selectedOption.value ?? '')}
                      />
                    </FormField>
                    <FormField label="Niveau de traçabilité">
                      <Select
                        selectedOption={{ label: tracLabel(manufacturer.traceability_level), value: manufacturer.traceability_level }}
                        options={[
                          { label: 'Non renseigné',   value: ''       },
                          { label: 'Numéro de lot',   value: 'lot'    },
                          { label: 'EAN unitaire',    value: 'ean'    },
                          { label: 'Numéro de série', value: 'serial' },
                        ]}
                        onChange={({ detail }) => mf('traceability_level', detail.selectedOption.value ?? '')}
                      />
                    </FormField>
                  </ColumnLayout>
                </Container>

                <Container header={<Header variant="h2">Sécurité & Conformité</Header>}>
                  <ColumnLayout columns={2}>
                    <FormField label="HACCP">
                      <Toggle checked={manufacturer.haccp_compliant} onChange={({ detail }) => mf('haccp_compliant', detail.checked)}>
                        {manufacturer.haccp_compliant ? 'Conforme HACCP' : 'Non certifié HACCP'}
                      </Toggle>
                    </FormField>
                    <FormField label="Fiche de données de sécurité (FDS / MSDS)">
                      <Toggle checked={manufacturer.msds_available}  onChange={({ detail }) => mf('msds_available',  detail.checked)}>
                        {manufacturer.msds_available ? 'FDS disponible' : 'FDS non disponible'}
                      </Toggle>
                    </FormField>
                  </ColumnLayout>
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 10. Commerce & Marché ─────────────────────────────────────────
          {
            id: 'commerce',
            label: '10. Commerce & Marché',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Positionnement marché</Header>}>
                  <SpaceBetween size="m">
                    <FormField label="USP — Argument de vente unique">
                      <Textarea value={commerce.usp} onChange={({ detail }) => cf('usp', detail.value)} rows={2} placeholder="Ex: Seul produit labellisé Bio & Halal sur le marché marocain avec DLC 18 mois…" />
                    </FormField>
                    <ColumnLayout columns={2}>
                      <FormField label="Segment cible">
                        <Input value={commerce.target_segment} onChange={({ detail }) => cf('target_segment', detail.value)} placeholder="Ex: Restauration collective, GSM premium…" />
                      </FormField>
                      <FormField label="Proposition de valeur principale">
                        <Select
                          selectedOption={{ label: vpLabel(commerce.value_proposition), value: commerce.value_proposition }}
                          options={[
                            { label: 'Non renseigné',       value: ''             },
                            { label: 'Prix compétitif',     value: 'price'        },
                            { label: 'Qualité premium',     value: 'quality'      },
                            { label: 'Éco-responsable',     value: 'eco'          },
                            { label: 'Luxe / prestige',     value: 'luxury'       },
                            { label: 'Usage professionnel', value: 'professional' },
                          ]}
                          onChange={({ detail }) => cf('value_proposition', detail.selectedOption.value ?? '')}
                        />
                      </FormField>
                    </ColumnLayout>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Canaux de distribution</Header>}>
                  <SpaceBetween size="m">
                    <Multiselect
                      selectedOptions={commerce.distribution_channels.map((v) => DISTRIBUTION_CH_OPTIONS.find((o) => o.value === v) ?? { label: v, value: v })}
                      options={DISTRIBUTION_CH_OPTIONS}
                      onChange={({ detail }) => cf('distribution_channels', detail.selectedOptions.map((o) => o.value ?? ''))}
                      placeholder="Sélectionner les circuits de distribution"
                    />
                    <ColumnLayout columns={2}>
                      <FormField label="Distribution exclusive">
                        <Toggle checked={commerce.exclusive_dist} onChange={({ detail }) => cf('exclusive_dist', detail.checked)}>
                          {commerce.exclusive_dist ? 'Distribution exclusive dans la zone' : 'Distribution non exclusive'}
                        </Toggle>
                      </FormField>
                      <FormField label="Zone / territoire d'allocation">
                        <Input value={commerce.territory_allocation} onChange={({ detail }) => cf('territory_allocation', detail.value)} placeholder="Ex: Casablanca-Settat, Grand Casablanca…" />
                      </FormField>
                    </ColumnLayout>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },

          // ── 11. Documents ─────────────────────────────────────────────────
          {
            id: 'documents',
            label: '11. Documents',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Ajouter un document</Header>}>
                  <SpaceBetween size="m">
                    <Box color="text-body-secondary">Fiches techniques, certificats, FDS ou fiches logistiques téléchargeables par les acheteurs.</Box>
                    <ColumnLayout columns={3}>
                      <FormField label="Nom du document *">
                        <Input value={newDoc.name} onChange={({ detail }) => setNewDoc((d) => ({ ...d, name: detail.value }))} placeholder="Ex: Fiche technique produit" />
                      </FormField>
                      <FormField label="Type">
                        <Select
                          selectedOption={DOC_TYPE_OPTIONS.find((o) => o.value === newDoc.type) ?? DOC_TYPE_OPTIONS[0]}
                          options={DOC_TYPE_OPTIONS}
                          onChange={({ detail }) => setNewDoc((d) => ({ ...d, type: (detail.selectedOption.value ?? 'other') as DocType }))}
                        />
                      </FormField>
                      <FormField label=" ">
                        <Button variant="primary" onClick={addDocument} disabled={!newDoc.name || !newDoc.url}>+ Ajouter</Button>
                      </FormField>
                    </ColumnLayout>
                    <FormField label="URL du document *" description="Lien direct vers le fichier (Supabase Storage, Google Drive partagé, etc.)">
                      <Input value={newDoc.url} onChange={({ detail }) => setNewDoc((d) => ({ ...d, url: detail.value }))} placeholder="https://…" />
                    </FormField>
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2" counter={`(${documents.length})`}>Documents enregistrés</Header>}>
                  {documents.length === 0 ? (
                    <Alert type="info">Aucun document ajouté.</Alert>
                  ) : (
                    <SpaceBetween size="s">
                      {documents.map((doc) => (
                        <ColumnLayout key={doc.id} columns={4} variant="text-grid">
                          <Box>
                            <Box color="text-label" fontSize="body-s">Nom</Box>
                            <Box fontWeight="bold">{doc.name}</Box>
                          </Box>
                          <Box>
                            <Box color="text-label" fontSize="body-s">Type</Box>
                            <Badge color="blue">{DOC_TYPE_OPTIONS.find((o) => o.value === doc.type)?.label ?? doc.type}</Badge>
                          </Box>
                          <Box>
                            <Box color="text-label" fontSize="body-s">URL</Box>
                            <span style={{ color: 'var(--color-text-body-secondary)', wordBreak: 'break-all', fontSize: '12px' }}>
                              {doc.url.length > 50 ? `${doc.url.substring(0, 50)}…` : doc.url}
                            </span>
                          </Box>
                          <Box>
                            <Button variant="link" onClick={() => removeDocument(doc.id)}>Supprimer</Button>
                          </Box>
                        </ColumnLayout>
                      ))}
                    </SpaceBetween>
                  )}
                </Container>
              </SpaceBetween>
            ),
          },
        ]}
      />
    </SpaceBetween>
  );
}
