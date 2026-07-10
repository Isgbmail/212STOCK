import { useEffect, useState, useCallback } from 'react';
import {
  ContentLayout, Header, Tabs, Container, SpaceBetween,
  ColumnLayout, FormField, Input, Select, Multiselect, Toggle, Button,
  Box, ExpandableSection, StatusIndicator, Badge, Spinner, Flashbar,
  Alert, Textarea,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PlatformSettings {
  id: string;
  // 1. Identité Stock212
  platform_name: string;
  platform_tagline: string;
  public_url: string;
  support_email: string;
  support_phone: string;
  maintenance_mode: boolean;
  default_language: string;
  available_languages: string[];
  default_currency: string;
  // 2. Offre commerciale aux vendeurs (clients de Stock212)
  vendor_manual_validation: boolean;
  vendor_required_docs: string[];
  vendor_min_score: number;
  vendor_max_products: number;
  vendor_max_dispute_pct: number;
  vendor_confirmation_hours: number;
  vendor_invoice_day: number;
  // 3. Règles de la marketplace (storefront vendeurs → acheteurs)
  intraeu_vat_enabled: boolean;
  vat_default_rate: number;
  cart_ttl_days: number;
  min_order_amount: number;
  global_moq: number;
  default_payment_terms: number;
  payment_methods: string[];
  buyer_manual_validation: boolean;
  buyer_max_active_quotes: number;
  quote_validity_days: number;
  buyer_min_order_for_tiers: number;
  delivery_default_fee: number;
  delivery_free_from: number;
  delivery_default_days: number;
  delivery_validation_days: number;
  // 4. Finance & Facturation Stock212
  stripe_mode: string;
  invoice_prefix: string;
  invoice_footer: string;
  bank_iban: string;
  bank_bic: string;
  // 5. Notifications & Communications
  notif_admin_email: string;
  notif_support_email: string;
  notif_push_enabled: boolean;
  notif_alert_disputes: boolean;
  notif_alert_registrations: boolean;
  notif_weekly_report: boolean;
  // 6. Sécurité & Audit
  security_session_hours: number;
  security_2fa_required: boolean;
  security_max_attempts: number;
  security_lockout_minutes: number;
  audit_logs_enabled: boolean;
  audit_retention_days: number;
  updated_at?: string;
}

const DEFAULTS: Omit<PlatformSettings, 'id' | 'updated_at'> = {
  platform_name: 'Stock212', platform_tagline: 'Marketplace B2B FMCG',
  public_url: 'https://stock212.com', support_email: 'support@stock212.com',
  support_phone: '', maintenance_mode: false, default_language: 'fr',
  available_languages: ['fr', 'en'], default_currency: 'EUR',
  vendor_manual_validation: true,
  vendor_required_docs: ['kbis', 'rib', 'assurance'],
  vendor_min_score: 0, vendor_max_products: 500, vendor_max_dispute_pct: 10,
  vendor_confirmation_hours: 48, vendor_invoice_day: 1,
  intraeu_vat_enabled: true, vat_default_rate: 20,
  cart_ttl_days: 30, min_order_amount: 0, global_moq: 1,
  default_payment_terms: 30, payment_methods: ['virement', 'cheque'],
  buyer_manual_validation: false, buyer_max_active_quotes: 10,
  quote_validity_days: 30, buyer_min_order_for_tiers: 1000,
  delivery_default_fee: 0, delivery_free_from: 5000,
  delivery_default_days: 5, delivery_validation_days: 7,
  stripe_mode: 'test', invoice_prefix: 'STK212',
  invoice_footer: 'Stock212 SAS — N° SIRET : 000 000 000 00000 — TVA FR00000000000',
  bank_iban: '', bank_bic: '',
  notif_admin_email: 'admin@stock212.com', notif_support_email: 'support@stock212.com',
  notif_push_enabled: true, notif_alert_disputes: true,
  notif_alert_registrations: true, notif_weekly_report: true,
  security_session_hours: 24, security_2fa_required: false,
  security_max_attempts: 5, security_lockout_minutes: 30,
  audit_logs_enabled: true, audit_retention_days: 90,
};

type F = Omit<PlatformSettings, 'id' | 'updated_at'>;

const DOC_OPTIONS = [
  { value: 'kbis',      label: 'Extrait Kbis ou équivalent (registre du commerce)' },
  { value: 'rib',       label: 'RIB / IBAN — domiciliation bancaire' },
  { value: 'assurance', label: 'Attestation assurance Responsabilité Civile Pro' },
  { value: 'haccp',     label: 'Certification sécurité alimentaire (HACCP / IFS / BRC)' },
  { value: 'bio',       label: 'Certificat Agriculture Biologique / Organic' },
  { value: 'halal',     label: 'Certificat Halal' },
  { value: 'cgv',       label: 'Signature des CGV Stock212' },
];

const PAYMENT_OPTIONS = [
  { value: 'virement',  label: 'Virement bancaire SEPA' },
  { value: 'cheque',    label: 'Chèque' },
  { value: 'carte',     label: 'Carte bancaire (via Stripe)' },
  { value: 'paypal',    label: 'PayPal' },
  { value: 'credit30',  label: 'Crédit 30 jours (B2B)' },
];

// ─── Setters génériques ────────────────────────────────────────────────────────
const mkNum = <K extends keyof F>(key: K, set: React.Dispatch<React.SetStateAction<F>>) =>
  (e: { detail: { value: string } }) => set(p => ({ ...p, [key]: Number(e.detail.value) }));
const mkStr = <K extends keyof F>(key: K, set: React.Dispatch<React.SetStateAction<F>>) =>
  (e: { detail: { value: string } }) => set(p => ({ ...p, [key]: e.detail.value }));
const mkBool = <K extends keyof F>(key: K, set: React.Dispatch<React.SetStateAction<F>>) =>
  (e: { detail: { checked: boolean } }) => set(p => ({ ...p, [key]: e.detail.checked }));

// ─── Onglet 1 — Identité Stock212 ────────────────────────────────────────────
function Tab1Identity({ f, set }: { f: F; set: React.Dispatch<React.SetStateAction<F>> }) {
  return (
    <SpaceBetween size="l">
      <Alert type="info">
        Ces paramètres définissent l'identité de <strong>Stock212 en tant qu'opérateur de plateforme</strong> — ils sont indépendants des comptes vendeurs et acheteurs.
      </Alert>

      <Container header={<Header variant="h2">Identité de la plateforme</Header>}>
        <ColumnLayout columns={2}>
          <FormField label="Nom commercial">
            <Input value={f.platform_name} onChange={mkStr('platform_name', set)} />
          </FormField>
          <FormField label="Tagline publique">
            <Input value={f.platform_tagline} onChange={mkStr('platform_tagline', set)} />
          </FormField>
          <FormField label="URL publique (domaine principal)">
            <Input value={f.public_url} onChange={mkStr('public_url', set)} />
          </FormField>
          <FormField label="Email de contact public">
            <Input value={f.support_email} onChange={mkStr('support_email', set)} />
          </FormField>
          <FormField label="Téléphone de contact public">
            <Input value={f.support_phone} onChange={mkStr('support_phone', set)} />
          </FormField>
        </ColumnLayout>
      </Container>

      <Container header={<Header variant="h2">Langue & Devise</Header>}>
        <ColumnLayout columns={2}>
          <FormField label="Langue d'interface par défaut">
            <Select
              selectedOption={{ value: f.default_language, label: { fr: 'Français', en: 'English', ar: 'العربية' }[f.default_language] ?? f.default_language }}
              options={[{ label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }, { label: 'العربية', value: 'ar' }]}
              onChange={e => set(p => ({ ...p, default_language: e.detail.selectedOption.value ?? 'fr' }))}
            />
          </FormField>
          <FormField label="Devise de facturation">
            <Select
              selectedOption={{ value: f.default_currency, label: f.default_currency }}
              options={[
                { value: 'EUR', label: 'EUR — Euro' },
                { value: 'USD', label: 'USD — Dollar américain' },
                { value: 'GBP', label: 'GBP — Livre sterling' },
                { value: 'MAD', label: 'MAD — Dirham marocain' },
                { value: 'XOF', label: 'XOF — Franc CFA' },
              ]}
              onChange={e => set(p => ({ ...p, default_currency: e.detail.selectedOption.value ?? 'EUR' }))}
            />
          </FormField>
          <FormField label="Langues disponibles sur la plateforme">
            <Multiselect
              selectedOptions={f.available_languages.map(v => ({ value: v, label: { fr: 'Français', en: 'English', ar: 'العربية' }[v] ?? v }))}
              options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]}
              onChange={e => set(p => ({ ...p, available_languages: e.detail.selectedOptions.map(o => o.value ?? '') }))}
              placeholder="Sélectionner les langues"
            />
          </FormField>
        </ColumnLayout>
      </Container>

      <Container header={
        <Header
          variant="h2"
          actions={f.maintenance_mode ? <Badge color="red">EN COURS</Badge> : <Badge color="green">Désactivé</Badge>}
        >
          Mode maintenance
        </Header>
      }>
        <SpaceBetween size="m">
          {f.maintenance_mode && (
            <Alert type="warning">
              La plateforme est <strong>inaccessible au public</strong>. Seuls les administrateurs peuvent se connecter. Les vendeurs et acheteurs voient une page d'indisponibilité.
            </Alert>
          )}
          <FormField
            label="Activer le mode maintenance"
            description="Coupe l'accès à tous les utilisateurs non-admin (vendeurs et acheteurs). Utile pour les mises à jour ou migrations de données."
          >
            <Toggle checked={f.maintenance_mode} onChange={mkBool('maintenance_mode', set)}>
              {f.maintenance_mode ? 'Maintenance activée — plateforme inaccessible' : 'Plateforme ouverte normalement'}
            </Toggle>
          </FormField>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Onglet 2 — Offre aux Vendeurs (clients de Stock212) ──────────────────────
function Tab2Vendors({ f, set }: { f: F; set: React.Dispatch<React.SetStateAction<F>> }) {
  return (
    <SpaceBetween size="l">
      <Alert type="info">
        Les <strong>vendeurs sont les clients directs de Stock212</strong>. Ils s'abonnent à la plateforme pour accéder au marché. Ces paramètres définissent les règles d'accès et d'utilisation de la plateforme.
      </Alert>

      <Container header={<Header variant="h2">Onboarding & Validation des vendeurs</Header>}>
        <SpaceBetween size="m">
          <FormField
            label="Validation manuelle des nouvelles inscriptions vendeur"
            description="Si activé, un administrateur Stock212 doit examiner et approuver chaque dossier avant qu'un vendeur puisse publier des produits et recevoir des commandes."
          >
            <Toggle checked={f.vendor_manual_validation} onChange={mkBool('vendor_manual_validation', set)}>
              {f.vendor_manual_validation ? 'Validation manuelle par l\'équipe Stock212' : 'Activation automatique à l\'inscription'}
            </Toggle>
          </FormField>

          <FormField
            label="Documents obligatoires pour l'activation"
            description="Pièces justificatives que le vendeur doit soumettre pour être validé par Stock212."
          >
            <Multiselect
              selectedOptions={f.vendor_required_docs.map(v => DOC_OPTIONS.find(o => o.value === v) ?? { value: v, label: v })}
              options={DOC_OPTIONS}
              onChange={e => set(p => ({ ...p, vendor_required_docs: e.detail.selectedOptions.map(o => o.value ?? '') }))}
              placeholder="Sélectionner les documents requis"
            />
          </FormField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Règles d'accès & Qualité vendeur</Header>}>
        <ColumnLayout columns={2}>
          <FormField
            label="Score minimum pour catalogue visible (0–100)"
            description="Un vendeur dont le score de qualité est inférieur à ce seuil voit ses produits masqués du catalogue public."
          >
            <Input type="number" value={String(f.vendor_min_score)} onChange={mkNum('vendor_min_score', set)} />
          </FormField>
          <FormField
            label="Taux de litige déclenchant la suspension (%)"
            description="Si le ratio litiges / commandes d'un vendeur dépasse ce seuil sur 30 jours glissants, son compte est automatiquement suspendu en attente de revue."
          >
            <Input type="number" value={String(f.vendor_max_dispute_pct)} onChange={mkNum('vendor_max_dispute_pct', set)} />
          </FormField>
          <FormField
            label="Nombre maximum de produits actifs par vendeur"
            description="Plafond global applicable à tous les vendeurs. Peut être surchargé par abonnement sur le plan du vendeur."
          >
            <Input type="number" value={String(f.vendor_max_products)} onChange={mkNum('vendor_max_products', set)} />
          </FormField>
          <FormField
            label="Délai maximum de confirmation d'une commande (heures)"
            description="Si un vendeur ne confirme pas une commande reçue dans ce délai, elle est automatiquement annulée et l'acheteur remboursé."
          >
            <Input type="number" value={String(f.vendor_confirmation_hours)} onChange={mkNum('vendor_confirmation_hours', set)} />
          </FormField>
        </ColumnLayout>
      </Container>

    </SpaceBetween>
  );
}

// ─── Onglet 3 — Règles de la Marketplace ─────────────────────────────────────
function Tab3Marketplace({ f, set }: { f: F; set: React.Dispatch<React.SetStateAction<F>> }) {
  return (
    <SpaceBetween size="l">
      <Alert type="info">
        Ces règles gouvernent <strong>les transactions entre vendeurs et acheteurs</strong> sur la marketplace. Stock212 fixe le cadre ; les vendeurs peuvent affiner certains paramètres dans les limites définies ici.
      </Alert>

      <Container header={<Header variant="h2">Acheteurs — Accès à la marketplace</Header>}>
        <SpaceBetween size="m">
          <FormField
            label="Validation manuelle des nouveaux comptes acheteurs"
            description="Si activé, un admin Stock212 approuve chaque compte avant que l'acheteur puisse passer commande chez un vendeur."
          >
            <Toggle checked={f.buyer_manual_validation} onChange={mkBool('buyer_manual_validation', set)}>
              {f.buyer_manual_validation ? 'Approbation manuelle requise' : 'Inscription libre — accès immédiat'}
            </Toggle>
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="Devis simultanés actifs max par acheteur">
              <Input type="number" value={String(f.buyer_max_active_quotes)} onChange={mkNum('buyer_max_active_quotes', set)} />
            </FormField>
            <FormField label="Durée de validité d'un devis (jours)">
              <Input type="number" value={String(f.quote_validity_days)} onChange={mkNum('quote_validity_days', set)} />
            </FormField>
            <FormField
              label="Seuil pour accès aux prix dégressifs (€)"
              description="Montant cumulé de commandes chez un vendeur pour débloquer ses tarifs volume."
            >
              <Input type="number" value={String(f.buyer_min_order_for_tiers)} onChange={mkNum('buyer_min_order_for_tiers', set)} />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Règles de commande</Header>}>
        <ColumnLayout columns={2}>
          <FormField
            label="Montant minimum de commande (€)"
            description="Plancher appliqué à toutes les commandes sur la marketplace, quel que soit le vendeur."
          >
            <Input type="number" value={String(f.min_order_amount)} onChange={mkNum('min_order_amount', set)} />
          </FormField>
          <FormField
            label="MOQ global (unités)"
            description="Quantité minimale de commande par défaut si le vendeur n'en définit pas pour son produit."
          >
            <Input type="number" value={String(f.global_moq)} onChange={mkNum('global_moq', set)} />
          </FormField>
          <FormField label="Durée de vie du panier (jours)" description="Passé ce délai d'inactivité, le panier est vidé automatiquement.">
            <Input type="number" value={String(f.cart_ttl_days)} onChange={mkNum('cart_ttl_days', set)} />
          </FormField>
          <FormField label="Conditions de paiement par défaut (jours)">
            <Select
              selectedOption={{ value: String(f.default_payment_terms), label: f.default_payment_terms === 0 ? 'Comptant' : `${f.default_payment_terms} jours` }}
              options={[
                { value: '0', label: 'Comptant' },
                { value: '30', label: '30 jours' },
                { value: '45', label: '45 jours' },
                { value: '60', label: '60 jours' },
                { value: '90', label: '90 jours' },
              ]}
              onChange={e => set(p => ({ ...p, default_payment_terms: Number(e.detail.selectedOption.value) }))}
            />
          </FormField>
        </ColumnLayout>
        <Box margin={{ top: 'm' }}>
          <FormField label="Modes de paiement acceptés sur la marketplace">
            <Multiselect
              selectedOptions={f.payment_methods.map(v => PAYMENT_OPTIONS.find(o => o.value === v) ?? { value: v, label: v })}
              options={PAYMENT_OPTIONS}
              onChange={e => set(p => ({ ...p, payment_methods: e.detail.selectedOptions.map(o => o.value ?? '') }))}
              placeholder="Sélectionner les modes de paiement"
            />
          </FormField>
        </Box>
      </Container>

      <Container header={<Header variant="h2">TVA & Fiscalité</Header>}>
        <ColumnLayout columns={2}>
          <FormField label="Taux TVA appliqué par défaut (%)">
            <Input type="number" value={String(f.vat_default_rate)} onChange={mkNum('vat_default_rate', set)} />
          </FormField>
          <FormField
            label="Auto-liquidation TVA intra-UE"
            description="Active le mécanisme d'autoliquidation pour les vendeurs et acheteurs assujettis établis dans l'UE."
          >
            <Toggle checked={f.intraeu_vat_enabled} onChange={mkBool('intraeu_vat_enabled', set)}>
              {f.intraeu_vat_enabled ? 'Activée (reverse-charge UE)' : 'Désactivée'}
            </Toggle>
          </FormField>
        </ColumnLayout>
      </Container>

      <Container header={<Header variant="h2">Livraison</Header>}>
        <ColumnLayout columns={2}>
          <FormField label="Frais de livraison par défaut (€)" description="Frais appliqués si ni le vendeur ni la commande n'en définissent.">
            <Input type="number" value={String(f.delivery_default_fee)} onChange={mkNum('delivery_default_fee', set)} />
          </FormField>
          <FormField label="Livraison gratuite à partir de (€)" description="Seuil de franchise de port côté vendeur par défaut.">
            <Input type="number" value={String(f.delivery_free_from)} onChange={mkNum('delivery_free_from', set)} />
          </FormField>
          <FormField label="Délai de livraison par défaut (jours ouvrés)">
            <Input type="number" value={String(f.delivery_default_days)} onChange={mkNum('delivery_default_days', set)} />
          </FormField>
          <FormField label="Délai max de validation d'un livreur (jours)">
            <Input type="number" value={String(f.delivery_validation_days)} onChange={mkNum('delivery_validation_days', set)} />
          </FormField>
        </ColumnLayout>
      </Container>
    </SpaceBetween>
  );
}

// ─── Onglet 4 — Finance & Facturation Stock212 ────────────────────────────────
function Tab4Finance({ f, set }: { f: F; set: React.Dispatch<React.SetStateAction<F>> }) {
  return (
    <SpaceBetween size="l">
      <Alert type="info">
        Paramètres de <strong>facturation émise par Stock212</strong> vers ses clients vendeurs (abonnements, crédits). Ces informations apparaissent sur les factures générées automatiquement.
      </Alert>

      <Container header={<Header variant="h2">Facturation Stock212 → Vendeurs</Header>}>
        <ColumnLayout columns={2}>
          <FormField label="Préfixe des numéros de facture" description="Ex : STK212 → facture n° STK212-2026-00042">
            <Input value={f.invoice_prefix} onChange={mkStr('invoice_prefix', set)} />
          </FormField>
          <FormField label="IBAN Stock212 (pour virements vendeurs)">
            <Input value={f.bank_iban} onChange={mkStr('bank_iban', set)} placeholder="FR76 XXXX XXXX XXXX XXXX" />
          </FormField>
          <FormField label="BIC / SWIFT">
            <Input value={f.bank_bic} onChange={mkStr('bank_bic', set)} placeholder="XXXXXXXX" />
          </FormField>
        </ColumnLayout>
        <Box margin={{ top: 'm' }}>
          <FormField label="Pied de page des factures" description="Mentions légales, SIRET, numéro de TVA intracommunautaire de Stock212.">
            <Textarea value={f.invoice_footer} onChange={mkStr('invoice_footer', set)} rows={3} />
          </FormField>
        </Box>
      </Container>

      <Container header={<Header variant="h2">Intégration Stripe</Header>}>
        <SpaceBetween size="m">
          <FormField label="Mode Stripe">
            <Select
              selectedOption={{ value: f.stripe_mode, label: f.stripe_mode === 'live' ? '🟢 Production (Live)' : '🟡 Test (Sandbox)' }}
              options={[
                { value: 'test', label: '🟡 Test (Sandbox) — aucune transaction réelle' },
                { value: 'live', label: '🟢 Production (Live) — transactions réelles' },
              ]}
              onChange={e => set(p => ({ ...p, stripe_mode: e.detail.selectedOption.value ?? 'test' }))}
            />
          </FormField>
          {f.stripe_mode === 'live' && (
            <Alert type="warning">
              Le mode Live est actif. Les transactions Stripe sont <strong>réelles et débitées</strong>. Assurez-vous que les clés API de production sont correctement configurées dans les variables d'environnement Supabase.
            </Alert>
          )}
          <Alert type="info">
            Les clés API Stripe (Publishable Key, Secret Key, Webhook Secret) sont gérées via les variables d'environnement serveur (<code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>). Ne jamais les stocker ici.
          </Alert>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Onglet 5 — Notifications ─────────────────────────────────────────────────
function Tab5Notifications({ f, set }: { f: F; set: React.Dispatch<React.SetStateAction<F>> }) {
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Emails de l'équipe Stock212</Header>}>
        <ColumnLayout columns={2}>
          <FormField
            label="Email admin interne (alertes systémiques)"
            description="Reçoit les alertes critiques de la plateforme : litiges, suspensions, erreurs."
          >
            <Input value={f.notif_admin_email} onChange={mkStr('notif_admin_email', set)} />
          </FormField>
          <FormField
            label="Email support (visible des vendeurs et acheteurs)"
            description="Adresse affichée dans les emails transactionnels et sur la page contact."
          >
            <Input value={f.notif_support_email} onChange={mkStr('notif_support_email', set)} />
          </FormField>
        </ColumnLayout>
      </Container>

      <Container header={<Header variant="h2">Alertes & rapports automatiques</Header>}>
        <SpaceBetween size="m">
          <FormField
            label="Notifications push in-app"
            description="Active les badges et toasts en temps réel dans l'interface d'administration."
          >
            <Toggle checked={f.notif_push_enabled} onChange={mkBool('notif_push_enabled', set)}>
              {f.notif_push_enabled ? 'Activées' : 'Désactivées'}
            </Toggle>
          </FormField>
          <FormField
            label="Alerte à chaque nouveau litige ouvert"
            description="Notifie immédiatement l'équipe Stock212 dès qu'un acheteur ouvre un litige contre un vendeur."
          >
            <Toggle checked={f.notif_alert_disputes} onChange={mkBool('notif_alert_disputes', set)}>
              {f.notif_alert_disputes ? 'Activée' : 'Désactivée'}
            </Toggle>
          </FormField>
          <FormField
            label="Alerte à chaque nouvelle inscription (vendeur ou acheteur)"
            description="Notifie l'équipe Stock212 pour faciliter la validation manuelle des nouveaux comptes."
          >
            <Toggle checked={f.notif_alert_registrations} onChange={mkBool('notif_alert_registrations', set)}>
              {f.notif_alert_registrations ? 'Activée' : 'Désactivée'}
            </Toggle>
          </FormField>
          <FormField
            label="Rapport hebdomadaire automatique"
            description="Envoie chaque lundi à 08h00 un résumé KPI à l'email admin : chiffre d'affaires, nouveaux vendeurs, abonnements actifs, litiges ouverts."
          >
            <Toggle checked={f.notif_weekly_report} onChange={mkBool('notif_weekly_report', set)}>
              {f.notif_weekly_report ? 'Activé' : 'Désactivé'}
            </Toggle>
          </FormField>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Onglet 6 — Sécurité & Audit ─────────────────────────────────────────────
function Tab6Security({ f, set }: { f: F; set: React.Dispatch<React.SetStateAction<F>> }) {
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Sessions & Authentification</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField
              label="Durée de session (heures)"
              description="Durée d'inactivité au-delà de laquelle un utilisateur est déconnecté automatiquement (s'applique à tous : admins, vendeurs, acheteurs)."
            >
              <Input type="number" value={String(f.security_session_hours)} onChange={mkNum('security_session_hours', set)} />
            </FormField>
            <FormField label="Tentatives de connexion max avant blocage">
              <Input type="number" value={String(f.security_max_attempts)} onChange={mkNum('security_max_attempts', set)} />
            </FormField>
            <FormField label="Durée de blocage après échecs (minutes)">
              <Input type="number" value={String(f.security_lockout_minutes)} onChange={mkNum('security_lockout_minutes', set)} />
            </FormField>
          </ColumnLayout>
          <FormField
            label="Double authentification (2FA) obligatoire pour les admins Stock212"
            description="Force l'utilisation d'un code TOTP pour tous les membres de l'équipe d'administration. Recommandé en production."
          >
            <Toggle checked={f.security_2fa_required} onChange={mkBool('security_2fa_required', set)}>
              {f.security_2fa_required ? '2FA obligatoire pour l\'équipe admin' : '2FA facultatif'}
            </Toggle>
          </FormField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Journal d'audit</Header>}>
        <SpaceBetween size="m">
          <FormField
            label="Journalisation des actions sensibles"
            description="Enregistre toutes les actions critiques effectuées par l'équipe admin : modifications de paramètres, changements de statut, validations manuelles."
          >
            <Toggle checked={f.audit_logs_enabled} onChange={mkBool('audit_logs_enabled', set)}>
              {f.audit_logs_enabled ? 'Journalisation active' : 'Journalisation désactivée'}
            </Toggle>
          </FormField>
          {f.audit_logs_enabled && (
            <FormField
              label="Rétention des logs (jours)"
              description="Les entrées d'audit plus anciennes sont archivées puis supprimées automatiquement."
            >
              <Input type="number" value={String(f.audit_retention_days)} onChange={mkNum('audit_retention_days', set)} />
            </FormField>
          )}
        </SpaceBetween>
      </Container>

      <ExpandableSection headerText="⚠ Zone dangereuse" variant="container">
        <SpaceBetween size="m">
          <Alert type="error">
            Ces actions sont irréversibles. Elles affectent l'ensemble de la plateforme pour tous les utilisateurs.
          </Alert>
          <ColumnLayout columns={2}>
            <Box>
              <Box variant="awsui-key-label">Vider le cache applicatif</Box>
              <Box color="text-body-secondary" fontSize="body-s" margin={{ bottom: 's' }}>
                Force le rechargement de tous les paramètres. Les sessions actives ne sont pas interrompues.
              </Box>
              <Button onClick={() => window.location.reload()}>Vider le cache</Button>
            </Box>
            <Box>
              <Box variant="awsui-key-label">Réinitialiser aux valeurs par défaut</Box>
              <Box color="text-body-secondary" fontSize="body-s" margin={{ bottom: 's' }}>
                Remet tous les paramètres à leurs valeurs d'usine. Non sauvegardé tant que vous ne cliquez pas sur Enregistrer.
              </Box>
              <Button onClick={() => set({ ...DEFAULTS })}>Réinitialiser le formulaire</Button>
            </Box>
          </ColumnLayout>
        </SpaceBetween>
      </ExpandableSection>
    </SpaceBetween>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function AdminSettings() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState<F>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const tracked: React.Dispatch<React.SetStateAction<F>> = useCallback((action) => {
    setForm(action);
    setDirty(true);
  }, []);

  useEffect(() => {
    supabase.from('platform_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        setLastSaved(data.updated_at ?? null);
        // Merge DB data over defaults (handles missing new columns gracefully)
        setForm(prev => ({ ...prev, ...data }));
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    if (!settingsId) return;
    setSaving(true); setFlash(null);
    const { error } = await supabase
      .from('platform_settings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', settingsId);
    if (error) {
      setFlash({ type: 'error', msg: `Erreur : ${error.message}` });
    } else {
      setFlash({ type: 'success', msg: 'Paramètres enregistrés avec succès.' });
      setDirty(false);
      setLastSaved(new Date().toISOString());
    }
    setSaving(false);
  };

  if (loading) return (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
      <Box variant="p" color="text-body-secondary" margin={{ top: 's' }}>Chargement des paramètres de la plateforme…</Box>
    </Box>
  );

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={lastSaved ? `Dernière sauvegarde : ${new Date(lastSaved).toLocaleString('fr-FR')}` : 'Aucune sauvegarde enregistrée.'}
          actions={
            <SpaceBetween direction="horizontal" size="s">
              {dirty && <StatusIndicator type="warning">Modifications non sauvegardées</StatusIndicator>}
              {form.maintenance_mode && <StatusIndicator type="error">Maintenance active</StatusIndicator>}
              <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>
                Enregistrer les paramètres
              </Button>
            </SpaceBetween>
          }
        >
          Paramètres de la plateforme Stock212
        </Header>
      }
    >
      <SpaceBetween size="l">
        {flash && (
          <Flashbar items={[{
            type: flash.type, content: flash.msg,
            dismissible: true, onDismiss: () => setFlash(null), id: 'flash',
          }]} />
        )}

        <Tabs
          tabs={[
            { id: 'identity',      label: '🏢 Identité Stock212',            content: <Tab1Identity       f={form} set={tracked} /> },
            { id: 'vendors',       label: '🤝 Offre aux Vendeurs',            content: <Tab2Vendors        f={form} set={tracked} /> },
            { id: 'marketplace',   label: '🛒 Règles Marketplace',            content: <Tab3Marketplace    f={form} set={tracked} /> },
            { id: 'finance',       label: '💶 Finance & Facturation',         content: <Tab4Finance        f={form} set={tracked} /> },
            { id: 'notifications', label: '🔔 Notifications',                 content: <Tab5Notifications  f={form} set={tracked} /> },
            { id: 'security',      label: '🔒 Sécurité & Audit',              content: <Tab6Security       f={form} set={tracked} /> },
          ]}
        />
      </SpaceBetween>
    </ContentLayout>
  );
}
