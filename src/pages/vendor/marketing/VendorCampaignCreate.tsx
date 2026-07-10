import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ContentLayout, Header, Container, SpaceBetween, Form,
  FormField, Input, Select, DatePicker, Button, Alert,
  ColumnLayout, Box, Toggle, Textarea,
} from '@cloudscape-design/components';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { createCampaignWithChecks, getSellerBalance, getCreditCost, daysBetween, computeCampaignBudget, formatCredits } from '../../../lib/marketingHelpers';
import type { CampaignType, CampaignScopeType } from '../../../types/marketing';

const TYPES: { label: string; value: CampaignType; description: string; group?: string }[] = [
  // ── Sponsoring classique
  { label: 'Produit sponsorisé',         value: 'sponsored_product',   description: 'Mettez en avant un produit dans les résultats de recherche',           group: 'Sponsoring' },
  { label: 'Marque sponsorisée',          value: 'sponsored_brand',     description: 'Bannière de marque en haut des pages catégorie',                        group: 'Sponsoring' },
  { label: 'Catégorie sponsorisée',       value: 'sponsored_category',  description: 'Visibilité prioritaire dans une catégorie',                             group: 'Sponsoring' },
  { label: 'Boutique sponsorisée',        value: 'sponsored_boutique',  description: 'Mettez votre boutique en vedette sur la page Boutiques',                group: 'Sponsoring' },
  { label: 'Déstockage',                  value: 'destocking',          description: 'Lot de déstockage (enchère ou prix fixe)',                               group: 'Promotions' },
  { label: 'Offre volume',                value: 'volume_deal',         description: 'Remise progressive selon la quantité commandée',                         group: 'Promotions' },
  { label: 'Code promo',                  value: 'promo_code',          description: 'Code de réduction pour vos acheteurs',                                   group: 'Promotions' },
  { label: 'Trade deal',                  value: 'trade_deal',          description: 'Accord commercial personnalisé avec un acheteur',                        group: 'Promotions' },
  { label: 'Flash sale',                  value: 'flash_sale',          description: 'Vente flash limitée dans le temps',                                      group: 'Promotions' },
  { label: 'Échantillon digital',         value: 'digital_sampling',    description: 'Envoyez des échantillons à des acheteurs qualifiés',                     group: 'Promotions' },
  { label: 'Boost RFQ',                   value: 'rfq_boost',           description: 'Boostez votre réponse à un appel d\'offres',                             group: 'Promotions' },
  { label: 'Cross-sell produit',          value: 'cross_sell',          description: 'Recommandez vos produits sur les fiches d\'autres articles',             group: 'Promotions' },
  // ── Blocs merchandising v2
  { label: '★ Bannière Hero (TopBanner)', value: 'top_banner',          description: 'Bannière pleine largeur en tête de homepage — slot premium (80 cr/j)',   group: 'Blocs homepage' },
  { label: '★ Deal of the Day',           value: 'deal_of_day',         description: 'Offre unique mise en avant 24h sur la homepage (120 cr/slot)',            group: 'Blocs homepage' },
  { label: '★ Bannière Footer',           value: 'footer_banner',       description: 'Bannière bas de page homepage (30 cr/j)',                                 group: 'Blocs homepage' },
  { label: '★ Remise Supplémentaire',     value: 'extra_remise',        description: 'Bloc visuel code promo / remise sur homepage (15 cr/j)',                  group: 'Blocs homepage' },
  { label: '★ Ligne catégorie',           value: 'category_row',        description: 'Ligne de produits de votre catégorie sponsorisée (20 cr/j)',              group: 'Blocs homepage' },
  { label: '★ Slot recommandé',           value: 'recommended_slot',    description: 'Apparaître dans les recommandations personnalisées acheteur (12 cr/j)',   group: 'Blocs homepage' },
  { label: '★ Sponsorisé dans recherche', value: 'search_sponsored',    description: 'Vos produits injectés en tête des résultats de recherche (10 cr/j)',     group: 'Blocs catalogue' },
  { label: '★ Cross-sell panier',         value: 'cart_cross_sell',     description: 'Recommandez vos produits sur la page panier acheteur (5 cr/j)',          group: 'Blocs catalogue' },
];

const PLACEMENTS = [
  { label: 'Barre latérale produit',          value: 'product_sidebar' },
  { label: 'Résultats recherche',              value: 'search_results' },
  { label: 'Tête de page catégorie',           value: 'category_top' },
  { label: 'Page d\'accueil — bannière',       value: 'homepage_banner' },
  { label: 'Email hebdomadaire',               value: 'email_weekly' },
  { label: 'Cross-sell widget',                value: 'cross_sell_widget' },
  // v2 blocs
  { label: 'Homepage — Bannière hero',         value: 'homepage_top_banner' },
  { label: 'Homepage — Deal of the Day',       value: 'homepage_deal_of_day' },
  { label: 'Homepage — Bannière footer',       value: 'homepage_footer_banner' },
  { label: 'Homepage — Remise extra',          value: 'homepage_extra_remise' },
  { label: 'Homepage — Ligne catégorie',       value: 'homepage_category_row' },
  { label: 'Homepage — Recommandations',       value: 'homepage_recommended' },
  { label: 'Catalogue — Produits sponsorisés', value: 'search_sponsored' },
  { label: 'Panier — Cross-sell',              value: 'cart_cross_sell' },
];

export default function VendorCampaignCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [type, setType] = useState<CampaignType>('sponsored_product');
  const [name, setName] = useState('');
  const [placement, setPlacement] = useState('product_sidebar');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dailyCredits, setDailyCredits] = useState(0);
  const [scopeType, setScopeType] = useState<CampaignScopeType>('item');
  const [scopeValue, setScopeValue] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [balance, setBalance] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) getSellerBalance(user.id).then(setBalance);
  }, [user]);

  useEffect(() => {
    const costKeys: Partial<Record<CampaignType, string>> = {
      sponsored_product:  'sponsored_product_per_day',
      sponsored_brand:    'sponsored_brand_per_day',
      sponsored_category: 'sponsored_category_per_day',
      sponsored_boutique: 'sponsored_boutique_per_day',
      flash_sale:         'flash_sale_per_day',
      digital_sampling:   'digital_sample_per_unit',
      rfq_boost:          'rfq_bid_boost',
      cross_sell:         'cross_sell_per_day',
      // v2 blocs
      top_banner:         'top_banner_per_day',
      deal_of_day:        'deal_of_day_per_slot',
      footer_banner:      'footer_banner_per_day',
      extra_remise:       'extra_remise_per_day',
      category_row:       'category_row_per_day',
      recommended_slot:   'recommended_slot_per_day',
      search_sponsored:   'search_sponsored_per_day',
      cart_cross_sell:    'cart_cross_sell_per_day',
    };
    const key = costKeys[type];
    if (key) getCreditCost(key).then(cost => { setDailyCredits(cost); setUnitCost(cost); });
    else { setDailyCredits(0); setUnitCost(0); }

    // Auto-sélection du placement par défaut selon le type
    const defaultPlacements: Partial<Record<CampaignType, string>> = {
      top_banner:       'homepage_top_banner',
      deal_of_day:      'homepage_deal_of_day',
      footer_banner:    'homepage_footer_banner',
      extra_remise:     'homepage_extra_remise',
      category_row:     'homepage_category_row',
      recommended_slot: 'homepage_recommended',
      search_sponsored: 'search_sponsored',
      cart_cross_sell:  'cart_cross_sell',
    };
    if (defaultPlacements[type]) setPlacement(defaultPlacements[type]!);
  }, [type]);

  const duration = startDate && endDate ? daysBetween(startDate, endDate) : 1;
  const totalBudget = computeCampaignBudget(type, dailyCredits, duration);
  const canAfford = balance >= totalBudget;
  const typeInfo = TYPES.find(t => t.value === type)!;

  const handleSubmit = async () => {
    if (!user || !name || !startDate) { setError('Remplissez tous les champs obligatoires.'); return; }
    setSubmitting(true); setError('');
    const result = await createCampaignWithChecks({
      seller_id: user.id,
      type,
      name,
      scope_type: scopeType,
      scope_value: scopeValue || undefined,
      placement,
      budget_credits: totalBudget,
      daily_credits: dailyCredits,
      start_date: startDate,
      end_date: endDate || undefined,
      metadata,
    });
    if (!result.success) { setError(result.error ?? 'Erreur création campagne'); setSubmitting(false); return; }
    navigate('/vendor/marketing/campaigns');
  };

  return (
    <ContentLayout header={<Header variant="h1">Créer une campagne</Header>}>
      <Form
        errorText={error}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => navigate('/vendor/marketing/campaigns')}>Annuler</Button>
            <Button variant="primary" loading={submitting} disabled={!canAfford || !name || !startDate} onClick={handleSubmit}>
              Lancer la campagne — {formatCredits(totalBudget)}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          {/* Solde */}
          <Container>
            <ColumnLayout columns={2}>
              <div><Box variant="awsui-key-label">Solde disponible</Box><Box fontSize="heading-xl" fontWeight="bold" color={canAfford ? 'text-status-success' : 'text-status-error'}>{balance.toFixed(2)} cr.</Box></div>
              <div><Box variant="awsui-key-label">Budget estimé</Box><Box fontSize="heading-xl" fontWeight="bold">{totalBudget.toFixed(2)} cr.</Box></div>
            </ColumnLayout>
            {!canAfford && <Alert type="error">Solde insuffisant. <a href="/vendor/marketing/credits">Recharger des crédits</a></Alert>}
          </Container>

          {/* Type de campagne */}
          <Container header={<Header variant="h2">Type de campagne</Header>}>
            <SpaceBetween size="m">
              <FormField label="Type" description={typeInfo.description}>
                <Select
                  selectedOption={{ label: typeInfo.label, value: type }}
                  options={TYPES.map(t => ({ label: t.label, value: t.value, description: t.description }))}
                  onChange={e => setType(e.detail.selectedOption.value as CampaignType)}
                />
              </FormField>
              <FormField label="Nom de la campagne" constraintText="Utilisé en interne pour l'identifier">
                <Input value={name} onChange={e => setName(e.detail.value)} placeholder="Ex: Promo été — Huile d'argan" />
              </FormField>
            </SpaceBetween>
          </Container>

          {/* Ciblage */}
          {[
            'sponsored_product', 'sponsored_brand', 'sponsored_category', 'sponsored_boutique',
            'cross_sell', 'search_sponsored', 'cart_cross_sell', 'recommended_slot',
          ].includes(type) && (
            <Container header={<Header variant="h2">Ciblage</Header>}>
              <SpaceBetween size="m">
                <FormField label="Emplacement publicitaire">
                  <Select
                    selectedOption={PLACEMENTS.find(p => p.value === placement) ?? PLACEMENTS[0]}
                    options={PLACEMENTS}
                    onChange={e => setPlacement(e.detail.selectedOption.value ?? 'product_sidebar')}
                  />
                </FormField>
                <ColumnLayout columns={2}>
                  <FormField label="Type de portée">
                    <Select
                      selectedOption={{ label: scopeType, value: scopeType }}
                      options={[
                        { label: 'Produit', value: 'item' },
                        { label: 'Boutique', value: 'boutique' },
                        { label: 'Marque', value: 'brand' },
                        { label: 'Catégorie', value: 'category' },
                      ]}
                      onChange={e => setScopeType(e.detail.selectedOption.value as CampaignScopeType)}
                    />
                  </FormField>
                  <FormField label="ID de la portée">
                    <Input value={scopeValue} onChange={e => setScopeValue(e.detail.value)} placeholder="ID produit / catégorie..." />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          )}

          {/* Budget & durée */}
          <Container header={<Header variant="h2">Budget & durée</Header>}>
            <SpaceBetween size="m">
              <ColumnLayout columns={2}>
                <FormField label="Date de début">
                  <DatePicker value={startDate} onChange={e => setStartDate(e.detail.value)} placeholder="YYYY/MM/DD" />
                </FormField>
                {!['rfq_boost', 'rfq_bid_boost'].includes(type) && (
                  <FormField label="Date de fin">
                    <DatePicker value={endDate} onChange={e => setEndDate(e.detail.value)} placeholder="YYYY/MM/DD" />
                  </FormField>
                )}
              </ColumnLayout>
              <FormField label={type === 'digital_sampling' ? 'Coût par échantillon (cr.)' : 'Crédits par jour (cr.)'}>
                <Input type="number" value={String(dailyCredits)} onChange={e => setDailyCredits(Number(e.detail.value))} />
              </FormField>
              <Box>
                <strong>Budget total estimé :</strong> {totalBudget.toFixed(2)} crédits
                {startDate && endDate && ` (${duration} jour${duration > 1 ? 's' : ''} × ${dailyCredits} cr./jour)`}
              </Box>
            </SpaceBetween>
          </Container>

          {/* Métadonnées spécifiques */}
          {type === 'volume_deal' && (
            <Container header={<Header variant="h2">Paramètres de l'offre volume</Header>}>
              <SpaceBetween size="m">
                <FormField label="Seuil de quantité minimum">
                  <Input type="number" value={String(metadata.min_quantity ?? 10)} onChange={e => setMetadata(p => ({ ...p, min_quantity: Number(e.detail.value) }))} />
                </FormField>
                <FormField label="Remise (%)">
                  <Input type="number" value={String(metadata.discount_pct ?? 5)} onChange={e => setMetadata(p => ({ ...p, discount_pct: Number(e.detail.value) }))} />
                </FormField>
              </SpaceBetween>
            </Container>
          )}
          {type === 'promo_code' && (
            <Container header={<Header variant="h2">Paramètres code promo</Header>}>
              <SpaceBetween size="m">
                <FormField label="Code promo">
                  <Input value={String(metadata.code ?? '')} onChange={e => setMetadata(p => ({ ...p, code: e.detail.value }))} placeholder="SUMMER25" />
                </FormField>
                <FormField label="Remise (%)">
                  <Input type="number" value={String(metadata.discount_pct ?? 10)} onChange={e => setMetadata(p => ({ ...p, discount_pct: Number(e.detail.value) }))} />
                </FormField>
                <FormField label="Max utilisations">
                  <Input type="number" value={String(metadata.max_uses ?? 100)} onChange={e => setMetadata(p => ({ ...p, max_uses: Number(e.detail.value) }))} />
                </FormField>
              </SpaceBetween>
            </Container>
          )}
          {type === 'flash_sale' && (
            <Container header={<Header variant="h2">Paramètres flash sale</Header>}>
              <FormField label="Remise flash (%)">
                <Input type="number" value={String(metadata.discount_pct ?? 20)} onChange={e => setMetadata(p => ({ ...p, discount_pct: Number(e.detail.value) }))} />
              </FormField>
            </Container>
          )}
          {type === 'digital_sampling' && (
            <Container header={<Header variant="h2">Paramètres échantillonnage</Header>}>
              <SpaceBetween size="m">
                <FormField label="ID produit à échantillonner">
                  <Input value={String(metadata.product_id ?? '')} onChange={e => setMetadata(p => ({ ...p, product_id: e.detail.value }))} />
                </FormField>
                <FormField label="Max échantillons à envoyer">
                  <Input type="number" value={String(metadata.max_samples ?? 50)} onChange={e => setMetadata(p => ({ ...p, max_samples: Number(e.detail.value) }))} />
                </FormField>
                <FormField label="Approbation automatique">
                  <Toggle checked={Boolean(metadata.auto_approve)} onChange={e => setMetadata(p => ({ ...p, auto_approve: e.detail.checked }))} />
                </FormField>
              </SpaceBetween>
            </Container>
          )}

          {/* ─── Blocs Merchandising v2 ─────────────────────────────────── */}

          {(type === 'top_banner' || type === 'footer_banner') && (
            <Container header={<Header variant="h2">Contenu de la bannière</Header>}>
              <SpaceBetween size="m">
                <Alert type="info">
                  Formats recommandés — Image : 1400 × 400 px (WebP/JPG). Texte : titre max 60 caractères, sous-titre max 120 caractères.
                </Alert>
                <ColumnLayout columns={2}>
                  <FormField label="URL de l'image de fond" description="Laissez vide pour utiliser la couleur de fond">
                    <Input value={String(metadata.image_url ?? '')} placeholder="https://cdn.exemple.com/banner.jpg"
                      onChange={e => setMetadata(p => ({ ...p, image_url: e.detail.value }))} />
                  </FormField>
                  <FormField label="Couleur de fond" description="Ex: #0d1f38 ou gradient CSS">
                    <Input value={String(metadata.bg_color ?? '')} placeholder="#0d1f38"
                      onChange={e => setMetadata(p => ({ ...p, bg_color: e.detail.value }))} />
                  </FormField>
                  <FormField label="Titre (headline)">
                    <Input value={String(metadata.headline ?? '')} placeholder="Notre nouvelle gamme Bio est disponible"
                      onChange={e => setMetadata(p => ({ ...p, headline: e.detail.value }))} />
                  </FormField>
                  <FormField label="Sous-titre (subline)">
                    <Input value={String(metadata.subline ?? '')} placeholder="Certifié ECOCERT · Livraison France"
                      onChange={e => setMetadata(p => ({ ...p, subline: e.detail.value }))} />
                  </FormField>
                  {type === 'top_banner' && (
                    <>
                      <FormField label="Texte du bouton CTA">
                        <Input value={String(metadata.cta_text ?? '')} placeholder="Découvrir"
                          onChange={e => setMetadata(p => ({ ...p, cta_text: e.detail.value }))} />
                      </FormField>
                      <FormField label="Lien du bouton CTA">
                        <Input value={String(metadata.cta_link ?? '')} placeholder="/catalog?brand=ma-marque"
                          onChange={e => setMetadata(p => ({ ...p, cta_link: e.detail.value }))} />
                      </FormField>
                    </>
                  )}
                  {type === 'footer_banner' && (
                    <FormField label="Lien de la bannière">
                      <Input value={String(metadata.cta_link ?? '')} placeholder="/catalog"
                        onChange={e => setMetadata(p => ({ ...p, cta_link: e.detail.value }))} />
                    </FormField>
                  )}
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          )}

          {type === 'deal_of_day' && (
            <Container header={<Header variant="h2">Paramètres Deal of the Day</Header>}>
              <SpaceBetween size="m">
                <Alert type="info">
                  Un seul Deal of the Day actif à la fois. En cas de conflit, le budget le plus élevé est prioritaire.
                </Alert>
                <ColumnLayout columns={2}>
                  <FormField label="ID du produit mis en avant" constraintText="UUID du produit dans le catalogue">
                    <Input value={String(metadata.product_id ?? '')} placeholder="uuid-du-produit"
                      onChange={e => setMetadata(p => ({ ...p, product_id: e.detail.value }))} />
                  </FormField>
                  <FormField label="Quantités disponibles pour l'offre">
                    <Input type="number" value={String(metadata.available_qty ?? 50)}
                      onChange={e => setMetadata(p => ({ ...p, available_qty: Number(e.detail.value) }))} />
                  </FormField>
                  <FormField label="Prix spécial (€)" description="Prix affiché pendant le deal">
                    <Input type="number" value={String(metadata.special_price ?? '')} placeholder="9.90"
                      onChange={e => setMetadata(p => ({ ...p, special_price: Number(e.detail.value) }))} />
                  </FormField>
                  <FormField label="Prix barré original (€)">
                    <Input type="number" value={String(metadata.original_price ?? '')} placeholder="14.50"
                      onChange={e => setMetadata(p => ({ ...p, original_price: Number(e.detail.value) }))} />
                  </FormField>
                  <FormField label="Remise affichée (%)" description="Laissez vide pour calcul automatique">
                    <Input type="number" value={String(metadata.discount_pct ?? '')} placeholder="32"
                      onChange={e => setMetadata(p => ({ ...p, discount_pct: Number(e.detail.value) }))} />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          )}

          {type === 'extra_remise' && (
            <Container header={<Header variant="h2">Paramètres Remise Supplémentaire</Header>}>
              <SpaceBetween size="m">
                <ColumnLayout columns={2}>
                  <FormField label="Libellé affiché" description="Ex: -15% dès 500€">
                    <Input value={String(metadata.label ?? '')} placeholder="-15% dès 500 €"
                      onChange={e => setMetadata(p => ({ ...p, label: e.detail.value }))} />
                  </FormField>
                  <FormField label="Code promo" description="Laissez vide si sans code">
                    <Input value={String(metadata.code ?? '')} placeholder="STOCK15"
                      onChange={e => setMetadata(p => ({ ...p, code: e.detail.value }))} />
                  </FormField>
                  <FormField label="Remise (%)">
                    <Input type="number" value={String(metadata.discount_pct ?? 10)}
                      onChange={e => setMetadata(p => ({ ...p, discount_pct: Number(e.detail.value) }))} />
                  </FormField>
                  <FormField label="Commande minimum (€)">
                    <Input type="number" value={String(metadata.min_order ?? 0)} placeholder="500"
                      onChange={e => setMetadata(p => ({ ...p, min_order: Number(e.detail.value) }))} />
                  </FormField>
                  <FormField label="Couleur de l'accent" description="Hex CSS, ex: #0f766e">
                    <Input value={String(metadata.color ?? '')} placeholder="#0f766e"
                      onChange={e => setMetadata(p => ({ ...p, color: e.detail.value }))} />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          )}

          {type === 'category_row' && (
            <Container header={<Header variant="h2">Paramètres Ligne catégorie</Header>}>
              <SpaceBetween size="m">
                <ColumnLayout columns={2}>
                  <FormField label="ID de la catégorie" constraintText="UUID de la catégorie cible">
                    <Input value={String(metadata.category_id ?? '')} placeholder="uuid-catégorie"
                      onChange={e => setMetadata(p => ({ ...p, category_id: e.detail.value }))} />
                  </FormField>
                  <FormField label="Nom affiché de la catégorie">
                    <Input value={String(metadata.category_name ?? '')} placeholder="Épicerie fine"
                      onChange={e => setMetadata(p => ({ ...p, category_name: e.detail.value }))} />
                  </FormField>
                  <FormField label="Titre de la section (headline)">
                    <Input value={String(metadata.headline ?? '')} placeholder="Découvrez notre sélection Épicerie"
                      onChange={e => setMetadata(p => ({ ...p, headline: e.detail.value }))} />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Form>
    </ContentLayout>
  );
}
