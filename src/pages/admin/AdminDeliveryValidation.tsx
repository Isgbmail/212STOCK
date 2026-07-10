import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  StatusIndicator,
  Box,
  Modal,
  FormField,
  Textarea,
  Alert,
  Badge,
  ColumnLayout,
  Tabs,
  Spinner,
  Select,
  Flashbar,
  Container,
  ExpandableSection,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeliveryProfile {
  organisation_id: string;
  delivery_type: 'logistics_company' | 'independent' | 'internal_fleet';
  validation_status: 'pending' | 'pending_info' | 'validated' | 'rejected' | 'suspended';
  phone: string | null;
  fleet_size: number | null;
  vehicle_types: string[];
  base_rate: number | null;
  avg_rating: number;
  submitted_at: string | null;
  rejection_reason: string | null;
  organisations: { id: string; name: string; country: string; city: string | null; siret: string | null; vat_number: string | null } | null;
  delivery_capabilities: { max_weight_kg: number | null; cold_chain: boolean; frozen: boolean; fragile: boolean; last_mile: boolean }[] | null;
  delivery_zones: { region: string }[] | null;
}

interface OnboardingDoc {
  id: string;
  document_type: string;
  document_label: string;
  file_url: string | null;
  file_name: string | null;
  status: 'submitted' | 'verified' | 'issue_detected';
  admin_notes: string | null;
  uploaded_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_name: string | null;
  reason: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'info' | 'stopped' }> = {
  pending:      { label: 'En attente',       type: 'warning'  },
  pending_info: { label: 'Info demandée',    type: 'info'     },
  validated:    { label: 'Validé',           type: 'success'  },
  rejected:     { label: 'Refusé',           type: 'error'    },
  suspended:    { label: 'Suspendu',         type: 'stopped'  },
};

const ACTION_LABELS: Record<string, string> = {
  submitted:      'Dossier soumis',
  requested_info: 'Document demandé',
  approved:       'Profil approuvé',
  rejected:       'Profil refusé',
  suspended:      'Compte suspendu',
  reactivated:    'Compte réactivé',
};

const REJECTION_REASONS = [
  'Capacité véhicule insuffisante',
  'Permis invalide ou expiré',
  'Document manquant',
  'Assurance insuffisante',
  'Zone non couverte par Stock212',
  'Antécédents incompatibles',
  'Autre',
];

const DOC_TYPE_OPTIONS = [
  { value: 'registre_commerce',           label: 'Extrait Registre de Commerce' },
  { value: 'carte_fiscale',               label: 'Carte fiscale' },
  { value: 'assurance_marchandises',      label: 'Attestation assurance marchandises' },
  { value: 'assurance_rc',                label: 'Assurance RC' },
  { value: 'liste_flotte',                label: 'Liste flotte' },
  { value: 'licence_transport_alimentaire', label: 'Licence transport alimentaire' },
  { value: 'permis_conduire',             label: 'Permis de conduire' },
  { value: 'carte_grise',                 label: 'Carte grise' },
  { value: 'certificat_medical',          label: 'Certificat médical' },
  { value: 'casier_judiciaire',           label: 'Casier judiciaire' },
  { value: 'attestation_hygiene',         label: 'Attestation hygiène alimentaire' },
  { value: 'other',                       label: 'Autre document' },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminDeliveryValidation() {
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<DeliveryProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Review panel
  const [selected, setSelected] = useState<DeliveryProfile | null>(null);
  const [docs, setDocs] = useState<OnboardingDoc[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [rejectModal, setRejectModal] = useState(false);
  const [requestDocModal, setRequestDocModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form state for modals
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [requestDocType, setRequestDocType] = useState('');
  const [requestDocMessage, setRequestDocMessage] = useState('');

  // Flashbar
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string; id: string }[]>([]);

  const addFlash = useCallback((type: 'success' | 'error', msg: string) => {
    const id = Date.now().toString();
    setFlashItems((p) => [...p, { type, content: msg, id }]);
  }, []);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('delivery_profiles')
      .select(`
        organisation_id, delivery_type, validation_status, phone, fleet_size,
        vehicle_types, base_rate, avg_rating, submitted_at, rejection_reason,
        organisations(id, name, country, city, siret, vat_number),
        delivery_capabilities(max_weight_kg, cold_chain, frozen, fragile, last_mile),
        delivery_zones(region)
      `)
      .order('submitted_at', { ascending: true });
    setProfiles((data as DeliveryProfile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  async function openReview(profile: DeliveryProfile) {
    setSelected(profile);
    setDetailLoading(true);
    const [docsRes, auditRes] = await Promise.all([
      supabase
        .from('onboarding_documents')
        .select('*')
        .eq('organisation_id', profile.organisation_id)
        .order('uploaded_at'),
      supabase
        .from('delivery_validation_audit')
        .select('id, action, actor_name, reason, created_at')
        .eq('organisation_id', profile.organisation_id)
        .order('created_at', { ascending: false }),
    ]);
    setDocs((docsRes.data as OnboardingDoc[]) ?? []);
    setAudit((auditRes.data as AuditEntry[]) ?? []);
    setDetailLoading(false);
  }

  // ── Admin actions ─────────────────────────────────────────────────────────

  async function runAction(
    orgId: string,
    newStatus: DeliveryProfile['validation_status'],
    action: string,
    reason: string,
  ) {
    if (!user) return;
    setProcessing(true);
    try {
      const { error: profErr } = await supabase
        .from('delivery_profiles')
        .update({
          validation_status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          rejection_reason: newStatus === 'rejected' ? reason : null,
        })
        .eq('organisation_id', orgId);
      if (profErr) throw profErr;

      if (newStatus === 'validated') {
        await supabase.from('organisations').update({ validation_status: 'active' }).eq('id', orgId);
      } else if (newStatus === 'rejected') {
        await supabase.from('organisations').update({ validation_status: 'rejected' }).eq('id', orgId);
      }

      await supabase.from('delivery_validation_audit').insert({
        organisation_id: orgId,
        action,
        actor_id: user.id,
        actor_name: user.email ?? '',
        reason: reason || null,
      });

      const labels: Record<string, string> = {
        approved: 'Profil validé.',
        rejected: 'Profil refusé.',
        suspended: 'Compte suspendu.',
        reactivated: 'Compte réactivé.',
        requested_info: 'Demande de document envoyée.',
      };
      addFlash('success', labels[action] ?? 'Action enregistrée.');
      setSelected(null);
      setRejectModal(false);
      setRequestDocModal(false);
      fetchProfiles();
    } catch (e) {
      addFlash('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setProcessing(false);
    }
  }

  async function handleApprove() {
    if (!selected) return;
    await runAction(selected.organisation_id, 'validated', 'approved', '');
  }

  async function handleReject() {
    if (!selected) return;
    const reason = [rejectionReason, rejectionNote].filter(Boolean).join(' — ');
    await runAction(selected.organisation_id, 'rejected', 'rejected', reason);
  }

  async function handleSuspend() {
    if (!selected) return;
    await runAction(selected.organisation_id, 'suspended', 'suspended', 'Suspension administrative');
  }

  async function handleReactivate() {
    if (!selected) return;
    await runAction(selected.organisation_id, 'validated', 'reactivated', 'Réactivation administrative');
  }

  async function handleRequestDoc() {
    if (!selected || !requestDocType) return;
    setProcessing(true);
    try {
      await supabase
        .from('delivery_profiles')
        .update({ validation_status: 'pending_info' })
        .eq('organisation_id', selected.organisation_id);

      await supabase.from('delivery_validation_audit').insert({
        organisation_id: selected.organisation_id,
        action: 'requested_info',
        actor_id: user?.id,
        actor_name: user?.email ?? '',
        reason: `Document demandé : ${requestDocType}. ${requestDocMessage}`.trim(),
        metadata: { doc_type: requestDocType, message: requestDocMessage },
      });

      addFlash('success', 'Demande de document envoyée.');
      setRequestDocModal(false);
      setRequestDocType('');
      setRequestDocMessage('');
      fetchProfiles();
      if (selected) openReview({ ...selected, validation_status: 'pending_info' });
    } catch (e) {
      addFlash('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setProcessing(false);
    }
  }

  async function markDocStatus(docId: string, status: OnboardingDoc['status'], notes: string) {
    await supabase.from('onboarding_documents').update({
      status,
      admin_notes: notes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    }).eq('id', docId);
    setDocs((p) => p.map((d) => d.id === docId ? { ...d, status, admin_notes: notes } : d));
  }

  // ── Table renderer ────────────────────────────────────────────────────────

  function renderTable(items: DeliveryProfile[]) {
    return (
      <Table
        loading={loading}
        loadingText="Chargement..."
        trackBy="organisation_id"
        items={items}
        onRowClick={({ detail }) => openReview(detail.item as DeliveryProfile)}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Nom / Entreprise',
            cell: (d: DeliveryProfile) => (
              <Box fontWeight="bold">{d.organisations?.name ?? d.organisation_id.slice(0, 8)}</Box>
            ),
          },
          {
            id: 'submitted',
            header: 'Date soumission',
            cell: (d: DeliveryProfile) =>
              d.submitted_at ? new Date(d.submitted_at).toLocaleDateString('fr-FR') : '—',
          },
          {
            id: 'vehicles',
            header: 'Véhicules',
            cell: (d: DeliveryProfile) =>
              d.vehicle_types?.length > 0 ? d.vehicle_types.slice(0, 2).join(', ') + (d.vehicle_types.length > 2 ? '…' : '') : '—',
          },
          {
            id: 'zones',
            header: 'Zones',
            cell: (d: DeliveryProfile) => {
              const zones = d.delivery_zones?.map((z) => z.region) ?? [];
              return zones.length > 0 ? zones.slice(0, 2).join(', ') + (zones.length > 2 ? `…+${zones.length - 2}` : '') : '—';
            },
          },
          {
            id: 'cold',
            header: 'Chaîne du froid',
            cell: (d: DeliveryProfile) => (
              <StatusIndicator type={d.delivery_capabilities?.[0]?.cold_chain ? 'success' : 'stopped'}>
                {d.delivery_capabilities?.[0]?.cold_chain ? 'Oui' : 'Non'}
              </StatusIndicator>
            ),
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (d: DeliveryProfile) => {
              const cfg = STATUS_CONFIG[d.validation_status] ?? { label: d.validation_status, type: 'info' as const };
              return <StatusIndicator type={cfg.type}>{cfg.label}</StatusIndicator>;
            },
          },
          {
            id: 'actions',
            header: '',
            cell: (d: DeliveryProfile) => (
              <Button variant="inline-link" onClick={(e) => { e.stopPropagation(); openReview(d); }}>
                Réviser
              </Button>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucun dossier dans cette catégorie</b>
          </Box>
        }
      />
    );
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const companies   = profiles.filter((p) => p.delivery_type === 'logistics_company');
  const drivers     = profiles.filter((p) => p.delivery_type === 'independent');
  const pendingList = profiles.filter((p) => ['pending','pending_info'].includes(p.validation_status));

  // ── Review panel ──────────────────────────────────────────────────────────
  const caps = selected?.delivery_capabilities?.[0];
  const zones = selected?.delivery_zones?.map((z) => z.region) ?? [];

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

      <Header
        variant="h1"
        counter={`(${pendingList.length} en attente)`}
        description="Validez ou refusez les candidatures des partenaires de livraison avant qu'ils puissent opérer."
      >
        Validation des partenaires livraison
      </Header>

      <Tabs
        tabs={[
          {
            id: 'companies',
            label: `Sociétés logistiques (${companies.length})`,
            content: renderTable(companies),
          },
          {
            id: 'drivers',
            label: `Chauffeurs livreurs (${drivers.length})`,
            content: renderTable(drivers),
          },
          {
            id: 'all',
            label: `Tous (${profiles.length})`,
            content: renderTable(profiles),
          },
        ]}
      />

      {/* ── PANNEAU DE RÉVISION ───────────────────────────────────────────── */}
      {selected && (
        <Modal
          visible
          size="large"
          onDismiss={() => setSelected(null)}
          header={
            <SpaceBetween direction="horizontal" size="s">
              <span>Révision — {selected.organisations?.name ?? selected.organisation_id.slice(0, 8)}</span>
              {(() => {
                const cfg = STATUS_CONFIG[selected.validation_status] ?? { label: selected.validation_status, type: 'info' as const };
                return <StatusIndicator type={cfg.type}>{cfg.label}</StatusIndicator>;
              })()}
            </SpaceBetween>
          }
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setSelected(null)}>Fermer</Button>

                {['pending','pending_info'].includes(selected.validation_status) && (
                  <Button
                    variant="normal"
                    onClick={() => setRequestDocModal(true)}
                  >
                    Demander un document
                  </Button>
                )}

                {selected.validation_status === 'validated' && (
                  <Button variant="normal" loading={processing} onClick={handleSuspend}>
                    Suspendre
                  </Button>
                )}

                {selected.validation_status === 'suspended' && (
                  <Button variant="primary" loading={processing} onClick={handleReactivate}>
                    Réactiver
                  </Button>
                )}

                {['pending','pending_info'].includes(selected.validation_status) && (
                  <>
                    <Button
                      variant="normal"
                      onClick={() => { setRejectionReason(''); setRejectionNote(''); setRejectModal(true); }}
                    >
                      Refuser
                    </Button>
                    <Button variant="primary" loading={processing} onClick={handleApprove}>
                      Approuver
                    </Button>
                  </>
                )}
              </SpaceBetween>
            </Box>
          }
        >
          {detailLoading ? (
            <Box textAlign="center" padding="l"><Spinner size="large" /></Box>
          ) : (
            <SpaceBetween size="l">

              {/* Informations générales */}
              <ExpandableSection headerText="Informations générales" defaultExpanded>
                <ColumnLayout columns={3} variant="text-grid">
                  <div>
                    <Box variant="awsui-key-label">Organisation</Box>
                    <Box>{selected.organisations?.name ?? '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Pays / Ville</Box>
                    <Box>{[selected.organisations?.city, selected.organisations?.country].filter(Boolean).join(', ') || '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Type de partenaire</Box>
                    <Box>
                      <Badge color="blue">
                        {selected.delivery_type === 'logistics_company' ? 'Société logistique' : selected.delivery_type === 'independent' ? 'Chauffeur indépendant' : 'Flotte interne'}
                      </Badge>
                    </Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">N° SIRET / RC</Box>
                    <Box>{selected.organisations?.siret ?? '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">N° TVA / Fiscal</Box>
                    <Box>{selected.organisations?.vat_number ?? '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Téléphone</Box>
                    <Box>{selected.phone ?? '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Taille flotte</Box>
                    <Box>{selected.fleet_size ?? '—'} véhicule{selected.fleet_size !== 1 ? 's' : ''}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Types de véhicules</Box>
                    <Box>{selected.vehicle_types?.join(', ') || '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Tarif de base</Box>
                    <Box>{selected.base_rate ? `${selected.base_rate} MAD/km` : '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Zones de couverture</Box>
                    <Box>{zones.join(', ') || '—'}</Box>
                  </div>
                  {caps && (
                    <>
                      <div>
                        <Box variant="awsui-key-label">Charge max.</Box>
                        <Box>{caps.max_weight_kg ? `${caps.max_weight_kg} kg` : '—'}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Capacités spéciales</Box>
                        <SpaceBetween direction="horizontal" size="xs">
                          {caps.cold_chain && <Badge color="green">Chaîne du froid</Badge>}
                          {caps.frozen && <Badge color="blue">Congelé</Badge>}
                          {caps.fragile && <Badge color="grey">Fragile</Badge>}
                          {caps.last_mile && <Badge color="grey">Dernier km</Badge>}
                          {!caps.cold_chain && !caps.frozen && !caps.fragile && !caps.last_mile && <Box>—</Box>}
                        </SpaceBetween>
                      </div>
                    </>
                  )}
                  <div>
                    <Box variant="awsui-key-label">Date de soumission</Box>
                    <Box>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleString('fr-FR') : '—'}</Box>
                  </div>
                </ColumnLayout>
              </ExpandableSection>

              {/* Documents */}
              <ExpandableSection
                headerText={`Documents (${docs.length})`}
                defaultExpanded
              >
                {docs.length === 0 ? (
                  <Box color="text-body-secondary">Aucun document soumis.</Box>
                ) : (
                  <Table
                    trackBy="id"
                    items={docs}
                    columnDefinitions={[
                      {
                        id: 'label',
                        header: 'Document',
                        cell: (d: OnboardingDoc) => d.document_label,
                      },
                      {
                        id: 'file',
                        header: 'Fichier',
                        cell: (d: OnboardingDoc) =>
                          d.file_url ? (
                            <Button
                              variant="inline-link"
                              onClick={() => window.open(d.file_url!, '_blank')}
                            >
                              {d.file_name ?? 'Ouvrir'}
                            </Button>
                          ) : (
                            <Box color="text-status-error">Non soumis</Box>
                          ),
                      },
                      {
                        id: 'status',
                        header: 'Vérification',
                        cell: (d: OnboardingDoc) => {
                          const map: Record<string, { label: string; type: 'success' | 'warning' | 'error' }> = {
                            submitted:       { label: 'Soumis',           type: 'warning'  },
                            verified:        { label: 'Vérifié ✓',        type: 'success'  },
                            issue_detected:  { label: 'Problème détecté', type: 'error'    },
                          };
                          const cfg = map[d.status] ?? { label: d.status, type: 'warning' as const };
                          return <StatusIndicator type={cfg.type}>{cfg.label}</StatusIndicator>;
                        },
                      },
                      {
                        id: 'notes',
                        header: 'Notes admin',
                        cell: (d: OnboardingDoc) => d.admin_notes ?? '—',
                      },
                      {
                        id: 'mark',
                        header: '',
                        cell: (d: OnboardingDoc) => (
                          <SpaceBetween direction="horizontal" size="xs">
                            <Button
                              variant="inline-link"
                              disabled={d.status === 'verified'}
                              onClick={() => markDocStatus(d.id, 'verified', '')}
                            >
                              ✓ Vérifier
                            </Button>
                            <Button
                              variant="inline-link"
                              disabled={d.status === 'issue_detected'}
                              onClick={() => {
                                const note = window.prompt('Note sur le problème :') ?? '';
                                markDocStatus(d.id, 'issue_detected', note);
                              }}
                            >
                              ⚠ Signaler
                            </Button>
                          </SpaceBetween>
                        ),
                      },
                    ]}
                  />
                )}
              </ExpandableSection>

              {/* Journal d'audit */}
              <ExpandableSection headerText={`Journal d'audit (${audit.length})`}>
                {audit.length === 0 ? (
                  <Box color="text-body-secondary">Aucune entrée d'audit.</Box>
                ) : (
                  <Table
                    trackBy="id"
                    items={audit}
                    columnDefinitions={[
                      {
                        id: 'date',
                        header: 'Date',
                        cell: (a: AuditEntry) => new Date(a.created_at).toLocaleString('fr-FR'),
                      },
                      {
                        id: 'action',
                        header: 'Action',
                        cell: (a: AuditEntry) => (
                          <Badge color={
                            a.action === 'approved' || a.action === 'reactivated' ? 'green' :
                            a.action === 'rejected' || a.action === 'suspended' ? 'red' :
                            'grey'
                          }>
                            {ACTION_LABELS[a.action] ?? a.action}
                          </Badge>
                        ),
                      },
                      {
                        id: 'actor',
                        header: 'Opérateur',
                        cell: (a: AuditEntry) => a.actor_name ?? '—',
                      },
                      {
                        id: 'reason',
                        header: 'Motif / Note',
                        cell: (a: AuditEntry) => a.reason ?? '—',
                      },
                    ]}
                  />
                )}
              </ExpandableSection>

            </SpaceBetween>
          )}
        </Modal>
      )}

      {/* ── MODAL REFUS ───────────────────────────────────────────────────── */}
      {rejectModal && selected && (
        <Modal
          visible
          size="medium"
          onDismiss={() => setRejectModal(false)}
          header={`Refuser : ${selected.organisations?.name}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setRejectModal(false)}>Annuler</Button>
                <Button
                  variant="normal"
                  loading={processing}
                  disabled={!rejectionReason}
                  onClick={handleReject}
                >
                  Confirmer le refus
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Alert type="warning">
              Le partenaire sera notifié par email avec le motif du refus.
              Il pourra soumettre une nouvelle candidature.
            </Alert>
            <FormField label="Motif principal" constraintText="Obligatoire">
              <Select
                placeholder="Sélectionner un motif..."
                selectedOption={rejectionReason ? { value: rejectionReason, label: rejectionReason } : null}
                onChange={({ detail }) => setRejectionReason(detail.selectedOption?.value ?? '')}
                options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
              />
            </FormField>
            <FormField label="Note complémentaire (optionnel)">
              <Textarea
                value={rejectionNote}
                onChange={({ detail }) => setRejectionNote(detail.value)}
                placeholder="Précisez les documents manquants ou les corrections à apporter..."
                rows={3}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}

      {/* ── MODAL DEMANDE DE DOCUMENT ─────────────────────────────────────── */}
      {requestDocModal && selected && (
        <Modal
          visible
          size="medium"
          onDismiss={() => setRequestDocModal(false)}
          header="Demander un document complémentaire"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setRequestDocModal(false)}>Annuler</Button>
                <Button
                  variant="primary"
                  loading={processing}
                  disabled={!requestDocType}
                  onClick={handleRequestDoc}
                >
                  Envoyer la demande
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Alert type="info">
              Le partenaire recevra une notification in-app et par email avec votre demande.
              Son dossier passera en statut « Info demandée ».
            </Alert>
            <FormField label="Type de document requis" constraintText="Obligatoire">
              <Select
                placeholder="Sélectionner le document..."
                selectedOption={requestDocType ? DOC_TYPE_OPTIONS.find((o) => o.value === requestDocType) ?? null : null}
                onChange={({ detail }) => setRequestDocType(detail.selectedOption?.value ?? '')}
                options={DOC_TYPE_OPTIONS}
              />
            </FormField>
            <FormField label="Message au partenaire (optionnel)">
              <Textarea
                value={requestDocMessage}
                onChange={({ detail }) => setRequestDocMessage(detail.value)}
                placeholder="Précisez les exigences : format, période de validité, tampon officiel, etc."
                rows={3}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
