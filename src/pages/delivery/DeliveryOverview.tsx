import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Box,
  ColumnLayout,
  StatusIndicator,
  Table,
  Badge,
  Spinner,
  Alert,
  Tabs,
  Modal,
  FormField,
  Textarea,
  Flashbar,
  Select,
  Input,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  generateOrdreLivraisonPDF, generateBonLivraisonPDF,
  generateOrdreMissionPDF, generateNoteFraisPDF,
} from '../../lib/pdf/pdfUtils';
import type { DeliveryTicket } from '../../types';

interface TicketWithMethod extends DeliveryTicket {
  orders?: { delivery_method: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Disponible',
  assigned: 'Assigné',
  picked_up: 'Pris en charge',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

const STATUS_NEXT: Record<string, { next: string; label: string; variant: 'primary' | 'normal' | 'link' }[]> = {
  assigned:  [{ next: 'picked_up',  label: 'Marquer enlevé',  variant: 'primary' }],
  picked_up: [{ next: 'in_transit', label: 'En transit',      variant: 'primary' }],
  in_transit:[{ next: 'delivered',  label: 'Marquer livré',   variant: 'primary' }],
};

function statusType(status: string): 'success' | 'warning' | 'error' | 'info' | 'stopped' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'stopped'> = {
    delivered: 'success', in_transit: 'info', picked_up: 'info',
    assigned: 'info', open: 'warning', cancelled: 'stopped',
  };
  return map[status] ?? 'info';
}

interface PendingDoc {
  document_label: string;
  status: 'submitted' | 'verified' | 'issue_detected';
}

function PendingDashboard({
  validationStatus,
  pendingDocs,
  onAddDoc,
}: {
  validationStatus: string;
  pendingDocs: PendingDoc[];
  onAddDoc: () => void;
}) {
  const navigate = useNavigate();

  const steps = [
    { label: 'Inscription', done: true },
    { label: 'Vérification des documents', done: validationStatus === 'validated' },
    { label: 'Décision de l\'administration', done: validationStatus === 'validated' },
  ];

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Button variant="primary" onClick={() => navigate('/delivery/onboarding')}>
                Compléter mon dossier
              </Button>
            }
          >
            Statut de votre dossier
          </Header>
        }
      >
        <SpaceBetween size="m">
          {validationStatus === 'pending_info' && (
            <Alert type="warning" header="Document complémentaire requis">
              L'équipe Stock212 a besoin d'un document supplémentaire. Consultez la liste ci-dessous et
              téléversez le document manquant via le bouton « Compléter mon dossier ».
            </Alert>
          )}

          <ColumnLayout columns={3} variant="text-grid">
            {steps.map((s, i) => (
              <div key={i}>
                <Box variant="awsui-key-label">{s.label}</Box>
                <StatusIndicator type={s.done ? 'success' : i === 1 ? 'in-progress' : 'pending'}>
                  {s.done ? 'Complété' : i === 1 ? 'En cours' : 'En attente'}
                </StatusIndicator>
              </div>
            ))}
          </ColumnLayout>

          <Box>
            <Badge color="blue">Dossier en cours d'examen</Badge>
            <Box variant="p" color="text-body-secondary" padding={{ top: 'xs' }}>
              Délai de traitement habituel : <strong>2 jours ouvrables</strong>. Vous serez notifié par email dès qu'une décision sera prise.
            </Box>
          </Box>

          {pendingDocs.length > 0 && (
            <Box>
              <Box variant="awsui-key-label" padding={{ bottom: 'xs' }}>Documents soumis</Box>
              <SpaceBetween size="xs">
                {pendingDocs.map((d, i) => (
                  <Box key={i} display="inline">
                    <StatusIndicator
                      type={
                        d.status === 'verified' ? 'success'
                        : d.status === 'issue_detected' ? 'error'
                        : 'pending'
                      }
                    >
                      {d.document_label} — {
                        d.status === 'verified' ? 'Vérifié'
                        : d.status === 'issue_detected' ? 'En attente de révision'
                        : 'Soumis'
                      }
                    </StatusIndicator>
                  </Box>
                ))}
              </SpaceBetween>
            </Box>
          )}

          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onAddDoc}>+ Ajouter un document manquant</Button>
            <Button variant="link" href="mailto:support@stock212.ma">Contacter le support</Button>
          </SpaceBetween>
        </SpaceBetween>
      </Container>

      <Alert type="info">
        Les onglets Missions, Tickets disponibles, Historique et Frais de mission seront accessibles
        une fois votre dossier validé par l'administration Stock212.
      </Alert>
    </SpaceBetween>
  );
}

export default function DeliveryOverview() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const [myTickets, setMyTickets] = useState<TicketWithMethod[]>([]);
  const [availableTickets, setAvailableTickets] = useState<TicketWithMethod[]>([]);
  const [completedTickets, setCompletedTickets] = useState<TicketWithMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [validationStatus, setValidationStatus] = useState<string>('');
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<DeliveryTicket | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string; id: string }[]>([]);
  // Note de frais
  const [expenseModal, setExpenseModal] = useState<DeliveryTicket | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [ndfPdfLoading, setNdfPdfLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({
    expense_type: 'fuel', description: '', expense_date: new Date().toISOString().split('T')[0],
    amount_ht: '', tva_rate: '20', receipt_ref: '',
  });
  const [addingExpense, setAddingExpense] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const profileRes = await supabase
      .from('delivery_profiles')
      .select('validation_status, avg_rating')
      .eq('organisation_id', activeOrg.id)
      .maybeSingle();

    if (!profileRes.data) {
      setProfileExists(false);
      setLoading(false);
      return;
    }

    setProfileExists(true);
    const status = profileRes.data.validation_status;
    setValidationStatus(status);
    setAvgRating(profileRes.data.avg_rating ?? 0);

    if (status !== 'validated') {
      // Load onboarding docs for the pending dashboard
      const { data: docsData } = await supabase
        .from('onboarding_documents')
        .select('document_label, status')
        .eq('organisation_id', activeOrg.id)
        .order('uploaded_at');
      setPendingDocs((docsData as PendingDoc[]) ?? []);
      setLoading(false);
      return;
    }

    // Only load tickets for validated delivery actors
    const [myActiveRes, myDoneRes, availRes] = await Promise.all([
      supabase
        .from('delivery_tickets')
        .select('*, orders(delivery_method)')
        .eq('assigned_delivery_id', activeOrg.id)
        .not('status', 'in', '(delivered,cancelled)')
        .order('created_at', { ascending: false }),
      supabase
        .from('delivery_tickets')
        .select('*, orders(delivery_method)')
        .eq('assigned_delivery_id', activeOrg.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('delivery_tickets')
        .select('*, orders(delivery_method)')
        .eq('status', 'open')
        .is('assigned_delivery_id', null)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    setMyTickets((myActiveRes.data as TicketWithMethod[]) ?? []);
    setCompletedTickets((myDoneRes.data as TicketWithMethod[]) ?? []);
    setAvailableTickets((availRes.data as TicketWithMethod[]) ?? []);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  function addFlash(type: 'success' | 'error', content: string) {
    const id = Date.now().toString();
    setFlashItems((prev) => [...prev, { type, content, id }]);
  }

  async function openExpenseModal(ticket: DeliveryTicket) {
    setExpenseModal(ticket);
    setExpensesLoading(true);
    const { data } = await supabase
      .from('mission_expenses')
      .select('*')
      .eq('delivery_ticket_id', ticket.id)
      .order('expense_date');
    setExpenses(data ?? []);
    setExpensesLoading(false);
  }

  async function addExpenseLine() {
    if (!expenseModal || !newExpense.amount_ht) return;
    setAddingExpense(true);
    const { data, error } = await supabase
      .from('mission_expenses')
      .insert({
        delivery_ticket_id: expenseModal.id,
        expense_type:  newExpense.expense_type,
        description:   newExpense.description || null,
        expense_date:  newExpense.expense_date,
        amount_ht:     Number(newExpense.amount_ht),
        tva_rate:      Number(newExpense.tva_rate),
        receipt_ref:   newExpense.receipt_ref || null,
      })
      .select()
      .single();
    if (error) {
      addFlash('error', error.message);
    } else {
      setExpenses((prev) => [...prev, data]);
      setNewExpense({ expense_type: 'fuel', description: '', expense_date: new Date().toISOString().split('T')[0], amount_ht: '', tva_rate: '20', receipt_ref: '' });
    }
    setAddingExpense(false);
  }

  async function deleteExpense(id: string) {
    await supabase.from('mission_expenses').delete().eq('id', id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function acceptTicket(ticket: DeliveryTicket) {
    if (!activeOrg) return;
    setAccepting(ticket.id);
    const { error } = await supabase
      .from('delivery_tickets')
      .update({
        assigned_delivery_id: activeOrg.id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .eq('status', 'open');
    if (error) {
      addFlash('error', error.message);
    } else {
      addFlash('success', `Mission ${ticket.ticket_number} acceptée.`);
      load();
    }
    setAccepting(null);
  }

  async function updateStatus(ticket: DeliveryTicket, next: string) {
    if (next === 'delivered') {
      setDeliveryModal(ticket);
      return;
    }
    setUpdatingTicket(ticket.id);
    const updates: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
    if (next === 'picked_up') updates.picked_up_at = new Date().toISOString();
    const { error } = await supabase.from('delivery_tickets').update(updates).eq('id', ticket.id);
    if (error) {
      addFlash('error', error.message);
    } else {
      if (next === 'picked_up' && ticket.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'shipped', updated_at: new Date().toISOString() })
          .eq('id', ticket.order_id);
      }
      load();
    }
    setUpdatingTicket(null);
  }

  async function confirmDelivered() {
    if (!deliveryModal) return;
    setUpdatingTicket(deliveryModal.id);
    const { error } = await supabase
      .from('delivery_tickets')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        proof_url: proofNote || null,
      })
      .eq('id', deliveryModal.id);
    if (error) {
      addFlash('error', error.message);
    } else {
      if (deliveryModal.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('id', deliveryModal.order_id);
      }
      addFlash('success', `Livraison ${deliveryModal.ticket_number} confirmée.`);
      setDeliveryModal(null);
      setProofNote('');
      load();
    }
    setUpdatingTicket(null);
  }

  const ticketCard = (ticket: TicketWithMethod, isMyTicket: boolean) => {
    const pickupAddr = ticket.pickup_address as Record<string, string>;
    const delivAddr = ticket.delivery_address as Record<string, string>;
    const parcel = ticket.parcel_details as Record<string, string>;
    const actions = isMyTicket ? (STATUS_NEXT[ticket.status] ?? []) : [];

    return (
      <Container
        key={ticket.id}
        header={
          <Header
            variant="h3"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {isMyTicket
                  ? (
                    <>
                      <Button
                        iconName="download"
                        variant="normal"
                        onClick={async () => {
                          try { await generateBonLivraisonPDF(ticket.id); }
                          catch (e) { addFlash('error', `BL : ${e instanceof Error ? e.message : 'Erreur'}`); }
                        }}
                      >
                        Bon de livraison
                      </Button>
                      <Button
                        iconName="download"
                        variant="normal"
                        onClick={async () => {
                          try { await generateOrdreLivraisonPDF(ticket.id); }
                          catch (e) { addFlash('error', `OL : ${e instanceof Error ? e.message : 'Erreur'}`); }
                        }}
                      >
                        Ordre de livraison
                      </Button>
                      <Button
                        iconName="file"
                        variant="normal"
                        onClick={async () => {
                          try { await generateOrdreMissionPDF(ticket.id); }
                          catch (e) { addFlash('error', `OM : ${e instanceof Error ? e.message : 'Erreur'}`); }
                        }}
                      >
                        Ordre de mission
                      </Button>
                      <Button
                        iconName="edit"
                        variant="normal"
                        onClick={() => openExpenseModal(ticket)}
                      >
                        Note de frais
                      </Button>
                      {actions.map((a) => (
                        <Button
                          key={a.next}
                          variant={a.variant}
                          loading={updatingTicket === ticket.id}
                          onClick={() => updateStatus(ticket, a.next)}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </>
                  )
                  : (
                    <Button
                      variant="primary"
                      loading={accepting === ticket.id}
                      onClick={() => acceptTicket(ticket)}
                    >
                      Accepter la mission
                    </Button>
                  )
                }
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="horizontal" size="s">
              <span>{ticket.ticket_number}</span>
              {isMyTicket && (
                <StatusIndicator type={statusType(ticket.status)}>
                  {STATUS_LABELS[ticket.status]}
                </StatusIndicator>
              )}
              <Badge color={ticket.priority === 'express' ? 'red' : 'grey'}>
                {ticket.priority === 'express' ? 'Express' : 'Normal'}
              </Badge>
              {ticket.orders?.delivery_method === 'stock212'
                ? <Badge color="blue">Assigné par Stock212</Badge>
                : ticket.orders?.delivery_method
                  ? <Badge color="grey">Choisi par acheteur</Badge>
                  : null}
            </SpaceBetween>
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Enlèvement</Box>
            <Box>{[pickupAddr?.line1, pickupAddr?.city].filter(Boolean).join(', ') || '—'}</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Destination</Box>
            <Box>{[delivAddr?.line1, delivAddr?.city, delivAddr?.postal_code].filter(Boolean).join(', ') || '—'}</Box>
          </div>
          {isMyTicket && parcel?.tracking_ref && (
            <div>
              <Box variant="awsui-key-label">Réf. suivi</Box>
              <Box>{parcel.tracking_ref}</Box>
            </div>
          )}
          <div>
            <Box variant="awsui-key-label">Publié le</Box>
            <Box>{new Date(ticket.created_at).toLocaleString('fr-FR')}</Box>
          </div>
        </ColumnLayout>
      </Container>
    );
  };

  // ── Gating: no profile yet ────────────────────────────────────────────────
  if (!loading && profileExists === false) {
    return (
      <SpaceBetween size="l">
        <Header variant="h1">Bienvenue — Partenaire de livraison</Header>
        <Alert
          type="info"
          header="Complétez votre dossier pour accéder au réseau Stock212"
          action={
            <Button variant="primary" onClick={() => navigate('/delivery/onboarding')}>
              Commencer l'inscription
            </Button>
          }
        >
          Votre compte a été créé. Pour opérer sur la plateforme, vous devez soumettre votre dossier
          de candidature et attendre la validation par l'administration Stock212.
        </Alert>
      </SpaceBetween>
    );
  }

  // ── Gating: pending / pending_info ────────────────────────────────────────
  if (!loading && validationStatus && validationStatus !== 'validated') {
    if (validationStatus === 'rejected') {
      return (
        <SpaceBetween size="l">
          <Header variant="h1">Tableau de bord — Livreur</Header>
          <Alert type="error" header="Candidature refusée">
            Votre dossier a été refusé. Contactez le support à <strong>support@stock212.ma</strong> pour
            connaître les raisons et les étapes pour soumettre une nouvelle candidature.
          </Alert>
        </SpaceBetween>
      );
    }
    if (validationStatus === 'suspended') {
      return (
        <SpaceBetween size="l">
          <Header variant="h1">Tableau de bord — Livreur</Header>
          <Alert type="error" header="Compte temporairement suspendu">
            Votre compte partenaire est suspendu. Contactez le support Stock212 pour plus d'informations.
          </Alert>
        </SpaceBetween>
      );
    }
    return (
      <SpaceBetween size="l">
        <Header variant="h1">Tableau de bord — Livreur</Header>
        <PendingDashboard
          validationStatus={validationStatus}
          pendingDocs={pendingDocs}
          onAddDoc={() => navigate('/delivery/onboarding')}
        />
      </SpaceBetween>
    );
  }

  return (
    <SpaceBetween size="l">
      {flashItems.length > 0 && (
        <Flashbar
          items={flashItems.map((f) => ({
            type: f.type,
            content: f.content,
            id: f.id,
            dismissible: true,
            onDismiss: () => setFlashItems((prev) => prev.filter((x) => x.id !== f.id)),
          }))}
        />
      )}

      <Header variant="h1">Vue d'ensemble — Livreur</Header>

      {/* KPIs */}
      <ColumnLayout columns={3} variant="text-grid">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Container key={i}><Box textAlign="center"><Spinner /></Box></Container>
          ))
        ) : (
          <>
            <div>
              <Box variant="awsui-key-label">Missions actives</Box>
              <Box fontSize="heading-xl" fontWeight="bold" color="text-status-info">
                {myTickets.length}
              </Box>
              <Box color="text-body-secondary" fontSize="body-s">En cours</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Tickets disponibles</Box>
              <Box fontSize="heading-xl" fontWeight="bold" color="text-status-warning">
                {availableTickets.length}
              </Box>
              <Box color="text-body-secondary" fontSize="body-s">À prendre</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Note moyenne</Box>
              <Box fontSize="heading-xl" fontWeight="bold" color="text-status-success">
                {avgRating > 0 ? `${avgRating.toFixed(1)}/5` : '—'}
              </Box>
              <Box color="text-body-secondary" fontSize="body-s">Satisfaction clients</Box>
            </div>
          </>
        )}
      </ColumnLayout>

      <Tabs
        tabs={[
          {
            id: 'my',
            label: `Mes missions (${myTickets.length})`,
            content: (
              <SpaceBetween size="s">
                {loading ? (
                  <Box textAlign="center"><Spinner /></Box>
                ) : myTickets.length === 0 ? (
                  <Box textAlign="center" color="text-body-secondary" padding="l">
                    Aucune mission en cours. Consultez l'onglet « Disponibles » pour en accepter.
                  </Box>
                ) : (
                  myTickets.map((t) => ticketCard(t, true))
                )}
              </SpaceBetween>
            ),
          },
          {
            id: 'available',
            label: `Disponibles (${availableTickets.length})`,
            content: (
              <SpaceBetween size="s">
                {loading ? (
                  <Box textAlign="center"><Spinner /></Box>
                ) : availableTickets.length === 0 ? (
                  <Box textAlign="center" color="text-body-secondary" padding="l">
                    Aucun ticket disponible pour le moment.
                  </Box>
                ) : (
                  availableTickets.map((t) => ticketCard(t, false))
                )}
              </SpaceBetween>
            ),
          },
          {
            id: 'history',
            label: `Historique (${completedTickets.length})`,
            content: (
              <Table
                loading={loading}
                loadingText="Chargement..."
                trackBy="id"
                items={completedTickets}
                columnDefinitions={[
                  { id: 'n',    header: 'N° Ticket',    cell: (t: DeliveryTicket) => t.ticket_number },
                  { id: 'dest', header: 'Destination',  cell: (t: DeliveryTicket) => { const a = t.delivery_address as Record<string, string>; return a?.city ?? '—'; } },
                  { id: 'prio', header: 'Priorité',     cell: (t: DeliveryTicket) => <Badge color={t.priority === 'express' ? 'red' : 'grey'}>{t.priority === 'express' ? 'Express' : 'Normal'}</Badge> },
                  { id: 'stat', header: 'Statut',       cell: () => <StatusIndicator type="success">Livré</StatusIndicator> },
                  { id: 'date', header: 'Date',         cell: (t: DeliveryTicket) => new Date(t.created_at).toLocaleDateString('fr-FR') },
                ]}
                empty={<Box textAlign="center" color="inherit"><b>Aucune livraison complétée</b></Box>}
              />
            ),
          },
        ]}
      />

      {/* ── MODAL NOTE DE FRAIS ───────────────────────────────────── */}
      {expenseModal && (
        <Modal
          visible
          size="large"
          onDismiss={() => setExpenseModal(null)}
          header={`Note de frais — ${expenseModal.ticket_number}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setExpenseModal(null)}>Fermer</Button>
                <Button
                  variant="primary"
                  iconName="download"
                  loading={ndfPdfLoading}
                  onClick={async () => {
                    setNdfPdfLoading(true);
                    try { await generateNoteFraisPDF(expenseModal.id); }
                    catch (e) { addFlash('error', `NDF : ${e instanceof Error ? e.message : 'Erreur'}`); }
                    finally { setNdfPdfLoading(false); }
                  }}
                >
                  Générer Note de frais PDF
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            {/* Formulaire d'ajout */}
            <Box>
              <Box variant="awsui-key-label" padding={{ bottom: 'xs' }}>Ajouter une dépense</Box>
              <ColumnLayout columns={3} variant="text-grid">
                <FormField label="Nature">
                  <Select
                    selectedOption={{ value: newExpense.expense_type, label: {
                      fuel: 'Carburant', toll: 'Péage', parking: 'Parking',
                      meal: 'Repas', lodging: 'Hébergement', other: 'Autre',
                    }[newExpense.expense_type] ?? 'Autre' }}
                    onChange={({ detail }) => setNewExpense((p) => ({ ...p, expense_type: detail.selectedOption.value ?? 'other' }))}
                    options={[
                      { value: 'fuel',    label: 'Carburant' },
                      { value: 'toll',    label: 'Péage' },
                      { value: 'parking', label: 'Parking' },
                      { value: 'meal',    label: 'Repas' },
                      { value: 'lodging', label: 'Hébergement' },
                      { value: 'other',   label: 'Autre' },
                    ]}
                  />
                </FormField>
                <FormField label="Description (optionnel)">
                  <Input
                    value={newExpense.description}
                    onChange={({ detail }) => setNewExpense((p) => ({ ...p, description: detail.value }))}
                    placeholder="Ex: Autoroute A1 Casablanca"
                  />
                </FormField>
                <FormField label="Date">
                  <Input
                    type="date"
                    value={newExpense.expense_date}
                    onChange={({ detail }) => setNewExpense((p) => ({ ...p, expense_date: detail.value }))}
                  />
                </FormField>
                <FormField label="Montant HT (MAD)">
                  <Input
                    type="number"
                    value={newExpense.amount_ht}
                    onChange={({ detail }) => setNewExpense((p) => ({ ...p, amount_ht: detail.value }))}
                    placeholder="0.00"
                  />
                </FormField>
                <FormField label="Taux TVA (%)">
                  <Select
                    selectedOption={{ value: newExpense.tva_rate, label: `${newExpense.tva_rate}%` }}
                    onChange={({ detail }) => setNewExpense((p) => ({ ...p, tva_rate: detail.selectedOption.value ?? '20' }))}
                    options={[
                      { value: '0',  label: '0% (exonéré)' },
                      { value: '10', label: '10%' },
                      { value: '20', label: '20%' },
                    ]}
                  />
                </FormField>
                <FormField label="Réf. justificatif (optionnel)">
                  <Input
                    value={newExpense.receipt_ref}
                    onChange={({ detail }) => setNewExpense((p) => ({ ...p, receipt_ref: detail.value }))}
                    placeholder="Ex: TICKET-001"
                  />
                </FormField>
              </ColumnLayout>
              <Box padding={{ top: 's' }}>
                <Button
                  variant="primary"
                  disabled={!newExpense.amount_ht}
                  loading={addingExpense}
                  onClick={addExpenseLine}
                >
                  Ajouter la dépense
                </Button>
              </Box>
            </Box>

            {/* Liste des dépenses */}
            <Table
              loading={expensesLoading}
              loadingText="Chargement des frais..."
              trackBy="id"
              items={expenses}
              columnDefinitions={[
                { id: 'date',    header: 'Date',         cell: (e: any) => e.expense_date },
                { id: 'type',    header: 'Nature',       cell: (e: any) => ({ fuel: 'Carburant', toll: 'Péage', parking: 'Parking', meal: 'Repas', lodging: 'Hébergement', other: 'Autre' }[e.expense_type as string] ?? e.expense_type) },
                { id: 'desc',    header: 'Description',  cell: (e: any) => e.description ?? '—' },
                { id: 'ht',      header: 'Montant HT',   cell: (e: any) => `${Number(e.amount_ht).toFixed(2)} MAD` },
                { id: 'tva',     header: 'TVA',          cell: (e: any) => `${e.tva_rate}%` },
                { id: 'ttc',     header: 'Montant TTC',  cell: (e: any) => `${(Number(e.amount_ht) * (1 + Number(e.tva_rate) / 100)).toFixed(2)} MAD` },
                { id: 'ref',     header: 'Justificatif', cell: (e: any) => e.receipt_ref ?? '—' },
                {
                  id: 'del',
                  header: '',
                  cell: (e: any) => (
                    <Button variant="inline-link" onClick={() => deleteExpense(e.id)}>
                      Supprimer
                    </Button>
                  ),
                },
              ]}
              footer={
                expenses.length > 0 ? (
                  <Box textAlign="right" fontWeight="bold">
                    Total TTC : {expenses.reduce((s, e) => s + Number(e.amount_ht) * (1 + Number(e.tva_rate) / 100), 0).toFixed(2)} MAD
                  </Box>
                ) : undefined
              }
              empty={
                <Box textAlign="center" color="inherit">
                  {expensesLoading ? '' : 'Aucune dépense enregistrée. Ajoutez une ligne ci-dessus.'}
                </Box>
              }
            />
          </SpaceBetween>
        </Modal>
      )}

      {/* Confirmation livraison */}
      {deliveryModal && (
        <Modal
          visible
          onDismiss={() => setDeliveryModal(null)}
          header={`Confirmer la livraison — ${deliveryModal.ticket_number}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setDeliveryModal(null)}>Annuler</Button>
                <Button variant="primary" loading={!!updatingTicket} onClick={confirmDelivered}>
                  Confirmer la livraison
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Alert type="info">
              Cette action marquera la commande comme livrée et notifiera l'acheteur.
            </Alert>
            <FormField
              label="Preuve / note de livraison (optionnel)"
              description="Référence du récépissé, signature, ou note de remise."
            >
              <Textarea
                value={proofNote}
                onChange={({ detail }) => setProofNote(detail.value)}
                placeholder="Ex: Remis en mains propres — signature M. Alami, 14h30"
                rows={3}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
