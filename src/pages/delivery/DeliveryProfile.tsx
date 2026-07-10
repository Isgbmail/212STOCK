import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Container, ColumnLayout, Box, Button,
  FormField, Input, Select, Multiselect, StatusIndicator,
  Flashbar, Toggle, Alert,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const REGIONS_MA = ['Casablanca', 'Rabat', 'Tanger', 'Fès', 'Marrakech', 'Agadir', 'Oujda', 'Meknès', 'Kénitra', 'Tétouan', 'Laâyoune', 'Dakhla'];

export default function DeliveryProfile() {
  const { activeOrg } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; content: string } | null>(null);

  // Profil
  const [validationStatus, setValidationStatus] = useState('');
  const [deliveryType, setDeliveryType]         = useState('independent');
  const [baseRate, setBaseRate]                 = useState('');
  const [avgRating, setAvgRating]               = useState(0);
  const [reviewCount, setReviewCount]           = useState(0);

  // Capacités
  const [maxWeight, setMaxWeight]       = useState('');
  const [maxVolume, setMaxVolume]       = useState('');
  const [coldChain, setColdChain]       = useState(false);
  const [frozen, setFrozen]             = useState(false);
  const [fragile, setFragile]           = useState(false);
  const [lastMile, setLastMile]         = useState(false);

  // Zones
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  useEffect(() => {
    if (!activeOrg) return;
    async function load() {
      setLoading(true);
      const [profRes, capRes, zoneRes] = await Promise.all([
        supabase
          .from('delivery_profiles')
          .select('validation_status, delivery_type, base_rate, avg_rating, review_count')
          .eq('organisation_id', activeOrg!.id)
          .maybeSingle(),
        supabase
          .from('delivery_capabilities')
          .select('max_weight_kg, max_volume_m3, cold_chain, frozen, fragile, last_mile')
          .eq('organisation_id', activeOrg!.id)
          .maybeSingle(),
        supabase
          .from('delivery_zones')
          .select('region')
          .eq('organisation_id', activeOrg!.id),
      ]);

      if (profRes.data) {
        const p = profRes.data as Record<string, unknown>;
        setValidationStatus((p.validation_status as string) ?? '');
        setDeliveryType((p.delivery_type as string) ?? 'independent');
        setBaseRate(p.base_rate != null ? String(p.base_rate) : '');
        setAvgRating((p.avg_rating as number) ?? 0);
        setReviewCount((p.review_count as number) ?? 0);
      }
      if (capRes.data) {
        const c = capRes.data as Record<string, unknown>;
        setMaxWeight(c.max_weight_kg != null ? String(c.max_weight_kg) : '');
        setMaxVolume(c.max_volume_m3 != null ? String(c.max_volume_m3) : '');
        setColdChain((c.cold_chain as boolean) ?? false);
        setFrozen((c.frozen as boolean) ?? false);
        setFragile((c.fragile as boolean) ?? false);
        setLastMile((c.last_mile as boolean) ?? false);
      }
      if (zoneRes.data) {
        setSelectedZones((zoneRes.data as Array<{ region: string }>).map((z) => z.region));
      }
      setLoading(false);
    }
    load();
  }, [activeOrg?.id]);

  async function save() {
    if (!activeOrg) return;
    setSaving(true);
    try {
      await Promise.all([
        // Update delivery_profiles
        supabase.from('delivery_profiles').upsert({
          organisation_id: activeOrg.id,
          delivery_type:   deliveryType,
          base_rate:       baseRate ? parseFloat(baseRate) : null,
        }, { onConflict: 'organisation_id' }),

        // Update delivery_capabilities
        supabase.from('delivery_capabilities').upsert({
          organisation_id: activeOrg.id,
          max_weight_kg:   maxWeight ? parseFloat(maxWeight) : null,
          max_volume_m3:   maxVolume ? parseFloat(maxVolume) : null,
          cold_chain:      coldChain,
          frozen,
          fragile,
          last_mile:       lastMile,
        }, { onConflict: 'organisation_id' }),

        // Replace delivery_zones
        supabase.from('delivery_zones').delete().eq('organisation_id', activeOrg.id),
      ]);

      if (selectedZones.length > 0) {
        await supabase.from('delivery_zones').insert(
          selectedZones.map((region) => ({ organisation_id: activeOrg.id, region }))
        );
      }

      setFlash({ type: 'success', content: 'Profil mis à jour avec succès.' });
    } catch (e) {
      setFlash({ type: 'error', content: e instanceof Error ? e.message : 'Erreur de sauvegarde' });
    }
    setSaving(false);
  }

  const statusInfo: Record<string, { type: 'success' | 'warning' | 'error' | 'info'; label: string }> = {
    validated:    { type: 'success', label: 'Validé — vous pouvez opérer sur la plateforme' },
    pending:      { type: 'warning', label: 'En attente de validation par l\'administration' },
    pending_info: { type: 'warning', label: 'Document complémentaire requis' },
    rejected:     { type: 'error',   label: 'Candidature refusée — contactez support@stock212.ma' },
    suspended:    { type: 'error',   label: 'Compte suspendu' },
  };
  const si = statusInfo[validationStatus] ?? { type: 'info' as const, label: validationStatus };

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <Button variant="primary" loading={saving} onClick={save}>
            Enregistrer les modifications
          </Button>
        }
      >
        Profil & Documents
      </Header>

      {flash && (
        <Flashbar items={[{
          type: flash.type, content: flash.content, id: '1', dismissible: true,
          onDismiss: () => setFlash(null),
        }]} />
      )}

      {/* ── Statut de validation ───────────────────────────────────────── */}
      <Container header={<Header variant="h2">Statut de validation</Header>}>
        {loading ? (
          <Box>Chargement…</Box>
        ) : (
          <SpaceBetween size="m">
            <StatusIndicator type={si.type}>{si.label}</StatusIndicator>
            <ColumnLayout columns={3} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Note moyenne</Box>
                <Box fontSize="heading-xl" fontWeight="bold" color="text-status-success">
                  {avgRating > 0 ? `${avgRating.toFixed(1)}/5` : '—'}
                </Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Évaluations reçues</Box>
                <Box fontSize="heading-xl" fontWeight="bold">{reviewCount}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Type</Box>
                <Box>{deliveryType === 'logistics_company' ? 'Entreprise logistique' : deliveryType === 'internal_fleet' ? 'Flotte interne' : 'Indépendant'}</Box>
              </div>
            </ColumnLayout>
            {validationStatus === 'pending_info' && (
              <Alert type="warning" header="Action requise">
                L'administration a demandé un document complémentaire. Rendez-vous sur
                {' '}<strong>/delivery/onboarding</strong> pour le soumettre.
              </Alert>
            )}
          </SpaceBetween>
        )}
      </Container>

      {/* ── Tarification ──────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Tarification & Type</Header>}>
        <ColumnLayout columns={2}>
          <FormField label="Type de prestataire">
            <Select
              selectedOption={{ value: deliveryType, label: {
                independent:       'Indépendant',
                logistics_company: 'Entreprise de logistique',
                internal_fleet:    'Flotte interne',
              }[deliveryType] ?? deliveryType }}
              onChange={({ detail }) => setDeliveryType(detail.selectedOption.value ?? 'independent')}
              options={[
                { value: 'independent',       label: 'Indépendant' },
                { value: 'logistics_company', label: 'Entreprise de logistique' },
                { value: 'internal_fleet',    label: 'Flotte interne' },
              ]}
            />
          </FormField>
          <FormField label="Tarif de base (MAD/livraison)" description="Prix indicatif affiché aux acheteurs et admins">
            <Input
              type="number"
              value={baseRate}
              onChange={({ detail }) => setBaseRate(detail.value)}
              placeholder="Ex: 35"
            />
          </FormField>
        </ColumnLayout>
      </Container>

      {/* ── Capacités ─────────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Capacités & Équipements</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="Charge max (kg)">
              <Input type="number" value={maxWeight} onChange={({ detail }) => setMaxWeight(detail.value)} placeholder="Ex: 500" />
            </FormField>
            <FormField label="Volume max (m³)">
              <Input type="number" value={maxVolume} onChange={({ detail }) => setMaxVolume(detail.value)} placeholder="Ex: 3.5" />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <Toggle checked={coldChain} onChange={({ detail }) => setColdChain(detail.checked)}>Chaîne du froid (réfrigéré)</Toggle>
            <Toggle checked={frozen}    onChange={({ detail }) => setFrozen(detail.checked)}>Surgelé</Toggle>
            <Toggle checked={fragile}   onChange={({ detail }) => setFragile(detail.checked)}>Marchandises fragiles</Toggle>
            <Toggle checked={lastMile}  onChange={({ detail }) => setLastMile(detail.checked)}>Dernier kilomètre</Toggle>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      {/* ── Zones de livraison ────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Zones de livraison</Header>}>
        <FormField
          label="Régions couvertes"
          description="Sélectionnez toutes les régions où vous pouvez livrer"
        >
          <Multiselect
            selectedOptions={selectedZones.map((z) => ({ value: z, label: z }))}
            onChange={({ detail }) => setSelectedZones(detail.selectedOptions.map((o) => o.value ?? ''))}
            options={REGIONS_MA.map((r) => ({ value: r, label: r }))}
            placeholder="Sélectionner des régions…"
            filteringType="auto"
          />
        </FormField>
      </Container>
    </SpaceBetween>
  );
}
