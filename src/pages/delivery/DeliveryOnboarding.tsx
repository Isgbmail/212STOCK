import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Box,
  FormField,
  Input,
  Select,
  Checkbox,
  ColumnLayout,
  Alert,
  Flashbar,
  Wizard,
  RadioGroup,
  TokenGroup,
  Tiles,
  Toggle,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const VEHICLE_OPTIONS = [
  'Fourgon frigorifique', 'Fourgon température ambiante', 'Camion porteur',
  'Camion frigorifique', 'Camionnette', 'Moto/scooter', 'Vélo cargo',
];

const MOROCCAN_REGIONS = [
  'Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Marrakech-Safi', 'Fès-Meknès',
  'Tanger-Tétouan-Al Hoceima', 'Souss-Massa', 'Oriental', 'Béni Mellal-Khénifra',
  'Drâa-Tafilalet', 'Guelmim-Oued Noun', 'Laâyoune-Sakia El Hamra',
  'Dakhla-Oued Ed-Dahab',
];

interface DocUpload {
  type: string;
  label: string;
  required: boolean;
  file: File | null;
  url: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
}

function buildDocList(deliveryType: string): DocUpload[] {
  const company = deliveryType === 'logistics_company';
  const docs: DocUpload[] = company
    ? [
        { type: 'registre_commerce',          label: 'Extrait Registre de Commerce', required: true,  file: null, url: '', status: 'idle' },
        { type: 'carte_fiscale',              label: 'Carte fiscale',                required: true,  file: null, url: '', status: 'idle' },
        { type: 'assurance_marchandises',     label: 'Attestation assurance marchandises transportées', required: true, file: null, url: '', status: 'idle' },
        { type: 'assurance_rc',               label: 'Assurance responsabilité civile',   required: true,  file: null, url: '', status: 'idle' },
        { type: 'liste_flotte',               label: 'Liste flotte avec immatriculations', required: true,  file: null, url: '', status: 'idle' },
        { type: 'licence_transport_alimentaire', label: 'Licence transport alimentaire (FMCG réfrigéré)', required: false, file: null, url: '', status: 'idle' },
      ]
    : [
        { type: 'permis_conduire',     label: 'Permis de conduire (recto/verso)', required: true,  file: null, url: '', status: 'idle' },
        { type: 'carte_grise',        label: 'Carte grise véhicule',             required: false, file: null, url: '', status: 'idle' },
        { type: 'certificat_medical', label: 'Certificat médical',               required: true,  file: null, url: '', status: 'idle' },
        { type: 'casier_judiciaire',  label: 'Casier judiciaire (Bulletin n°3)', required: true,  file: null, url: '', status: 'idle' },
        { type: 'attestation_hygiene','label': 'Attestation formation hygiène alimentaire', required: false, file: null, url: '', status: 'idle' },
      ];
  return docs;
}

export default function DeliveryOnboarding() {
  const { activeOrg, user } = useAuth();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [flashItems, setFlashItems] = useState<{ type: 'error'; content: string; id: string }[]>([]);

  // Step 1 — Type & profil
  const [deliveryType, setDeliveryType] = useState<'logistics_company' | 'independent'>('logistics_company');
  const [phone, setPhone] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [vehicleInput, setVehicleInput] = useState('');

  // Step 2 — Zones & capacités
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [zoneInput, setZoneInput] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [coldChain, setColdChain] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [fragile, setFragile] = useState(false);
  const [lastMile, setLastMile] = useState(false);
  const [baseRate, setBaseRate] = useState('');

  // Step 3 — Documents
  const [docs, setDocs] = useState<DocUpload[]>(() => buildDocList('logistics_company'));
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 4 — CGU
  const [cguAccepted, setCguAccepted] = useState(false);
  const [partnerAccepted, setPartnerAccepted] = useState(false);

  function addFlash(msg: string) {
    const id = Date.now().toString();
    setFlashItems((prev) => [...prev, { type: 'error', content: msg, id }]);
  }

  function handleTypeChange(type: 'logistics_company' | 'independent') {
    setDeliveryType(type);
    setDocs(buildDocList(type));
  }

  function addVehicle(v: string) {
    if (!v.trim() || selectedVehicles.includes(v.trim())) return;
    setSelectedVehicles((prev) => [...prev, v.trim()]);
    setVehicleInput('');
  }

  function addZone(z: string) {
    if (!z.trim() || selectedZones.includes(z.trim())) return;
    setSelectedZones((prev) => [...prev, z.trim()]);
    setZoneInput('');
  }

  async function uploadDoc(index: number, file: File) {
    if (!activeOrg) return;
    setDocs((prev) => prev.map((d, i) => i === index ? { ...d, file, status: 'uploading' } : d));
    const path = `${activeOrg.id}/${docs[index].type}_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('onboarding-docs')
      .upload(path, file, { upsert: true });
    if (error) {
      setDocs((prev) => prev.map((d, i) => i === index ? { ...d, status: 'error' } : d));
      addFlash(`Upload ${docs[index].label} : ${error.message}`);
      return;
    }
    const { data: urlData } = supabase.storage.from('onboarding-docs').getPublicUrl(data.path);
    setDocs((prev) =>
      prev.map((d, i) =>
        i === index ? { ...d, url: urlData.publicUrl, file, status: 'done' } : d,
      ),
    );
  }

  function validateStep(step: number): string | null {
    if (step === 0) {
      if (!phone.trim()) return 'Numéro de téléphone requis.';
      if (deliveryType === 'logistics_company' && !fleetSize) return 'Taille de flotte requise.';
      if (selectedVehicles.length === 0) return 'Sélectionnez au moins un type de véhicule.';
    }
    if (step === 1) {
      if (selectedZones.length === 0) return 'Sélectionnez au moins une zone de couverture.';
    }
    if (step === 2) {
      const missing = docs.filter((d) => d.required && d.status !== 'done');
      if (missing.length > 0) return `Documents obligatoires manquants : ${missing.map((d) => d.label).join(', ')}.`;
    }
    if (step === 3) {
      if (!cguAccepted || !partnerAccepted) return 'Vous devez accepter les CGU et le contrat partenaire.';
    }
    return null;
  }

  async function handleSubmit() {
    if (!activeOrg || !user) return;
    setSubmitting(true);
    try {
      // Upsert delivery_profiles
      const { error: profErr } = await supabase.from('delivery_profiles').upsert({
        organisation_id: activeOrg.id,
        delivery_type: deliveryType,
        phone,
        fleet_size: fleetSize ? parseInt(fleetSize) : null,
        vehicle_types: selectedVehicles,
        base_rate: baseRate ? parseFloat(baseRate) : null,
        validation_status: 'pending',
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'organisation_id' });
      if (profErr) throw profErr;

      // Upsert delivery_capabilities
      const { error: capErr } = await supabase.from('delivery_capabilities').upsert({
        organisation_id: activeOrg.id,
        max_weight_kg: maxWeight ? parseFloat(maxWeight) : null,
        cold_chain: coldChain,
        frozen,
        fragile,
        last_mile: lastMile,
        ambient: true,
      }, { onConflict: 'organisation_id' });
      if (capErr) throw capErr;

      // Insert delivery_zones
      await supabase.from('delivery_zones').delete().eq('organisation_id', activeOrg.id);
      if (selectedZones.length > 0) {
        await supabase.from('delivery_zones').insert(
          selectedZones.map((region) => ({ organisation_id: activeOrg.id, region })),
        );
      }

      // Insert onboarding_documents
      const completedDocs = docs.filter((d) => d.status === 'done');
      if (completedDocs.length > 0) {
        // Remove old docs first
        await supabase.from('onboarding_documents').delete().eq('organisation_id', activeOrg.id);
        const { error: docErr } = await supabase.from('onboarding_documents').insert(
          completedDocs.map((d) => ({
            organisation_id: activeOrg.id,
            document_type: d.type,
            document_label: d.label,
            file_url: d.url,
            file_name: d.file?.name ?? '',
            status: 'submitted',
          })),
        );
        if (docErr) throw docErr;
      }

      // Audit entry
      await supabase.from('delivery_validation_audit').insert({
        organisation_id: activeOrg.id,
        action: 'submitted',
        actor_id: user.id,
        actor_name: user.email ?? '',
        reason: 'Dossier soumis par le partenaire',
      });

      setSubmitted(true);
    } catch (e) {
      addFlash(e instanceof Error ? e.message : 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Container
        header={<Header variant="h1">Dossier soumis avec succès</Header>}
      >
        <SpaceBetween size="l">
          <Alert type="success" header="Votre dossier est en cours d'examen">
            Notre équipe examinera votre candidature dans les <strong>2 jours ouvrables</strong>.
            Vous recevrez une notification par email dès qu'une décision sera prise.
          </Alert>
          <Box color="text-body-secondary">
            En attendant la validation, vous pouvez consulter l'état de votre dossier depuis votre tableau de bord.
          </Box>
          <Button variant="primary" onClick={() => navigate('/delivery')}>
            Retour au tableau de bord
          </Button>
        </SpaceBetween>
      </Container>
    );
  }

  return (
    <SpaceBetween size="l">
      {flashItems.length > 0 && (
        <Flashbar
          items={flashItems.map((f) => ({
            type: f.type, content: f.content, id: f.id, dismissible: true,
            onDismiss: () => setFlashItems((p) => p.filter((x) => x.id !== f.id)),
          }))}
        />
      )}

      <Wizard
        activeStepIndex={activeStep}
        onNavigate={({ detail }) => {
          const err = validateStep(activeStep);
          if (detail.requestedStepIndex > activeStep && err) {
            addFlash(err);
            return;
          }
          setActiveStep(detail.requestedStepIndex);
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/delivery')}
        isLoadingNextStep={submitting}
        i18nStrings={{
          stepNumberLabel: (n) => `Étape ${n}`,
          collapsedStepsLabel: (n, total) => `Étape ${n} sur ${total}`,
          skipToButtonLabel: (step) => `Passer à ${step.title}`,
          navigationAriaLabel: 'Étapes',
          cancelButton: 'Annuler',
          previousButton: 'Précédent',
          nextButton: 'Suivant',
          submitButton: 'Soumettre le dossier',
          optional: 'optionnel',
        }}
        steps={[
          // ── Étape 1 — Type & profil ──────────────────────────────────────
          {
            title: 'Type de partenariat',
            description: 'Choisissez votre type de partenariat et renseignez votre profil.',
            content: (
              <SpaceBetween size="l">
                <FormField label="Type de partenaire">
                  <Tiles
                    value={deliveryType}
                    onChange={({ detail }) => handleTypeChange(detail.value as 'logistics_company' | 'independent')}
                    items={[
                      {
                        value: 'logistics_company',
                        label: 'Société logistique (3PL)',
                        description: 'Entreprise disposant d\'une flotte de véhicules et d\'une activité transport professionnelle.',
                      },
                      {
                        value: 'independent',
                        label: 'Chauffeur livreur indépendant',
                        description: 'Freelance ou auto-entrepreneur assurant des livraisons pour le réseau Stock212.',
                      },
                    ]}
                  />
                </FormField>

                <ColumnLayout columns={2} variant="text-grid">
                  <FormField label="Téléphone professionnel" constraintText="Format international : +212 6...">
                    <Input
                      value={phone}
                      onChange={({ detail }) => setPhone(detail.value)}
                      placeholder="+212 6 00 00 00 00"
                      type="tel"
                    />
                  </FormField>

                  {deliveryType === 'logistics_company' && (
                    <FormField label="Taille de la flotte (nombre de véhicules)">
                      <Input
                        value={fleetSize}
                        onChange={({ detail }) => setFleetSize(detail.value)}
                        placeholder="Ex : 12"
                        type="number"
                      />
                    </FormField>
                  )}

                  {deliveryType === 'logistics_company' && (
                    <FormField label="Tarif de base (MAD / km, optionnel)">
                      <Input
                        value={baseRate}
                        onChange={({ detail }) => setBaseRate(detail.value)}
                        placeholder="Ex : 4.50"
                        type="number"
                      />
                    </FormField>
                  )}
                </ColumnLayout>

                <FormField
                  label="Types de véhicules"
                  description="Sélectionnez dans la liste ou tapez un type personnalisé."
                >
                  <SpaceBetween size="s">
                    <Select
                      placeholder="Sélectionner un type de véhicule..."
                      selectedOption={vehicleInput ? { value: vehicleInput, label: vehicleInput } : null}
                      onChange={({ detail }) => addVehicle(detail.selectedOption?.value ?? '')}
                      options={VEHICLE_OPTIONS.filter((v) => !selectedVehicles.includes(v)).map((v) => ({ value: v, label: v }))}
                    />
                    <TokenGroup
                      items={selectedVehicles.map((v) => ({ label: v }))}
                      onDismiss={({ detail }) =>
                        setSelectedVehicles((p) => p.filter((_, i) => i !== detail.itemIndex))
                      }
                    />
                  </SpaceBetween>
                </FormField>
              </SpaceBetween>
            ),
          },

          // ── Étape 2 — Zones & capacités ──────────────────────────────────
          {
            title: 'Zones et capacités',
            description: 'Définissez vos zones de couverture et vos capacités de transport.',
            content: (
              <SpaceBetween size="l">
                <FormField
                  label="Zones de couverture"
                  description="Régions dans lesquelles vous opérez. Vous pouvez en ajouter plusieurs."
                >
                  <SpaceBetween size="s">
                    <Select
                      placeholder="Ajouter une région..."
                      selectedOption={null}
                      onChange={({ detail }) => addZone(detail.selectedOption?.value ?? '')}
                      options={MOROCCAN_REGIONS.filter((r) => !selectedZones.includes(r)).map((r) => ({ value: r, label: r }))}
                    />
                    <TokenGroup
                      items={selectedZones.map((z) => ({ label: z }))}
                      onDismiss={({ detail }) =>
                        setSelectedZones((p) => p.filter((_, i) => i !== detail.itemIndex))
                      }
                    />
                  </SpaceBetween>
                </FormField>

                <ColumnLayout columns={2} variant="text-grid">
                  <FormField label="Charge utile maximale (kg)">
                    <Input
                      value={maxWeight}
                      onChange={({ detail }) => setMaxWeight(detail.value)}
                      placeholder="Ex : 5000"
                      type="number"
                    />
                  </FormField>
                </ColumnLayout>

                <FormField label="Capacités spéciales">
                  <SpaceBetween size="s">
                    <Checkbox checked={coldChain} onChange={({ detail }) => setColdChain(detail.checked)}>
                      Chaîne du froid (0–4°C)
                    </Checkbox>
                    <Checkbox checked={frozen} onChange={({ detail }) => setFrozen(detail.checked)}>
                      Transport congelé (≤ −18°C)
                    </Checkbox>
                    <Checkbox checked={fragile} onChange={({ detail }) => setFragile(detail.checked)}>
                      Marchandises fragiles
                    </Checkbox>
                    <Checkbox checked={lastMile} onChange={({ detail }) => setLastMile(detail.checked)}>
                      Dernier kilomètre / livraison domicile
                    </Checkbox>
                  </SpaceBetween>
                </FormField>
              </SpaceBetween>
            ),
          },

          // ── Étape 3 — Documents ──────────────────────────────────────────
          {
            title: 'Documents',
            description: 'Téléversez les pièces justificatives requises (PDF ou image).',
            content: (
              <SpaceBetween size="m">
                <Alert type="info">
                  Les documents marqués <strong>*</strong> sont obligatoires. Les fichiers acceptés : PDF, JPG, PNG (max 10 Mo).
                </Alert>
                {docs.map((doc, idx) => (
                  <Container
                    key={doc.type}
                    header={
                      <Header
                        variant="h3"
                        actions={
                          doc.status === 'done' ? (
                            <Button
                              variant="inline-link"
                              onClick={() => {
                                setDocs((p) => p.map((d, i) => i === idx ? { ...d, file: null, url: '', status: 'idle' } : d));
                              }}
                            >
                              Remplacer
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              loading={doc.status === 'uploading'}
                              onClick={() => fileInputRefs.current[idx]?.click()}
                            >
                              {doc.status === 'idle' ? 'Choisir un fichier' : doc.status === 'error' ? 'Réessayer' : '...'}
                            </Button>
                          )
                        }
                      >
                        {doc.label}{doc.required ? ' *' : ' (optionnel)'}
                      </Header>
                    }
                  >
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      ref={(el) => { fileInputRefs.current[idx] = el; }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadDoc(idx, f);
                      }}
                    />
                    {doc.status === 'done' && (
                      <Box color="text-status-success">
                        ✓ {doc.file?.name ?? 'Fichier téléversé'}
                      </Box>
                    )}
                    {doc.status === 'error' && (
                      <Box color="text-status-error">
                        Erreur lors du téléversement. Veuillez réessayer.
                      </Box>
                    )}
                    {doc.status === 'idle' && (
                      <Box color="text-body-secondary" fontSize="body-s">
                        Aucun fichier sélectionné.
                      </Box>
                    )}
                  </Container>
                ))}
              </SpaceBetween>
            ),
          },

          // ── Étape 4 — CGU ────────────────────────────────────────────────
          {
            title: 'Conditions générales',
            description: 'Veuillez lire et accepter les conditions avant de soumettre votre dossier.',
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h3">Conditions générales d'utilisation Stock212</Header>}>
                  <Box variant="p" color="text-body-secondary">
                    En tant que partenaire de livraison Stock212, vous vous engagez à respecter les niveaux de service
                    définis dans le contrat (délais, conditions de manutention FMCG, traçabilité des colis),
                    à maintenir vos documents réglementaires à jour, et à signaler tout incident dans les 2 heures.
                    Stock212 se réserve le droit de suspendre l'accès en cas de non-conformité avérée ou de plainte
                    fondée d'un acheteur ou vendeur.
                  </Box>
                </Container>

                <Container header={<Header variant="h3">Contrat partenaire</Header>}>
                  <Box variant="p" color="text-body-secondary">
                    Les modalités de rémunération sont définies par mission, sur la base du tarif convenu au profil.
                    Les paiements sont effectués sous 15 jours ouvrables après livraison confirmée.
                    En cas de litige sur une livraison, Stock212 arbitre après consultation des deux parties.
                  </Box>
                </Container>

                <SpaceBetween size="m">
                  <Checkbox checked={cguAccepted} onChange={({ detail }) => setCguAccepted(detail.checked)}>
                    J'ai lu et j'accepte les <strong>Conditions générales d'utilisation</strong> de Stock212.
                  </Checkbox>
                  <Checkbox checked={partnerAccepted} onChange={({ detail }) => setPartnerAccepted(detail.checked)}>
                    J'accepte le <strong>Contrat partenaire de livraison</strong>, incluant les niveaux de service,
                    les modalités de paiement, les conditions de suspension et les obligations FMCG.
                  </Checkbox>
                </SpaceBetween>
              </SpaceBetween>
            ),
          },
        ]}
      />
    </SpaceBetween>
  );
}
