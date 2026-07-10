import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Package, ShoppingCart, TrendingUp,
  AlertTriangle, Truck, Clock, ArrowRight,
  CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

/* ── types ────────────────────────────────────────────────── */
interface Stats {
  orgCount: number;
  buyerCount: number;
  sellerCount: number;
  deliveryCount: number;
  productCount: number;
  orderCount: number;
  pendingDelivery: number;
  openDisputes: number;
  revenue: number;
  deliveredCount: number;
  pendingOrderCount: number;
  unassignedTickets: number;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', in_preparation: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', dispute: 'Litige',
};

/* ── helpers ──────────────────────────────────────────────── */
function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' MAD';
}

/* ── sub-components ───────────────────────────────────────── */
function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex gap-4 items-start shadow-sm">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: color + '18', color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function AlertBanner({
  type, message, action, onAction,
}: {
  type: 'warning' | 'error';
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  const cfg = type === 'error'
    ? { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: <XCircle size={15} /> }
    : { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: <AlertTriangle size={15} /> };

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border text-sm"
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}
    >
      <span className="flex items-center gap-2">
        {cfg.icon}
        {message}
      </span>
      {action && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 font-semibold hover:underline shrink-0"
          style={{ color: cfg.text }}
        >
          {action}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    pending:        { bg: '#fef3c7', color: '#92400e' },
    confirmed:      { bg: '#dbeafe', color: '#1e40af' },
    in_preparation: { bg: '#ede9fe', color: '#4a1d96' },
    shipped:        { bg: '#ffedd5', color: '#7c2d12' },
    delivered:      { bg: '#dcfce7', color: '#14532d' },
    cancelled:      { bg: '#fee2e2', color: '#7f1d1d' },
    dispute:        { bg: '#fee2e2', color: '#7f1d1d' },
    active:         { bg: '#dcfce7', color: '#14532d' },
    suspended:      { bg: '#fee2e2', color: '#7f1d1d' },
    rejected:       { bg: '#f3f4f6', color: '#374151' },
  };
  const c = cfg[status] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function OrgTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    buyer:    { label: 'Acheteur',  bg: '#dbeafe', color: '#1e40af' },
    seller:   { label: 'Vendeur',   bg: '#ede9fe', color: '#4a1d96' },
    delivery: { label: 'Livreur',   bg: '#dcfce7', color: '#14532d' },
  };
  const c = cfg[type] ?? { label: type, bg: '#f3f4f6', color: '#374151' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

/* ── main component ───────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    orgCount: 0, buyerCount: 0, sellerCount: 0, deliveryCount: 0,
    productCount: 0, orderCount: 0, pendingDelivery: 0,
    openDisputes: 0, revenue: 0, deliveredCount: 0,
    pendingOrderCount: 0, unassignedTickets: 0,
  });
  const [recentOrders, setRecentOrders]         = useState<any[]>([]);
  const [pendingOrgs, setPendingOrgs]           = useState<any[]>([]);
  const [recentOrgs, setRecentOrgs]             = useState<any[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [
        allOrgsRes, buyersRes, sellersRes, deliveriesRes,
        prodsRes, ordersRes, pendDelRes, disputesRes, recentOrgsRes,
        unassignedRes,
      ] = await Promise.all([
        supabase.from('organisations').select('id', { count: 'exact', head: true }),
        supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'buyer'),
        supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'seller'),
        supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'delivery'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('orders')
          .select('id, order_number, total_ttc, status, created_at, buyer:organisations!orders_buyer_org_id_fkey(name), seller:organisations!orders_seller_org_id_fkey(name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('organisations').select('id, name, org_type').eq('validation_status', 'pending'),
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('organisations')
          .select('id, name, org_type, validation_status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('delivery_tickets').select('id', { count: 'exact', head: true }).is('assigned_delivery_id', null).eq('status', 'open'),
      ]);

      const orders     = (ordersRes.data  as any[]) ?? [];
      const pendOrgs   = (pendDelRes.data as any[]) ?? [];
      setRecentOrders(orders);
      setPendingOrgs(pendOrgs);
      setRecentOrgs((recentOrgsRes.data as any[]) ?? []);
      setStats({
        orgCount:          allOrgsRes.count ?? 0,
        buyerCount:        buyersRes.count ?? 0,
        sellerCount:       sellersRes.count ?? 0,
        deliveryCount:     deliveriesRes.count ?? 0,
        productCount:      prodsRes.count ?? 0,
        orderCount:        ordersRes.count ?? 0,
        pendingDelivery:   pendOrgs.length,
        openDisputes:      disputesRes.count ?? 0,
        revenue:           orders.filter(o => o.status !== 'cancelled').reduce((s: number, o: any) => s + (Number(o.total_ttc) || 0), 0),
        deliveredCount:    orders.filter((o: any) => o.status === 'delivered').length,
        pendingOrderCount: orders.filter((o: any) => ['pending', 'confirmed', 'in_preparation'].includes(o.status)).length,
        unassignedTickets: unassignedRes.count ?? 0,
      });
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const skeleton = (w = 'w-16') => (
    <span className={`inline-block h-4 ${w} bg-gray-200 rounded animate-pulse`} />
  );

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de la plateforme Stock212</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────── */}
      {error && (
        <AlertBanner type="error" message={error} />
      )}

      {/* ── Alert banners ──────────────────────────────────── */}
      {!loading && (stats.pendingDelivery > 0 || stats.openDisputes > 0 || stats.unassignedTickets > 0) && (
        <div className="space-y-2">
          {stats.pendingDelivery > 0 && (
            <AlertBanner
              type="warning"
              message={`${stats.pendingDelivery} dossier${stats.pendingDelivery > 1 ? 's' : ''} en attente de validation`}
              action="Valider"
              onAction={() => navigate('/admin/delivery-validation')}
            />
          )}
          {stats.unassignedTickets > 0 && (
            <AlertBanner
              type="warning"
              message={`${stats.unassignedTickets} ticket${stats.unassignedTickets > 1 ? 's' : ''} sans livreur affecté`}
              action="Affecter"
              onAction={() => navigate('/admin/delivery-assignment')}
            />
          )}
          {stats.openDisputes > 0 && (
            <AlertBanner
              type="error"
              message={`${stats.openDisputes} litige${stats.openDisputes > 1 ? 's' : ''} ouvert${stats.openDisputes > 1 ? 's' : ''} — action requise`}
              action="Voir litiges"
              onAction={() => navigate('/admin/disputes')}
            />
          )}
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users size={18} />}
          label="Organisations"
          value={loading ? skeleton() : stats.orgCount}
          sub={loading ? undefined : `${stats.buyerCount} ach. · ${stats.sellerCount} vend. · ${stats.deliveryCount} livr.`}
          color="#2c5dee"
        />
        <KpiCard
          icon={<Package size={18} />}
          label="Produits actifs"
          value={loading ? skeleton() : stats.productCount}
          sub="Référencés sur la marketplace"
          color="#14532d"
        />
        <KpiCard
          icon={<ShoppingCart size={18} />}
          label="Commandes"
          value={loading ? skeleton() : stats.orderCount}
          sub={loading ? undefined : `${stats.deliveredCount} livrées · ${stats.pendingOrderCount} en cours`}
          color="#4a1d96"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="CA visible"
          value={loading ? skeleton('w-24') : fmtMoney(stats.revenue)}
          sub="Commandes non annulées"
          color="#c97d1a"
        />
      </div>

      {/* ── Org breakdown + Pending orgs ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Répartition */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Répartition des organisations</h2>
          <div className="space-y-4">
            {[
              { label: 'Acheteurs',  count: stats.buyerCount,    color: '#2c5dee' },
              { label: 'Vendeurs',   count: stats.sellerCount,   color: '#7c3aed' },
              { label: 'Livreurs',   count: stats.deliveryCount, color: '#059669' },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="font-medium">{label}</span>
                  <span className="text-gray-400">
                    {loading ? '—' : `${count} / ${stats.orgCount} (${pct(count, stats.orgCount)}%)`}
                  </span>
                </div>
                <ProgressBar value={loading ? 0 : pct(count, stats.orgCount)} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Dossiers en attente */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Dossiers en attente
              {pendingOrgs.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">
                  {pendingOrgs.length}
                </span>
              )}
            </h2>
            <button
              onClick={() => navigate('/admin/approvals')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Tout voir <ArrowRight size={12} />
            </button>
          </div>
          {pendingOrgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400 text-sm">
              <CheckCircle size={24} className="mb-2 text-green-400" />
              Aucun dossier en attente
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-2">Organisation</th>
                  <th className="text-left font-medium pb-2">Type</th>
                  <th className="text-right font-medium pb-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingOrgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-50/60">
                    <td className="py-2 font-medium text-gray-800">{org.name}</td>
                    <td className="py-2"><OrgTypeBadge type={org.org_type} /></td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => navigate('/admin/approvals')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Examiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Recent orders ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Commandes récentes</h2>
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Toutes les commandes <ArrowRight size={12} />
          </button>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm">
            <Clock size={24} className="mb-2" />
            Aucune commande
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium px-5 py-2.5">Référence</th>
                <th className="text-left font-medium py-2.5">Acheteur</th>
                <th className="text-left font-medium py-2.5">Vendeur</th>
                <th className="text-right font-medium py-2.5">Montant</th>
                <th className="text-right font-medium px-5 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.map((o: any) => (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50/60 cursor-pointer"
                  onClick={() => navigate('/admin/orders')}
                >
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">
                    {o.order_number ?? o.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="py-3 text-gray-800 font-medium max-w-[140px] truncate">
                    {o.buyer?.name ?? '—'}
                  </td>
                  <td className="py-3 text-gray-500 max-w-[140px] truncate">
                    {o.seller?.name ?? '—'}
                  </td>
                  <td className="py-3 text-right text-gray-700 font-semibold">
                    {o.total_ttc != null
                      ? Number(o.total_ttc).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' MAD'
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Recent orgs ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Nouvelles inscriptions</h2>
          <button
            onClick={() => navigate('/admin/organisations')}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Toutes les organisations <ArrowRight size={12} />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium px-5 py-2.5">Organisation</th>
              <th className="text-left font-medium py-2.5">Type</th>
              <th className="text-left font-medium py-2.5">Statut</th>
              <th className="text-right font-medium px-5 py-2.5">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? [1,2,3].map(i => (
                <tr key={i}>
                  <td className="px-5 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="py-3"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="py-3"><div className="h-4 w-14 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="py-3 px-5"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))
              : recentOrgs.map((org: any) => (
                <tr
                  key={org.id}
                  className="hover:bg-gray-50/60 cursor-pointer"
                  onClick={() => navigate('/admin/organisations')}
                >
                  <td className="px-5 py-3 font-medium text-gray-800">{org.name}</td>
                  <td className="py-3"><OrgTypeBadge type={org.org_type} /></td>
                  <td className="py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        background: org.validation_status === 'active' ? '#dcfce7' : org.validation_status === 'pending' ? '#fef3c7' : '#fee2e2',
                        color:      org.validation_status === 'active' ? '#14532d' : org.validation_status === 'pending' ? '#92400e' : '#7f1d1d',
                      }}
                    >
                      {org.validation_status === 'active' ? 'Actif' : org.validation_status === 'pending' ? 'En attente' : 'Rejeté'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">
                    {new Date(org.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
