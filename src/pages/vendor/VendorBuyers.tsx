import { useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Badge, Box,
  ColumnLayout, Modal, TextFilter, Pagination,
  StatusIndicator, ProgressBar, Container,
} from '@cloudscape-design/components';

// ── Types ─────────────────────────────────────────────────────────────────────
type BuyerStatus = 'active' | 'inactive' | 'key_account';
interface Buyer {
  id: string; company: string; ice: string;
  contact: string; phone: string; email: string;
  region: string; city: string;
  orders: number; ca_total: number; last_order: string;
  payment_pref: string; score: number;
  status: BuyerStatus;
}
interface QuoteDl {
  id: string; buyer: string; ice: string; product: string;
  amount: number; date: string; auto_reminder: boolean;
}
interface CouponUsed {
  id: string; code: string; buyer: string; saving: number; order_ref: string; date: string;
}

// ── Mock ──────────────────────────────────────────────────────────────────────
const BUYERS: Buyer[] = [
  { id: 'b1', company: 'Marché Atlas SARL',        ice: '002345678901234', contact: 'Khalid Senhaji',   phone: '+212 522 001 122', email: 'k.senhaji@atlas.ma',    region: 'Grand Casablanca',    city: 'Casablanca', orders: 34, ca_total: 128400, last_order: '2024-12-08', payment_pref: 'Virement', score: 92, status: 'key_account' },
  { id: 'b2', company: 'NordFood SARL',             ice: '004567890123456', contact: 'Fatima Tazi',      phone: '+212 539 002 234', email: 'f.tazi@nordfood.ma',    region: 'Tanger-Tétouan',      city: 'Tanger',     orders: 22, ca_total: 87200,  last_order: '2024-12-06', payment_pref: 'Virement', score: 88, status: 'key_account' },
  { id: 'b3', company: 'Épicerie Centrale Fassi',   ice: '003456789012345', contact: 'Abderrahim Fassi', phone: '+212 535 003 345', email: 'contact@epiceriefassi.ma', region: 'Fès-Meknès',        city: 'Fès',        orders: 18, ca_total: 52100,  last_order: '2024-12-03', payment_pref: 'COD',      score: 74, status: 'active' },
  { id: 'b4', company: 'Superette El Houda',        ice: '005678901234567', contact: 'Amina Zaoui',      phone: '+212 537 004 456', email: 'a.zaoui@elhouda.ma',    region: 'Rabat-Salé',          city: 'Rabat',      orders: 15, ca_total: 38800,  last_order: '2024-11-28', payment_pref: 'COD',      score: 65, status: 'active' },
  { id: 'b5', company: 'Discount Marché Agdal',     ice: '006789012345678', contact: 'Youssef Benali',   phone: '+212 537 005 567', email: 'y.benali@agdal-marche.ma', region: 'Rabat-Salé',       city: 'Rabat',      orders: 8,  ca_total: 21300,  last_order: '2024-11-15', payment_pref: 'Virement', score: 55, status: 'active' },
  { id: 'b6', company: 'Frais Direct Casablanca',   ice: '007890123456789', contact: 'Hind Bouazza',     phone: '+212 522 006 678', email: 'h.bouazza@fraisdirect.ma', region: 'Grand Casablanca', city: 'Casablanca', orders: 5,  ca_total: 14200,  last_order: '2024-10-20', payment_pref: 'Virement', score: 42, status: 'inactive' },
  { id: 'b7', company: 'Coopérative Agadir Bio',    ice: '008901234567890', contact: 'Said Rami',        phone: '+212 528 007 789', email: 's.rami@agadirbio.ma',   region: 'Souss-Massa',         city: 'Agadir',     orders: 12, ca_total: 41600,  last_order: '2024-12-01', payment_pref: 'Virement', score: 80, status: 'active' },
];

const QUOTES_DOWNLOADED: QuoteDl[] = [
  { id: 'q1', buyer: 'Épicerie Centrale Fassi', ice: '003456789012345', product: 'Yaourt nature 500g x 144', amount: 7488, date: '2024-12-07', auto_reminder: true },
  { id: 'q2', buyer: 'Superette El Houda',      ice: '005678901234567', product: 'Confiture fraises 450g x 48', amount: 3408, date: '2024-12-05', auto_reminder: false },
  { id: 'q3', buyer: 'Frais Direct Casablanca', ice: '007890123456789', product: 'Assortiment laitiers x 96', amount: 9600, date: '2024-12-03', auto_reminder: true },
];

const COUPONS_USED: CouponUsed[] = [
  { id: 'cp1', code: 'WELCOME10',  buyer: 'Coopérative Agadir Bio',  saving: 416,  order_ref: 'CMD-2024-0390', date: '2024-12-01' },
  { id: 'cp2', code: 'DEC15',      buyer: 'NordFood SARL',           saving: 1308, order_ref: 'CMD-2024-0418', date: '2024-12-06' },
  { id: 'cp3', code: 'FIDELITE5',  buyer: 'Marché Atlas SARL',       saving: 642,  order_ref: 'CMD-2024-0421', date: '2024-12-08' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(score: number): 'green' | 'blue' | 'severity-medium' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'severity-medium';
  return 'red';
}
const STATUS_INFO: Record<BuyerStatus, { label: string; type: 'success' | 'in-progress' | 'stopped' }> = {
  active:      { label: 'Actif',       type: 'success' },
  inactive:    { label: 'Inactif',     type: 'stopped' },
  key_account: { label: 'Key Account', type: 'in-progress' },
};
function fmt(n: number) { return `${n.toLocaleString('fr-MA')} MAD`; }

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VendorBuyers() {
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const pageSize = 8;

  const filtered = BUYERS.filter((b) =>
    filter === '' ||
    b.company.toLowerCase().includes(filter.toLowerCase()) ||
    b.ice.includes(filter) ||
    b.city.toLowerCase().includes(filter.toLowerCase())
  );
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCA = BUYERS.reduce((s, b) => s + b.ca_total, 0);
  const avgScore = Math.round(BUYERS.reduce((s, b) => s + b.score, 0) / BUYERS.length);
  const keyAccounts = BUYERS.filter((b) => b.status === 'key_account');

  return (
    <SpaceBetween size="l">

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <ColumnLayout columns={4} variant="text-grid">
        <Box>
          <Box variant="awsui-key-label">Acheteurs totaux</Box>
          <Box variant="h1">{BUYERS.length}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">CA total portefeuille</Box>
          <Box variant="h1">{fmt(totalCA)}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Score moyen acheteurs</Box>
          <Box variant="h1">{avgScore}/100</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Key Accounts</Box>
          <Box variant="h1" color="text-status-info">{keyAccounts.length}</Box>
        </Box>
      </ColumnLayout>

      {/* ── KEY ACCOUNTS ──────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Key Accounts</Header>}>
        <SpaceBetween direction="horizontal" size="m">
          {keyAccounts.map((b) => (
            <Box key={b.id} padding="m" border="divider" borderRadius="normal"
              backgroundColor="background-container-content">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">{b.company}</Box>
                <Badge color="blue">Key Account</Badge>
                <Box color="text-body-secondary">{b.orders} commandes</Box>
                <Box fontWeight="bold" color="text-status-success">{fmt(b.ca_total)}</Box>
              </SpaceBetween>
            </Box>
          ))}
        </SpaceBetween>
      </Container>

      {/* ── TABLE ACHETEURS ───────────────────────────────────────── */}
      <Table
        header={
          <Header variant="h2" counter={`(${filtered.length})`}
            actions={<Button iconName="download">Exporter CSV</Button>}
          >
            Liste acheteurs
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            filteringPlaceholder="Entreprise, ICE, ville…"
            onChange={({ detail }) => { setFilter(detail.filteringText); setCurrentPage(1); }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={[
          { id: 'company', header: 'Entreprise', cell: (b) => (
            <SpaceBetween size="xxs">
              <Button variant="link" onClick={() => setSelectedBuyer(b)}>{b.company}</Button>
              {b.status === 'key_account' && <Badge color="blue">Key Account</Badge>}
            </SpaceBetween>
          ), width: 220 },
          { id: 'ice', header: 'ICE', cell: (b) => <Box variant="small">{b.ice}</Box> },
          { id: 'region', header: 'Région', cell: (b) => b.city },
          { id: 'orders', header: 'Commandes', cell: (b) => b.orders },
          { id: 'ca', header: 'CA total', cell: (b) => <Box fontWeight="bold">{fmt(b.ca_total)}</Box> },
          { id: 'last', header: 'Dernier achat', cell: (b) => new Date(b.last_order).toLocaleDateString('fr-MA') },
          { id: 'payment', header: 'Paiement', cell: (b) => b.payment_pref },
          { id: 'score', header: 'Score', cell: (b) => (
            <SpaceBetween size="xxs">
              <ProgressBar value={b.score} resultText={`${b.score}/100`} status={b.score >= 70 ? 'success' : b.score >= 40 ? 'in-progress' : 'error'} />
            </SpaceBetween>
          ), width: 160 },
          { id: 'status', header: 'Statut', cell: (b) => (
            <StatusIndicator type={STATUS_INFO[b.status].type}>{STATUS_INFO[b.status].label}</StatusIndicator>
          )},
          { id: 'actions', header: '', cell: (b) => (
            <Button variant="link" onClick={() => setSelectedBuyer(b)}>Voir</Button>
          )},
        ]}
        items={paginated}
      />

      {/* ── DEVIS TÉLÉCHARGÉS ─────────────────────────────────────── */}
      <Table
        header={<Header variant="h2" description="Relance automatique J+3">Devis téléchargés sans commande</Header>}
        columnDefinitions={[
          { id: 'buyer', header: 'Acheteur', cell: (q) => q.buyer },
          { id: 'ice', header: 'ICE', cell: (q) => <Box variant="small">{q.ice}</Box> },
          { id: 'product', header: 'Produit / Devis', cell: (q) => q.product },
          { id: 'amount', header: 'Montant', cell: (q) => <Box fontWeight="bold">{fmt(q.amount)}</Box> },
          { id: 'date', header: 'Date', cell: (q) => new Date(q.date).toLocaleDateString('fr-MA') },
          { id: 'reminder', header: 'Relance auto', cell: (q) => (
            q.auto_reminder
              ? <StatusIndicator type="success">Activée</StatusIndicator>
              : <StatusIndicator type="stopped">Désactivée</StatusIndicator>
          )},
          { id: 'actions', header: '', cell: () => <Button variant="link">Relancer</Button> },
        ]}
        items={QUOTES_DOWNLOADED}
      />

      {/* ── COUPONS UTILISÉS ──────────────────────────────────────── */}
      <Table
        header={<Header variant="h2">Coupons utilisés</Header>}
        columnDefinitions={[
          { id: 'code', header: 'Code promo', cell: (c) => <Badge color="blue">{c.code}</Badge> },
          { id: 'buyer', header: 'Acheteur', cell: (c) => c.buyer },
          { id: 'saving', header: 'Remise accordée', cell: (c) => <Box color="text-status-warning">-{fmt(c.saving)}</Box> },
          { id: 'order', header: 'Commande', cell: (c) => c.order_ref },
          { id: 'date', header: 'Date', cell: (c) => new Date(c.date).toLocaleDateString('fr-MA') },
        ]}
        items={COUPONS_USED}
      />

      {/* ── MODAL DETAIL ACHETEUR ─────────────────────────────────── */}
      {selectedBuyer && (
        <Modal
          visible
          size="large"
          header={selectedBuyer.company}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setSelectedBuyer(null)}>Fermer</Button>
                <Button>Voir les commandes</Button>
                <Button variant="primary">Générer devis PDF</Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setSelectedBuyer(null)}
        >
          <SpaceBetween size="m">
            <ColumnLayout columns={3}>
              <Box><Box variant="awsui-key-label">ICE</Box><Box>{selectedBuyer.ice}</Box></Box>
              <Box><Box variant="awsui-key-label">Contact</Box><Box>{selectedBuyer.contact}</Box></Box>
              <Box><Box variant="awsui-key-label">Téléphone</Box><Box>{selectedBuyer.phone}</Box></Box>
              <Box><Box variant="awsui-key-label">Email</Box><Box>{selectedBuyer.email}</Box></Box>
              <Box><Box variant="awsui-key-label">Région</Box><Box>{selectedBuyer.region}</Box></Box>
              <Box><Box variant="awsui-key-label">Paiement préféré</Box><Box>{selectedBuyer.payment_pref}</Box></Box>
            </ColumnLayout>
            <ColumnLayout columns={3} variant="text-grid">
              <Box>
                <Box variant="awsui-key-label">Commandes</Box>
                <Box variant="h2">{selectedBuyer.orders}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">CA total</Box>
                <Box variant="h2" color="text-status-success">{fmt(selectedBuyer.ca_total)}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Score acheteur</Box>
                <Box variant="h2">
                  <Badge color={scoreColor(selectedBuyer.score)}>{selectedBuyer.score}/100</Badge>
                </Box>
              </Box>
            </ColumnLayout>
            <Box>
              <Box variant="awsui-key-label">Score acheteur</Box>
              <ProgressBar
                value={selectedBuyer.score}
                resultText={`${selectedBuyer.score}/100`}
                status={selectedBuyer.score >= 70 ? 'success' : selectedBuyer.score >= 40 ? 'in-progress' : 'error'}
                description="Basé sur la ponctualité des paiements, le volume et la fidélité"
              />
            </Box>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
