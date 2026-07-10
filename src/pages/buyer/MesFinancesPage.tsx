import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { generateInvoicePDF } from '../../lib/pdf/pdfUtils';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, Badge,
  SimpleGrid, Tabs, TabList, TabPanels, Tab, TabPanel, Divider, Spinner,
} from '@chakra-ui/react';
import {
  ArrowLeft, FileText, Download, TrendingUp, TrendingDown,
  CheckCircle, Clock, AlertTriangle, CreditCard, Building2,
} from 'lucide-react';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558', amber: '#c97d1a',
  amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b', border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#15803d', greenLight: '#dcfce7', greenBorder: '#86efac',
  red: '#be1c1c', redLight: '#fff1f1', redBorder: '#fca5a5',
  orange: '#c2410c', orangeLight: '#fff7ed', orangeBorder: '#fdba74',
};

// ── Types ─────────────────────────────────────────────────────────────────────
type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'dispute';
interface Invoice {
  id: string; number: string; date: string; dueDate: string;
  vendor: string; amount: number; status: InvoiceStatus;
}

type TxType = 'credit' | 'debit';
interface Transaction {
  id: string; date: string; label: string; ref: string;
  type: TxType; amount: number; balance: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<InvoiceStatus, { label: string; bg: string; color: string; border: string; icon: React.ReactNode }> = {
  paid:    { label: 'Payée',      bg: C.greenLight,  color: C.green,  border: C.greenBorder,  icon: <CheckCircle  size={12} /> },
  pending: { label: 'En attente', bg: C.amberLight,  color: C.amber,  border: C.amberBorder,  icon: <Clock        size={12} /> },
  overdue: { label: 'En retard',  bg: C.redLight,    color: C.red,    border: C.redBorder,    icon: <AlertTriangle size={12} /> },
  dispute: { label: 'Litige',     bg: C.orangeLight, color: C.orange, border: C.orangeBorder, icon: <AlertTriangle size={12} /> },
};

function fmt(n: number) {
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Factures tab ──────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onDownload }: { inv: Invoice; onDownload: () => void }) {
  const s = STATUS_MAP[inv.status];
  return (
    <Box bg="white" rounded="xl" px={5} py={4}
      style={{ border: `1px solid ${C.border}` }}
      _hover={{ borderColor: C.amberBorder, shadow: 'sm' }} transition="all 0.15s">
      <Flex align="center" gap={4} flexWrap="wrap">
        <Box w={9} h={9} rounded="xl" display="flex" alignItems="center" justifyContent="center"
          style={{ background: C.bgAlt, border: `1px solid ${C.border}` }} flexShrink={0}>
          <FileText size={16} color={C.slate} />
        </Box>

        <Box flex="1" minW="180px">
          <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }}>{inv.number}</Text>
          <Text fontSize="xs" style={{ color: C.muted }}>{inv.vendor}</Text>
        </Box>

        <Box minW="120px" display={{ base: 'none', md: 'block' }}>
          <Text fontSize="xs" style={{ color: C.muted }}>Émise le</Text>
          <Text fontSize="sm" fontWeight="600" style={{ color: C.slate }}>
            {new Date(inv.date).toLocaleDateString('fr-MA')}
          </Text>
        </Box>
        <Box minW="120px" display={{ base: 'none', md: 'block' }}>
          <Text fontSize="xs" style={{ color: C.muted }}>Échéance</Text>
          <Text fontSize="sm" fontWeight="600" style={{ color: inv.status === 'overdue' ? C.red : C.slate }}>
            {new Date(inv.dueDate).toLocaleDateString('fr-MA')}
          </Text>
        </Box>

        <Box minW="110px" textAlign="right">
          <Text fontWeight="900" fontSize="md" style={{ color: C.navy }}>{fmt(inv.amount)}</Text>
          <Text fontSize="10px" style={{ color: C.muted }}>MAD</Text>
        </Box>

        <Box minW="100px">
          <Flex align="center" gap={1.5} px={2.5} py={1} rounded="full" w="fit-content"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <Box style={{ color: s.color }}>{s.icon}</Box>
            <Text fontSize="11px" fontWeight="700" style={{ color: s.color }}>{s.label}</Text>
          </Flex>
        </Box>

        <Button size="xs" variant="ghost" leftIcon={<Download size={11} />}
          style={{ color: C.slate }} fontWeight="600"
          _hover={{ bg: C.bgAlt }}
          onClick={onDownload}>
          PDF
        </Button>
      </Flex>
    </Box>
  );
}

// ── Relevé tab ────────────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === 'credit';
  return (
    <Box bg="white" px={5} py={3.5}
      style={{ borderBottom: `1px solid ${C.border}` }}
      _hover={{ bg: C.bgAlt }} transition="bg 0.1s">
      <Flex align="center" gap={4} flexWrap="wrap">
        <Box w={8} h={8} rounded="full" display="flex" alignItems="center" justifyContent="center" flexShrink={0}
          style={{ background: isCredit ? C.greenLight : C.redLight, border: `1px solid ${isCredit ? C.greenBorder : C.redBorder}` }}>
          {isCredit ? <TrendingUp size={13} color={C.green} /> : <TrendingDown size={13} color={C.red} />}
        </Box>

        <Box flex="1" minW="200px">
          <Text fontWeight="600" fontSize="sm" style={{ color: C.navy }}>{tx.label}</Text>
          <Text fontSize="11px" style={{ color: C.muted }}>Réf : {tx.ref}</Text>
        </Box>

        <Text fontSize="xs" style={{ color: C.muted }} display={{ base: 'none', md: 'block' }} minW="100px">
          {new Date(tx.date).toLocaleDateString('fr-MA')}
        </Text>

        <Text fontWeight="800" fontSize="sm" minW="110px" textAlign="right"
          style={{ color: isCredit ? C.green : C.red }}>
          {isCredit ? '+' : '-'}{fmt(tx.amount)} MAD
        </Text>

        <Text fontSize="xs" style={{ color: C.muted }} minW="120px" textAlign="right"
          display={{ base: 'none', lg: 'block' }}>
          Solde : {fmt(tx.balance)} MAD
        </Text>
      </Flex>
    </Box>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MesFinancesPage() {
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [loading, setLoading]         = useState(true);
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all'>('all');

  useEffect(() => {
    if (!activeOrg) return;

    async function load() {
      setLoading(true);

      const { data } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, issued_at, due_at, status,
          amount_ttc, amount_paid,
          orders!inner(
            order_number,
            seller:organisations!orders_seller_org_id_fkey(name)
          )
        `)
        .order('issued_at', { ascending: false })
        .limit(100);

      type RawInvoice = {
        id: string;
        invoice_number: string;
        issued_at: string;
        due_at: string | null;
        status: string;
        amount_ttc: number | null;
        amount_paid: number | null;
        orders: { order_number: string | null; seller: { name: string } | null } | null;
      };
      const rows = (data ?? []) as RawInvoice[];
      const now = new Date();

      const mapped: Invoice[] = rows.map((inv) => {
        let status: InvoiceStatus;
        if (inv.status === 'paid')                              status = 'paid';
        else if (inv.status === 'dispute')                      status = 'dispute';
        else if (inv.due_at && new Date(inv.due_at) < now)     status = 'overdue';
        else                                                    status = 'pending';

        return {
          id: inv.id,
          number: inv.invoice_number,
          date: inv.issued_at,
          dueDate: inv.due_at ?? inv.issued_at,
          vendor: inv.orders?.seller?.name ?? 'Vendeur',
          amount: Number(inv.amount_ttc ?? 0),
          status,
        };
      });
      setInvoices(mapped);

      // Relevé : une ligne par facture (débit) + paiements reçus
      const txs: Transaction[] = [];
      let runningBalance = 0;
      [...rows].reverse().forEach((inv) => {
        const ttc = Number(inv.amount_ttc ?? 0);
        const paid = Number(inv.amount_paid ?? 0);
        runningBalance += ttc;
        txs.unshift({
          id: `inv-${inv.id}`,
          date: inv.issued_at,
          label: `Facture ${inv.invoice_number} — ${inv.orders?.seller?.name ?? 'Vendeur'}`,
          ref: inv.invoice_number,
          type: 'debit',
          amount: ttc,
          balance: runningBalance,
        });
        if (paid > 0) {
          runningBalance -= paid;
          txs.unshift({
            id: `pay-${inv.id}`,
            date: inv.issued_at,
            label: `Paiement — ${inv.invoice_number}`,
            ref: `PAIE-${inv.invoice_number}`,
            type: 'credit',
            amount: paid,
            balance: runningBalance,
          });
        }
      });
      setTransactions(txs);
      setLoading(false);
    }

    load();
  }, [activeOrg]);

  const totalPaid    = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const currentBalance = transactions[0]?.balance ?? 0;
  const filtered = filterStatus === 'all' ? invoices : invoices.filter((i) => i.status === filterStatus);

  const statusFilters: { key: InvoiceStatus | 'all'; label: string; count: number }[] = [
    { key: 'all',     label: 'Toutes',     count: invoices.length },
    { key: 'paid',    label: 'Payées',     count: invoices.filter((i) => i.status === 'paid').length },
    { key: 'pending', label: 'En attente', count: invoices.filter((i) => i.status === 'pending').length },
    { key: 'overdue', label: 'En retard',  count: invoices.filter((i) => i.status === 'overdue').length },
    { key: 'dispute', label: 'Litiges',    count: invoices.filter((i) => i.status === 'dispute').length },
  ];

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="300px">
        <Spinner size="lg" color={C.navy} />
      </Flex>
    );
  }

  return (
    <VStack spacing={6} align="stretch">

      {/* ── EN-TÊTE ──────────────────────────────────────────────────── */}
      <Box>
        <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
          style={{ color: C.muted }} mb={1} onClick={() => navigate('/buyer')}>
          Tableau de bord
        </Button>
        <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>Mes finances</Heading>
        <Text fontSize="sm" style={{ color: C.muted }}>Factures, paiements et relevé de compte</Text>
      </Box>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        {[
          { label: 'Solde actuel', value: fmt(currentBalance), unit: 'MAD', icon: <CreditCard size={18} />, bg: C.navy, textColor: 'white', subColor: 'rgba(255,255,255,0.6)' },
          { label: 'Payées (30j)', value: fmt(totalPaid),    unit: 'MAD', icon: <CheckCircle size={18} />,   bg: C.greenLight, textColor: C.navy, subColor: C.muted, iconColor: C.green },
          { label: 'En attente',   value: fmt(totalPending), unit: 'MAD', icon: <Clock size={18} />,         bg: C.amberLight, textColor: C.navy, subColor: C.muted, iconColor: C.amber },
          { label: 'En retard',    value: fmt(totalOverdue), unit: 'MAD', icon: <AlertTriangle size={18} />, bg: C.redLight,   textColor: C.navy, subColor: C.muted, iconColor: C.red },
        ].map((k) => (
          <Box key={k.label} rounded="2xl" px={5} py={4}
            style={{ background: k.bg, border: `1px solid ${k.bg === C.navy ? 'transparent' : C.border}` }}>
            <Flex justify="space-between" align="flex-start" mb={3}>
              <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.5px"
                style={{ color: k.subColor ?? C.muted }}>{k.label}</Text>
              <Box style={{ color: k.iconColor ?? (k.bg === C.navy ? 'white' : C.slate) }}>{k.icon}</Box>
            </Flex>
            <Text fontWeight="900" fontSize="xl" lineHeight={1} style={{ color: k.textColor }}>{k.value}</Text>
            <Text fontSize="11px" style={{ color: k.subColor ?? C.muted }} mt={0.5}>{k.unit}</Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* ── TABS ─────────────────────────────────────────────────────── */}
      <Tabs variant="unstyled">
        <TabList gap={1} mb={5}
          style={{ background: C.bgAlt, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '4px' }}
          display="inline-flex" w="auto">
          {['Factures', 'Relevé de compte'].map((t) => (
            <Tab key={t} px={4} py={2} rounded="lg" fontSize="sm" fontWeight="600"
              style={{ color: C.muted }}
              _selected={{ background: 'white', color: C.navy, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {t}
            </Tab>
          ))}
        </TabList>

        <TabPanels>
          {/* ── Factures ──────────────────────────────────────────── */}
          <TabPanel p={0}>
            <Flex gap={2} mb={4} flexWrap="wrap">
              {statusFilters.map((f) => {
                const active = filterStatus === f.key;
                return (
                  <Box key={f.key} as="button" px={3} py={1.5} rounded="full" cursor="pointer"
                    style={{
                      background: active ? C.navy : 'white',
                      border: `1px solid ${active ? C.navy : C.border}`,
                    }}
                    onClick={() => setFilterStatus(f.key)}>
                    <HStack spacing={1.5}>
                      <Text fontSize="xs" fontWeight="700" style={{ color: active ? 'white' : C.slate }}>
                        {f.label}
                      </Text>
                      {f.count > 0 && (
                        <Badge rounded="full" px={1.5} fontSize="10px" fontWeight="700"
                          style={{
                            background: active ? 'rgba(255,255,255,0.2)' : C.bgAlt,
                            color: active ? 'white' : C.muted,
                          }}>
                          {f.count}
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                );
              })}
            </Flex>

            <VStack spacing={2} align="stretch">
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  onDownload={() => generateInvoicePDF(inv.id).catch(() => {})}
                />
              ))}
              {filtered.length === 0 && (
                <Flex direction="column" align="center" py={12} gap={2}
                  bg="white" rounded="2xl" style={{ border: `1px solid ${C.border}` }}>
                  <FileText size={32} color={C.border} />
                  <Text fontWeight="600" style={{ color: C.slate }}>Aucune facture</Text>
                </Flex>
              )}
            </VStack>
          </TabPanel>

          {/* ── Relevé de compte ──────────────────────────────────── */}
          <TabPanel p={0}>
            <Box bg="white" rounded="2xl" overflow="hidden" mb={4}
              style={{ border: `1px solid ${C.border}` }}>
              <Box style={{ background: C.navy }} px={6} py={4}>
                <Flex align="center" justify="space-between" flexWrap="wrap" gap={3}>
                  <HStack spacing={3}>
                    <Box w={10} h={10} rounded="xl" display="flex" alignItems="center" justifyContent="center"
                      style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <Building2 size={18} color="white" />
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="whiteAlpha.700" fontWeight="600">Compte courant</Text>
                      <Text fontSize="sm" color="white" fontWeight="700">{activeOrg?.name ?? 'Mon entreprise'}</Text>
                    </Box>
                  </HStack>
                  <Box textAlign="right">
                    <Text fontSize="xs" color="whiteAlpha.700">Solde disponible</Text>
                    <Text fontSize="2xl" fontWeight="900" color="white">{fmt(currentBalance)} MAD</Text>
                  </Box>
                </Flex>
              </Box>
              <Divider style={{ borderColor: C.border }} />
              <Flex px={6} py={3} gap={6} flexWrap="wrap">
                <Box>
                  <Text fontSize="xs" style={{ color: C.muted }}>Total entrant (30j)</Text>
                  <Text fontWeight="700" style={{ color: C.green }}>
                    +{fmt(transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0))} MAD
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" style={{ color: C.muted }}>Total sortant (30j)</Text>
                  <Text fontWeight="700" style={{ color: C.red }}>
                    -{fmt(transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0))} MAD
                  </Text>
                </Box>
                <Box ml="auto">
                  <Button size="xs" variant="outline" leftIcon={<Download size={11} />}
                    style={{ borderColor: C.border, color: C.slate }} fontWeight="600">
                    Exporter CSV
                  </Button>
                </Box>
              </Flex>
            </Box>

            <Box bg="white" rounded="2xl" overflow="hidden"
              style={{ border: `1px solid ${C.border}` }}>
              <Flex px={5} py={3} style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
                <Text flex="1" fontSize="11px" fontWeight="700" textTransform="uppercase"
                  letterSpacing="0.5px" style={{ color: C.muted }}>Opération</Text>
                <Text fontSize="11px" fontWeight="700" textTransform="uppercase"
                  letterSpacing="0.5px" style={{ color: C.muted }} minW="100px" display={{ base: 'none', md: 'block' }}>Date</Text>
                <Text fontSize="11px" fontWeight="700" textTransform="uppercase"
                  letterSpacing="0.5px" style={{ color: C.muted }} minW="110px" textAlign="right">Montant</Text>
                <Text fontSize="11px" fontWeight="700" textTransform="uppercase"
                  letterSpacing="0.5px" style={{ color: C.muted }} minW="120px" textAlign="right"
                  display={{ base: 'none', lg: 'block' }}>Solde</Text>
              </Flex>
              {transactions.length === 0 ? (
                <Flex direction="column" align="center" py={10} gap={2}>
                  <Text fontWeight="600" style={{ color: C.slate }}>Aucune transaction</Text>
                  <Text fontSize="xs" style={{ color: C.muted }}>Les transactions apparaîtront ici après livraison</Text>
                </Flex>
              ) : (
                transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
              )}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}
