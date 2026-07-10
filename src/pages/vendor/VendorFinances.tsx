import { useEffect, useRef, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Badge, Box,
  Alert, ColumnLayout, Modal, FormField, Input, Select,
  StatusIndicator, TextFilter, Pagination, Tabs,
  Container, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fmtEUR, INV_STATUS, REM_STATUS, type InvStatus, type ReminderStatus } from '../../lib/vendorUtils';
import { generateInvoicePDF, generateAvoirPDF, generateReleveComptePDF } from '../../lib/pdf/pdfUtils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Invoice {
  id: string; number: string; buyer_name: string; buyer_ice: string;
  amount: number; amount_paid: number; issued: string; due: string;
  status: InvStatus; order_id: string; buyer_org_id: string;
}
interface Reminder {
  id: string; buyer: string; invoice_number: string;
  amount: number; due: string; days_late: number;
  status: ReminderStatus; last_sent?: string;
}
interface WalletTx {
  id: string; date: string; label: string; ref: string;
  type: 'credit' | 'debit'; amount: number; balance: number;
}

// ── Helpers DB → UI ───────────────────────────────────────────────────────────
function dbStatusToUI(dbStatus: string, dueAt: string | null): InvStatus {
  if (dbStatus === 'paid') return 'paid';
  if (dbStatus === 'overdue') return 'overdue';
  if (dueAt && new Date(dueAt) < new Date()) return 'overdue';
  return 'pending';
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VendorFinances() {
  const { activeOrg } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [walletTxs, setWalletTxs] = useState<WalletTx[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingSettlement, setPendingSettlement] = useState(0);
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<InvStatus | 'all'>('all');
  const [showVirementModal, setShowVirementModal] = useState(false);
  const [virementAmount, setVirementAmount] = useState('');
  const [virementLoading, setVirementLoading] = useState(false);
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string }[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 8;

  // Cleanup flash timer on unmount
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  function flash(type: 'success' | 'error', content: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashItems([{ type, content }]);
    flashTimer.current = setTimeout(() => setFlashItems([]), 4000);
  }

  async function fetchInvoices() {
    if (!activeOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`id, invoice_number, issued_at, due_at, status, amount_ttc, amount_paid,
               orders!inner(id, order_number, seller_org_id, buyer_org_id,
                 buyer_org:organisations!buyer_org_id(name, vat_number))`)
      .eq('orders.seller_org_id', activeOrg.id)
      .order('issued_at', { ascending: false });

    if (error) { flash('error', error.message); setLoading(false); return; }

    const rows = (data ?? []) as Array<{
      id: string; invoice_number: string; issued_at: string; due_at: string | null;
      status: string; amount_ttc: number; amount_paid: number;
      orders: {
        id: string; order_number: string; buyer_org_id: string;
        buyer_org: { name: string; vat_number: string | null } | null;
      };
    }>;

    const uiInvoices: Invoice[] = rows.map((r) => ({
      id: r.id,
      number: r.invoice_number,
      buyer_name: r.orders.buyer_org?.name ?? r.orders.order_number,
      buyer_ice: r.orders.buyer_org?.vat_number ?? '—',
      amount: r.amount_ttc,
      amount_paid: r.amount_paid ?? 0,
      issued: r.issued_at,
      due: r.due_at ?? '',
      status: dbStatusToUI(r.status, r.due_at),
      order_id: r.orders.id,
      buyer_org_id: r.orders.buyer_org_id,
    }));

    setInvoices(uiInvoices);

    const overdueReminders: Reminder[] = uiInvoices
      .filter((i) => i.status === 'overdue')
      .map((i) => {
        const daysLate = i.due
          ? Math.max(0, Math.floor((Date.now() - new Date(i.due).getTime()) / 86400000))
          : 0;
        return {
          id: `rem-${i.id}`,
          buyer: i.buyer_name,
          invoice_number: i.number,
          amount: i.amount,
          due: i.due,
          days_late: daysLate,
          status: daysLate > 30 ? 'litigation' : 'to_send' as ReminderStatus,
        };
      });
    setReminders(overdueReminders);
    setLoading(false);
  }

  async function fetchWallet() {
    if (!activeOrg) return;
    const [profileRes, txRes] = await Promise.all([
      supabase
        .from('seller_profiles')
        .select('wallet_balance, pending_settlement')
        .eq('org_id', activeOrg.id)
        .single(),
      supabase
        .from('wallet_transactions')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (profileRes.data) {
      setWalletBalance(profileRes.data.wallet_balance ?? 0);
      setPendingSettlement(profileRes.data.pending_settlement ?? 0);
    }
    if (txRes.data) setWalletTxs(txRes.data as WalletTx[]);
  }

  useEffect(() => {
    fetchInvoices();
    fetchWallet();
  }, [activeOrg]);

  const filteredInv = invoices
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) =>
      filter === '' ||
      i.buyer_name.toLowerCase().includes(filter.toLowerCase()) ||
      i.number.includes(filter)
    );
  const paginatedInv = filteredInv.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalPending = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const totalPaid    = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  async function markPaid(inv: Invoice) {
    const remaining = inv.amount - inv.amount_paid;
    const [payErr, invErr] = await Promise.all([
      supabase.from('payments').insert({
        invoice_id: inv.id, amount: remaining,
        paid_at: new Date().toISOString().split('T')[0],
        payment_method: 'manual', status: 'posted',
      }).then((r) => r.error),
      supabase.from('invoices').update({ status: 'paid', amount_paid: inv.amount }).eq('id', inv.id).then((r) => r.error),
    ]);
    if (payErr || invErr) {
      flash('error', payErr?.message ?? invErr?.message ?? 'Erreur');
    } else {
      setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: 'paid' } : i));
      flash('success', `Facture ${inv.number} marquée payée.`);
    }
  }

  async function sendReminder(id: string) {
    const rem = reminders.find((r) => r.id === id);
    if (!rem) return;
    const today = new Date().toISOString().split('T')[0];
    // Record the reminder in DB (invoice reminder_sent_at field)
    const invId = id.replace('rem-', '');
    await supabase.from('invoices').update({ reminder_sent_at: today }).eq('id', invId);
    setReminders((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: 'sent', last_sent: today } : r)
    );
    flash('success', `Relance envoyée à ${rem.buyer}.`);
  }

  async function submitVirement() {
    if (!activeOrg) return;
    const amount = parseFloat(virementAmount);
    setVirementLoading(true);
    const { error } = await supabase.from('virement_requests').insert({
      org_id: activeOrg.id,
      amount,
      currency: 'EUR',
      status: 'pending',
      requested_at: new Date().toISOString(),
    });
    setVirementLoading(false);
    setShowVirementModal(false);
    if (error) {
      flash('error', `Erreur : ${error.message}`);
    } else {
      flash('success', `Demande de virement de ${fmtEUR(amount)} soumise. Traitement sous 2 jours ouvrables.`);
      setVirementAmount('');
    }
  }

  async function downloadReleve() {
    if (!activeOrg) return;
    try {
      // Use the first buyer_org_id found for a global statement, or generate per-buyer
      await generateReleveComptePDF(activeOrg.id, '');
    } catch (e) {
      flash('error', `Relevé : ${e instanceof Error ? e.message : 'Erreur'}`);
    }
  }

  return (
    <SpaceBetween size="l">

      {flashItems.length > 0 && (
        <Flashbar
          items={flashItems.map((f, i) => ({
            ...f, id: String(i), dismissible: true,
            onDismiss: () => setFlashItems([]),
          }))}
        />
      )}

      {/* ── ALERTE EN RETARD ────────────────────────────────────────── */}
      {totalOverdue > 0 && (
        <Alert
          type="error"
          header={`${invoices.filter((i) => i.status === 'overdue').length} facture(s) en retard — ${fmtEUR(totalOverdue)}`}
        >
          Des paiements dépassent leur échéance. Déclenchez une relance ou passez en contentieux.
        </Alert>
      )}

      {/* ── WALLET ──────────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Wallet vendeur</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <Box>
            <Box variant="awsui-key-label">Solde disponible</Box>
            <Box variant="h1" color="text-status-success">{fmtEUR(walletBalance)}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">En attente de settlement</Box>
            <Box variant="h1" color="text-status-warning">{fmtEUR(pendingSettlement)}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">Factures en attente</Box>
            <Box variant="h1">{fmtEUR(totalPending)}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">CA payé (total)</Box>
            <Box variant="h1" color="text-status-success">{fmtEUR(totalPaid)}</Box>
          </Box>
        </ColumnLayout>
        <Box margin={{ top: 'm' }}>
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={() => setShowVirementModal(true)}>
              Demander un virement
            </Button>
            <Button onClick={downloadReleve}>Télécharger relevé</Button>
          </SpaceBetween>
        </Box>
      </Container>

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <Tabs
        tabs={[
          {
            id: 'invoices',
            label: `Facturation (${invoices.length})`,
            content: (
              <SpaceBetween size="m">
                <Table
                  header={
                    <Header
                      variant="h3"
                      counter={`(${filteredInv.length})`}
                      actions={
                        <Select
                          selectedOption={
                            statusFilter === 'all'
                              ? { label: 'Tous les statuts', value: 'all' }
                              : { label: INV_STATUS[statusFilter as InvStatus].label, value: statusFilter }
                          }
                          options={[
                            { label: 'Tous les statuts', value: 'all' },
                            { label: `En attente (${invoices.filter((i) => i.status === 'pending').length})`, value: 'pending' },
                            { label: `En retard (${invoices.filter((i) => i.status === 'overdue').length})`, value: 'overdue' },
                            { label: `Payées (${invoices.filter((i) => i.status === 'paid').length})`, value: 'paid' },
                          ]}
                          onChange={({ detail }) => {
                            setStatusFilter((detail.selectedOption.value ?? 'all') as InvStatus | 'all');
                            setCurrentPage(1);
                          }}
                        />
                      }
                    >
                      Factures
                    </Header>
                  }
                  filter={
                    <TextFilter
                      filteringText={filter}
                      filteringPlaceholder="Acheteur ou n° facture…"
                      onChange={({ detail }) => { setFilter(detail.filteringText); setCurrentPage(1); }}
                    />
                  }
                  pagination={
                    <Pagination
                      currentPageIndex={currentPage}
                      pagesCount={Math.max(1, Math.ceil(filteredInv.length / pageSize))}
                      onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
                    />
                  }
                  columnDefinitions={[
                    { id: 'number', header: 'N° Facture', cell: (i) => <Box fontWeight="bold">{i.number}</Box> },
                    {
                      id: 'buyer',
                      header: 'Acheteur',
                      cell: (i) => (
                        <SpaceBetween size="xxs">
                          <Box>{i.buyer_name}</Box>
                          <Box variant="small" color="text-body-secondary">ICE {i.buyer_ice}</Box>
                        </SpaceBetween>
                      ),
                    },
                    { id: 'amount', header: 'Montant', cell: (i) => <Box fontWeight="bold">{fmtEUR(i.amount)}</Box> },
                    { id: 'issued', header: 'Émise le', cell: (i) => new Date(i.issued).toLocaleDateString('fr-FR') },
                    {
                      id: 'due',
                      header: 'Échéance',
                      cell: (i) => (
                        <Box color={i.status === 'overdue' ? 'text-status-error' : 'inherit'}>
                          {i.due ? new Date(i.due).toLocaleDateString('fr-FR') : '—'}
                        </Box>
                      ),
                    },
                    {
                      id: 'status',
                      header: 'Statut',
                      cell: (i) => (
                        <StatusIndicator type={INV_STATUS[i.status].type}>
                          {INV_STATUS[i.status].label}
                        </StatusIndicator>
                      ),
                    },
                    {
                      id: 'actions',
                      header: 'Actions',
                      cell: (i) => (
                        <SpaceBetween direction="horizontal" size="xs">
                          <Button
                            iconName="download"
                            variant="icon"
                            ariaLabel="Facture PDF"
                            onClick={async () => {
                              try { await generateInvoicePDF(i.id); }
                              catch (e) { flash('error', `Facture PDF : ${e instanceof Error ? e.message : 'Erreur'}`); }
                            }}
                          />
                          <Button
                            iconName="undo"
                            variant="icon"
                            ariaLabel="Générer avoir"
                            onClick={async () => {
                              try { await generateAvoirPDF(i.id); }
                              catch (e) { flash('error', `Avoir PDF : ${e instanceof Error ? e.message : 'Erreur'}`); }
                            }}
                          />
                          <Button
                            iconName="file"
                            variant="icon"
                            ariaLabel="Relevé de compte"
                            onClick={async () => {
                              if (!activeOrg) return;
                              try { await generateReleveComptePDF(activeOrg.id, i.buyer_org_id); }
                              catch (e) { flash('error', `Relevé : ${e instanceof Error ? e.message : 'Erreur'}`); }
                            }}
                          />
                          {i.status !== 'paid' && (
                            <Button variant="normal" onClick={() => markPaid(i)}>
                              Marquer payée
                            </Button>
                          )}
                        </SpaceBetween>
                      ),
                    },
                  ]}
                  items={paginatedInv}
                  loading={loading}
                  loadingText="Chargement des factures…"
                />
              </SpaceBetween>
            ),
          },
          {
            id: 'reminders',
            label: `Relances (${reminders.filter((r) => r.status !== 'sent').length} actives)`,
            content: (
              <Table
                header={<Header variant="h3">Relances paiement</Header>}
                columnDefinitions={[
                  { id: 'buyer',   header: 'Acheteur', cell: (r) => r.buyer },
                  { id: 'invoice', header: 'Facture',  cell: (r) => r.invoice_number },
                  { id: 'amount',  header: 'Montant',  cell: (r) => <Box fontWeight="bold">{fmtEUR(r.amount)}</Box> },
                  { id: 'due',     header: 'Échéance', cell: (r) => new Date(r.due).toLocaleDateString('fr-FR') },
                  {
                    id: 'late',
                    header: 'Retard',
                    cell: (r) =>
                      r.days_late > 0
                        ? <Box color="text-status-error">{r.days_late}j</Box>
                        : <Box color="text-body-secondary">—</Box>,
                  },
                  {
                    id: 'status',
                    header: 'Statut',
                    cell: (r) => <Badge color={REM_STATUS[r.status].color}>{REM_STATUS[r.status].label}</Badge>,
                  },
                  {
                    id: 'last',
                    header: 'Dernière relance',
                    cell: (r) => r.last_sent ? new Date(r.last_sent).toLocaleDateString('fr-FR') : '—',
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (r) => (
                      <SpaceBetween direction="horizontal" size="xs">
                        {r.status === 'to_send' && (
                          <Button variant="primary" onClick={() => sendReminder(r.id)}>Envoyer relance</Button>
                        )}
                        {r.status === 'sent' && (
                          <Button onClick={() => sendReminder(r.id)}>Ré-envoyer</Button>
                        )}
                        <Button variant="link">Appel tél.</Button>
                        {r.days_late > 30 && r.status !== 'litigation' && (
                          <Button variant="link">Mise en demeure</Button>
                        )}
                      </SpaceBetween>
                    ),
                  },
                ]}
                items={reminders}
              />
            ),
          },
          {
            id: 'wallet_history',
            label: 'Historique wallet',
            content: (
              <Table
                header={<Header variant="h3">Journal des mouvements</Header>}
                columnDefinitions={[
                  { id: 'date', header: 'Date', cell: (t) => new Date(t.date).toLocaleDateString('fr-FR') },
                  {
                    id: 'label',
                    header: 'Opération',
                    cell: (t) => (
                      <SpaceBetween size="xxs">
                        <Box>{t.label}</Box>
                        <Box variant="small" color="text-body-secondary">Réf : {t.ref}</Box>
                      </SpaceBetween>
                    ),
                  },
                  {
                    id: 'amount',
                    header: 'Montant',
                    cell: (t) => (
                      <Box
                        fontWeight="bold"
                        color={t.type === 'credit' ? 'text-status-success' : 'text-status-error'}
                      >
                        {t.type === 'credit' ? '+' : '-'}{fmtEUR(t.amount)}
                      </Box>
                    ),
                  },
                  { id: 'balance', header: 'Solde', cell: (t) => fmtEUR(t.balance) },
                ]}
                items={walletTxs}
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>Aucun mouvement</b>
                    <Box variant="p" color="inherit">L'historique wallet apparaîtra ici.</Box>
                  </Box>
                }
              />
            ),
          },
        ]}
      />

      {/* ── MODAL VIREMENT ──────────────────────────────────────────── */}
      {showVirementModal && (
        <Modal
          visible
          header="Demande de virement"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowVirementModal(false)}>Annuler</Button>
                <Button
                  variant="primary"
                  loading={virementLoading}
                  disabled={
                    !virementAmount ||
                    parseFloat(virementAmount) < 500 ||
                    parseFloat(virementAmount) > walletBalance
                  }
                  onClick={submitVirement}
                >
                  Soumettre la demande
                </Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setShowVirementModal(false)}
        >
          <SpaceBetween size="m">
            <Alert type="info">
              Le virement sera traité dans les 2 jours ouvrables vers votre RIB enregistré dans les paramètres.
            </Alert>
            <ColumnLayout columns={2}>
              <FormField label="Solde disponible">
                <Box fontWeight="bold" color="text-status-success">{fmtEUR(walletBalance)}</Box>
              </FormField>
              <FormField label="Montant minimum"><Box>500 €</Box></FormField>
            </ColumnLayout>
            <FormField
              label="Montant à virer (EUR)"
              errorText={
                virementAmount &&
                (parseFloat(virementAmount) < 500 || parseFloat(virementAmount) > walletBalance)
                  ? `Montant entre 500 € et ${fmtEUR(walletBalance)}`
                  : undefined
              }
            >
              <Input
                type="number"
                value={virementAmount}
                onChange={({ detail }) => setVirementAmount(detail.value)}
                placeholder="Ex: 5000"
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
