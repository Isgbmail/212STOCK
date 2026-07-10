import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Button, Tabs, Container, ColumnLayout,
  FormField, Input, Textarea, Select, Flashbar, Box,
  Checkbox, Toggle, Badge, Grid, TextContent, Alert,
  StatusIndicator,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Listes de référence ───────────────────────────────────────────────────────
const CERTIF_OPTIONS = [
  'HACCP', 'ISO 22000', 'IFS Food', 'BRC/BRCGS', 'FSSC 22000',
  'Bio', 'Halal', 'Kasher', 'Fairtrade', 'ECOCERT', 'GlobalG.A.P.', 'ONSSA',
];

const PAYMENT_OPTIONS = [
  { value: 'prepayment', label: 'Prépaiement' },
  { value: '30_days',    label: '30 jours nets' },
  { value: '45_days',    label: '45 jours nets' },
  { value: '60_days',    label: '60 jours nets' },
  { value: '90_days',    label: '90 jours nets' },
  { value: 'wire',       label: 'Virement bancaire' },
  { value: 'cheque',     label: 'Chèque' },
];

const DELIVERY_OPTIONS = [
  { value: 'express',   label: 'Express (J+1/J+2)' },
  { value: 'standard',  label: 'Standard (3-5 jours)' },
  { value: 'pallet',    label: 'Palette / Fret' },
  { value: 'cold',      label: 'Chaîne du froid' },
  { value: 'bulk',      label: 'Vrac' },
  { value: 'pickup',    label: 'Retrait entrepôt' },
  { value: 'freight',   label: 'Transport international' },
];

const INCOTERM_OPTIONS = [
  'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
  'FAS', 'FOB', 'CFR', 'CIF',
];

const COUNTRY_OPTIONS = [
  'France', 'Belgique', 'Luxembourg', 'Suisse', 'Allemagne', 'Espagne',
  'Portugal', 'Italie', 'Pays-Bas', 'Royaume-Uni', 'Maroc', 'Algérie',
  'Tunisie', 'Sénégal', 'Côte d\'Ivoire', 'Canada', 'UAE', 'USA',
];

const VENDOR_SUBTYPES = [
  { value: 'fabricant',    label: 'Fabricant / Producteur' },
  { value: 'importateur',  label: 'Importateur / Exportateur' },
  { value: 'grossiste',    label: 'Grossiste / Distributeur' },
  { value: 'revendeur',    label: 'Revendeur / Négociant' },
  { value: 'cooperative',  label: 'Coopérative' },
  { value: 'agent',        label: 'Agent / Mandataire' },
  { value: 'torrefacteur', label: 'Torréfacteur' },
  { value: 'conserverie',  label: 'Conserverie' },
  { value: 'artisan',      label: 'Artisan-producteur' },
];

// ─── Helper score de complétude ───────────────────────────────────────────────
function completenessScore(form: SellerForm): number {
  const checks = [
    !!form.description && form.description.length > 50,
    !!form.website,
    form.certifications.length > 0,
    form.accepted_payment_terms.length > 0,
    form.default_prep_days > 0,
    form.default_delivery_methods.length > 0,
    form.default_incoterms.length > 0,
    form.default_export_countries.length > 0,
    !!form.sub_type,
    !!form.city,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SellerForm {
  // org
  name: string;
  sub_type: string;
  city: string;
  country: string;
  region: string;
  postal_code: string;
  // seller_profiles
  description: string;
  website: string;
  certifications: string[];
  accepted_payment_terms: string[];
  default_prep_days: number;
  default_moq: string;
  default_franco_eur: string;
  default_delivery_methods: string[];
  default_incoterms: string[];
  default_export_countries: string[];
}

const EMPTY: SellerForm = {
  name: '', sub_type: '', city: '', country: 'FR', region: '', postal_code: '',
  description: '', website: '',
  certifications: [], accepted_payment_terms: [],
  default_prep_days: 3, default_moq: '', default_franco_eur: '',
  default_delivery_methods: [], default_incoterms: [], default_export_countries: [],
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VendorBoutique() {
  const { activeOrg } = useAuth();

  const [form, setForm] = useState<SellerForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; content: string } | null>(null);

  function showFlash(type: 'success' | 'error', content: string) {
    setFlash({ type, content });
    setTimeout(() => setFlash(null), 4000);
  }

  function set<K extends keyof SellerForm>(key: K, val: SellerForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleArray(key: 'certifications' | 'accepted_payment_terms' | 'default_delivery_methods' | 'default_incoterms' | 'default_export_countries', value: string, checked: boolean) {
    setForm(f => ({
      ...f,
      [key]: checked
        ? [...f[key], value]
        : (f[key] as string[]).filter(v => v !== value),
    }));
  }

  // ── Chargement initial ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeOrg) return;
    Promise.all([
      supabase.from('organisations').select('*').eq('id', activeOrg.id).single(),
      supabase.from('seller_profiles').select('*').eq('organisation_id', activeOrg.id).maybeSingle(),
    ]).then(([orgRes, spRes]) => {
      const o = orgRes.data ?? {};
      const sp = spRes.data ?? {};
      setForm({
        name:          o.name         ?? '',
        sub_type:      o.sub_type     ?? '',
        city:          o.city         ?? '',
        country:       o.country      ?? 'FR',
        region:        o.region       ?? '',
        postal_code:   o.postal_code  ?? '',
        description:   sp.description ?? '',
        website:       sp.website     ?? '',
        certifications:            sp.certifications            ?? [],
        accepted_payment_terms:    sp.accepted_payment_terms    ?? [],
        default_prep_days:         sp.default_prep_days         ?? 3,
        default_moq:               sp.default_moq               ? String(sp.default_moq) : '',
        default_franco_eur:        sp.default_franco_eur        ? String(sp.default_franco_eur) : '',
        default_delivery_methods:  sp.default_delivery_methods  ?? [],
        default_incoterms:         sp.default_incoterms         ?? [],
        default_export_countries:  sp.default_export_countries  ?? [],
      });
    });
  }, [activeOrg]);

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  async function save() {
    if (!activeOrg) return;
    setSaving(true);
    const [orgErr, spErr] = await Promise.all([
      supabase.from('organisations').update({
        name:        form.name,
        sub_type:    form.sub_type   || null,
        city:        form.city       || null,
        country:     form.country    || null,
        region:      form.region     || null,
        postal_code: form.postal_code || null,
      }).eq('id', activeOrg.id).then(r => r.error),

      supabase.from('seller_profiles').upsert({
        organisation_id:           activeOrg.id,
        description:               form.description               || null,
        website:                   form.website                   || null,
        certifications:            form.certifications,
        accepted_payment_terms:    form.accepted_payment_terms,
        default_prep_days:         form.default_prep_days         || 3,
        default_moq:               form.default_moq               ? parseInt(form.default_moq) : null,
        default_franco_eur:        form.default_franco_eur        ? parseFloat(form.default_franco_eur) : null,
        default_delivery_methods:  form.default_delivery_methods,
        default_incoterms:         form.default_incoterms,
        default_export_countries:  form.default_export_countries,
      }, { onConflict: 'organisation_id' }).then(r => r.error),
    ]);

    setSaving(false);
    if (orgErr || spErr) showFlash('error', (orgErr ?? spErr)?.message ?? 'Erreur de sauvegarde');
    else showFlash('success', 'Votre vitrine a été mise à jour avec succès.');
  }

  const score = completenessScore(form);
  const scoreColor = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';

  return (
    <SpaceBetween size="l">
      {/* En-tête */}
      <Header
        variant="h1"
        description="Contrôlez les informations affichées sur votre boutique publique Stock212."
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            {activeOrg && (
              <Button
                variant="normal"
                href={`/boutiques/${activeOrg.id}`}
                target="_blank"
                iconName="external"
              >
                Aperçu boutique
              </Button>
            )}
            <Button variant="primary" onClick={save} loading={saving}>
              Enregistrer les modifications
            </Button>
          </SpaceBetween>
        }
      >
        Ma vitrine
      </Header>

      {flash && (
        <Flashbar items={[{
          type: flash.type, content: flash.content,
          id: '1', dismissible: true, onDismiss: () => setFlash(null),
        }]} />
      )}

      {/* Score de complétude */}
      <Container>
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">Complétude de votre profil boutique</Box>
          <SpaceBetween direction="horizontal" size="m" alignItems="center">
            <StatusIndicator type={scoreColor}>
              {score}% — {score >= 80 ? 'Profil complet' : score >= 50 ? 'À compléter' : 'Profil incomplet'}
            </StatusIndicator>
            <TextContent>
              <small style={{ color: '#5f6b7a' }}>
                Un profil complet améliore votre visibilité et la confiance des acheteurs.
              </small>
            </TextContent>
          </SpaceBetween>
          {score < 80 && (
            <Alert type="info" statusIconAriaLabel="Info">
              {score < 50
                ? 'Complétez votre description, certifications et modes de livraison pour apparaître dans les résultats de recherche.'
                : 'Ajoutez les informations manquantes pour atteindre un profil optimal.'}
            </Alert>
          )}
        </SpaceBetween>
      </Container>

      {/* Onglets */}
      <Tabs
        tabs={[
          // ── Tab 1 : Présentation ──────────────────────────────────────────
          {
            id: 'presentation',
            label: 'Présentation',
            content: (
              <Container header={<Header variant="h2">Identité de la boutique</Header>}>
                <SpaceBetween size="l">
                  <ColumnLayout columns={2}>
                    <FormField label="Raison sociale" description="Nom affiché sur votre boutique">
                      <Input value={form.name} onChange={e => set('name', e.detail.value)} />
                    </FormField>
                    <FormField label="Type de vendeur">
                      <Select
                        selectedOption={VENDOR_SUBTYPES.find(o => o.value === form.sub_type) ?? null}
                        options={VENDOR_SUBTYPES}
                        onChange={e => set('sub_type', e.detail.selectedOption?.value ?? '')}
                        placeholder="Sélectionner..."
                      />
                    </FormField>
                  </ColumnLayout>

                  <FormField
                    label="Description publique"
                    description={`${form.description.length}/1000 caractères — Présentez votre activité, vos marchés, vos points forts.`}
                  >
                    <Textarea
                      value={form.description}
                      onChange={e => set('description', e.detail.value)}
                      placeholder="Nous sommes un distributeur spécialisé en produits agroalimentaires depuis 1998, couvrant la région Grand-Est. Notre catalogue de 400+ références couvre les rayons épicerie, boissons et hygiène..."
                      rows={5}
                    />
                  </FormField>

                  <FormField label="Site web" description="Lien vers votre site commercial (https://)">
                    <Input
                      value={form.website}
                      onChange={e => set('website', e.detail.value)}
                      placeholder="https://www.votre-site.com"
                      type="url"
                    />
                  </FormField>

                  <ColumnLayout columns={2}>
                    <FormField label="Pays">
                      <Select
                        selectedOption={{ value: form.country, label: form.country }}
                        options={[
                          { value: 'FR', label: 'France' }, { value: 'BE', label: 'Belgique' },
                          { value: 'LU', label: 'Luxembourg' }, { value: 'CH', label: 'Suisse' },
                          { value: 'MA', label: 'Maroc' }, { value: 'DZ', label: 'Algérie' },
                          { value: 'TN', label: 'Tunisie' }, { value: 'DE', label: 'Allemagne' },
                          { value: 'ES', label: 'Espagne' }, { value: 'IT', label: 'Italie' },
                        ]}
                        onChange={e => set('country', e.detail.selectedOption?.value ?? '')}
                      />
                    </FormField>
                    <FormField label="Ville">
                      <Input value={form.city} onChange={e => set('city', e.detail.value)} placeholder="Paris" />
                    </FormField>
                  </ColumnLayout>

                  <ColumnLayout columns={2}>
                    <FormField label="Région">
                      <Input value={form.region} onChange={e => set('region', e.detail.value)} placeholder="Île-de-France" />
                    </FormField>
                    <FormField label="Code postal">
                      <Input value={form.postal_code} onChange={e => set('postal_code', e.detail.value)} placeholder="75001" />
                    </FormField>
                  </ColumnLayout>
                </SpaceBetween>
              </Container>
            ),
          },

          // ── Tab 2 : Certifications ────────────────────────────────────────
          {
            id: 'certifications',
            label: `Certifications (${form.certifications.length})`,
            content: (
              <Container header={<Header variant="h2" description="Les certifications renforcent la confiance des acheteurs et votre visibilité dans les filtres.">Certifications & qualité</Header>}>
                <SpaceBetween size="l">
                  <Alert type="info" statusIconAriaLabel="Info">
                    Cochez uniquement les certifications officiellement obtenues. Des documents justificatifs pourront être demandés par l'équipe Stock212.
                  </Alert>
                  <Grid gridDefinition={[
                    { colspan: 6 }, { colspan: 6 },
                  ]}>
                    <SpaceBetween size="m">
                      <Box variant="awsui-key-label">Normes de sécurité alimentaire</Box>
                      {['HACCP', 'ISO 22000', 'FSSC 22000', 'IFS Food', 'BRC/BRCGS', 'ONSSA'].map(c => (
                        <Checkbox
                          key={c}
                          checked={form.certifications.includes(c)}
                          onChange={e => toggleArray('certifications', c, e.detail.checked)}
                        >
                          <SpaceBetween direction="horizontal" size="xs">
                            <span>{c}</span>
                            {form.certifications.includes(c) && <Badge color="green">Actif</Badge>}
                          </SpaceBetween>
                        </Checkbox>
                      ))}
                    </SpaceBetween>
                    <SpaceBetween size="m">
                      <Box variant="awsui-key-label">Labels & engagements</Box>
                      {['Bio', 'Halal', 'Kasher', 'Fairtrade', 'ECOCERT', 'GlobalG.A.P.'].map(c => (
                        <Checkbox
                          key={c}
                          checked={form.certifications.includes(c)}
                          onChange={e => toggleArray('certifications', c, e.detail.checked)}
                        >
                          <SpaceBetween direction="horizontal" size="xs">
                            <span>{c}</span>
                            {form.certifications.includes(c) && <Badge color="green">Actif</Badge>}
                          </SpaceBetween>
                        </Checkbox>
                      ))}
                    </SpaceBetween>
                  </Grid>

                  {form.certifications.length > 0 && (
                    <Box>
                      <Box variant="awsui-key-label">Sélectionnées ({form.certifications.length})</Box>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {form.certifications.map(c => (
                          <Badge key={c} color="green">{c}</Badge>
                        ))}
                      </div>
                    </Box>
                  )}
                </SpaceBetween>
              </Container>
            ),
          },

          // ── Tab 3 : Conditions commerciales ──────────────────────────────
          {
            id: 'conditions',
            label: 'Conditions commerciales',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Paiement & délais</Header>}>
                  <SpaceBetween size="l">
                    <FormField
                      label="Conditions de paiement acceptées"
                      description="Les acheteurs verront les délais que vous proposez."
                    >
                      <SpaceBetween size="xs">
                        {PAYMENT_OPTIONS.map(({ value, label }) => (
                          <Checkbox
                            key={value}
                            checked={form.accepted_payment_terms.includes(value)}
                            onChange={e => toggleArray('accepted_payment_terms', value, e.detail.checked)}
                          >
                            {label}
                          </Checkbox>
                        ))}
                      </SpaceBetween>
                    </FormField>

                    <ColumnLayout columns={3}>
                      <FormField
                        label="Délai de préparation (j. ouvrés)"
                        description="Temps entre commande et expédition"
                      >
                        <Input
                          value={String(form.default_prep_days)}
                          onChange={e => set('default_prep_days', parseInt(e.detail.value) || 0)}
                          type="number"
                        />
                      </FormField>
                      <FormField
                        label="MOQ (qté min. de commande)"
                        description="En unités produits"
                      >
                        <Input
                          value={form.default_moq}
                          onChange={e => set('default_moq', e.detail.value)}
                          type="number"
                          placeholder="Ex : 50"
                        />
                      </FormField>
                      <FormField
                        label="Franco de port (€)"
                        description="Montant minimum pour livraison offerte"
                      >
                        <Input
                          value={form.default_franco_eur}
                          onChange={e => set('default_franco_eur', e.detail.value)}
                          type="number"
                          placeholder="Ex : 500"
                        />
                      </FormField>
                    </ColumnLayout>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },

          // ── Tab 4 : Livraison & zones ─────────────────────────────────────
          {
            id: 'livraison',
            label: 'Livraison & export',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Modes de livraison</Header>}>
                  <SpaceBetween size="m">
                    {DELIVERY_OPTIONS.map(({ value, label }) => (
                      <Toggle
                        key={value}
                        checked={form.default_delivery_methods.includes(value)}
                        onChange={e => toggleArray('default_delivery_methods', value, e.detail.checked)}
                      >
                        {label}
                      </Toggle>
                    ))}
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2" description="Incoterms de référence que vous utilisez avec vos clients B2B.">Incoterms acceptés</Header>}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {INCOTERM_OPTIONS.map(t => (
                      <div
                        key={t}
                        onClick={() => toggleArray('default_incoterms', t, !form.default_incoterms.includes(t))}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '4px',
                          border: form.default_incoterms.includes(t) ? '2px solid #0972d3' : '1px solid #c6c6c6',
                          background: form.default_incoterms.includes(t) ? '#f0f7ff' : 'white',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          fontWeight: form.default_incoterms.includes(t) ? '700' : '400',
                          color: form.default_incoterms.includes(t) ? '#0972d3' : '#414d5c',
                          userSelect: 'none',
                          fontSize: '13px',
                        }}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </Container>

                <Container header={<Header variant="h2" description="Pays où vous pouvez expédier. Visible sur votre boutique.">Zones d'export couvertes</Header>}>
                  <SpaceBetween size="m">
                    <Alert type="info" statusIconAriaLabel="Info">
                      Sélectionnez les pays que vous livrez. Cela aide les acheteurs internationaux à vous trouver.
                    </Alert>
                    <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
                      {[0, 1, 2].map(col => (
                        <SpaceBetween key={col} size="xs">
                          {COUNTRY_OPTIONS.filter((_, i) => i % 3 === col).map(c => (
                            <Checkbox
                              key={c}
                              checked={form.default_export_countries.includes(c)}
                              onChange={e => toggleArray('default_export_countries', c, e.detail.checked)}
                            >
                              {c}
                            </Checkbox>
                          ))}
                        </SpaceBetween>
                      ))}
                    </Grid>
                    {form.default_export_countries.length > 0 && (
                      <Box>
                        <Box variant="awsui-key-label">Pays sélectionnés ({form.default_export_countries.length})</Box>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {form.default_export_countries.map(c => <Badge key={c} color="blue">{c}</Badge>)}
                        </div>
                      </Box>
                    )}
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },
        ]}
      />

      {/* Bouton bas de page */}
      <Box float="right">
        <Button variant="primary" onClick={save} loading={saving}>
          Enregistrer les modifications
        </Button>
      </Box>
    </SpaceBetween>
  );
}
