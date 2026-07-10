import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, SimpleGrid,
  Progress, Badge, Spinner,
} from '@chakra-ui/react';
import {
  ArrowLeft, AlertTriangle, TrendingUp,
  Lightbulb, ChevronRight, Package, BarChart2,
} from 'lucide-react';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558',
  amber: '#c97d1a', amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b',
  border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#1a5c35', greenLight: '#dcfce7',
  red: '#be1c1c', redLight: '#fff1f1', redBorder: '#fca5a5',
};

const CAT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8'];
const MONTHS_FR  = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// ── Types ─────────────────────────────────────────────────────────────────────
interface DlcAlert {
  id: string; name: string; orderId: string; dlcDate: string;
  days: number; qty: number; category: string;
}
interface MonthlySpend { month: string; amount: number; }
interface TopVendor    { id: string; name: string; amount: number; orders: number; }
interface CategorySpend{ name: string; amount: number; pct: number; color: string; }
interface Reco         { id: string; type: string; text: string; action: string; cta: string; urgency: 'high' | 'medium' | 'low'; }

// ── DLC Badge ─────────────────────────────────────────────────────────────────
function DlcBadge({ days }: { days: number }) {
  if (days <= 7)  return <Badge fontSize="10px" px={2} rounded="full" style={{ background: C.redLight,   color: C.red,     border: `1px solid ${C.redBorder}` }}>Critique &lt; 7j</Badge>;
  if (days <= 30) return <Badge fontSize="10px" px={2} rounded="full" style={{ background: '#fff7ed',    color: '#c2410c', border: '1px solid #fdba74' }}>Attention &lt; 30j</Badge>;
  return              <Badge fontSize="10px" px={2} rounded="full" style={{ background: C.greenLight, color: C.green,   border: '1px solid #86efac' }}>OK &gt; 30j</Badge>;
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function SpendBar({ month, amount, isLast, maxSpend }: { month: string; amount: number; isLast: boolean; maxSpend: number }) {
  const pct = Math.round((amount / (maxSpend || 1)) * 100);
  return (
    <Flex direction="column" align="center" gap={1} flex={1}>
      <Text fontSize="11px" fontWeight="700" style={{ color: C.navy }}>
        {(amount / 1000).toFixed(1)}k
      </Text>
      <Box w="full" bg={C.border} rounded="sm" h="80px" display="flex" alignItems="flex-end">
        <Box w="full" rounded="sm" transition="height 0.4s ease"
          style={{
            height: `${pct}%`,
            background: isLast
              ? `linear-gradient(to top, ${C.navy}, ${C.navyMid})`
              : `linear-gradient(to top, ${C.amber}cc, ${C.amberBorder})`,
          }} />
      </Box>
      <Text fontSize="10px" style={{ color: C.muted }}>{month}</Text>
    </Flex>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function InsightsPage() {
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'dlc' | 'spend' | 'reco'>('dlc');
  const [loading, setLoading]           = useState(true);
  const [dlcAlerts, setDlcAlerts]       = useState<DlcAlert[]>([]);
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpend[]>([]);
  const [topVendors, setTopVendors]     = useState<TopVendor[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [recommendations, setRecommendations] = useState<Reco[]>([]);

  useEffect(() => {
    if (!activeOrg) return;

    async function load() {
      setLoading(true);

      const since7m = new Date();
      since7m.setMonth(since7m.getMonth() - 7);

      // 1. Delivered orders for last 7 months
      const { data: ordersRaw } = await supabase
        .from('orders')
        .select(`
          id, order_number, total_ttc, created_at, seller_org_id,
          seller:organisations!seller_org_id(name)
        `)
        .eq('buyer_org_id', activeOrg!.id)
        .eq('status', 'delivered')
        .gte('created_at', since7m.toISOString())
        .order('created_at');

      type RawOrder = {
        id: string; order_number: string | null; total_ttc: number | null;
        created_at: string; seller_org_id: string;
        seller: { name: string } | null;
      };
      const orders = (ordersRaw ?? []) as RawOrder[];
      const orderIds = orders.map((o) => o.id);

      // 2. Order lines for DLC and category analysis
      type RawLine = {
        id: string; quantity: number; product_name_snap: string;
        order_id: string; line_total_ht: number;
        products: { shelf_life_days: number | null; categories: { id: string; name: string } | null } | null;
      };
      let lines: RawLine[] = [];
      if (orderIds.length > 0) {
        const { data } = await supabase
          .from('order_lines')
          .select(`
            id, quantity, product_name_snap, order_id, line_total_ht,
            products(shelf_life_days, categories(id, name))
          `)
          .in('order_id', orderIds);
        lines = (data ?? []) as RawLine[];
      }

      const today = new Date();

      // ── DLC Alerts ───────────────────────────────────────────────
      const alerts: DlcAlert[] = [];
      for (const l of lines) {
        const shelf = l.products?.shelf_life_days;
        if (!shelf || shelf <= 0) continue;
        const order = orders.find((o) => o.id === l.order_id);
        if (!order) continue;
        const dlcDate = new Date(order.created_at);
        dlcDate.setDate(dlcDate.getDate() + shelf);
        const remaining = Math.floor((dlcDate.getTime() - today.getTime()) / 86_400_000);
        if (remaining < 0 || remaining > 90) continue;
        alerts.push({
          id: l.id,
          name: l.product_name_snap,
          orderId: order.order_number ?? order.id.slice(0, 8).toUpperCase(),
          dlcDate: dlcDate.toISOString().slice(0, 10),
          days: remaining,
          qty: l.quantity,
          category: l.products?.categories?.name ?? 'Produits',
        });
      }
      alerts.sort((a, b) => a.days - b.days);
      setDlcAlerts(alerts);

      // ── Monthly Spend ─────────────────────────────────────────────
      const monthKeys: string[] = [];
      const monthAmounts = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${MONTHS_FR[d.getMonth()]}-${d.getFullYear()}`;
        monthKeys.push(key);
        monthAmounts.set(key, 0);
      }
      for (const o of orders) {
        const d = new Date(o.created_at);
        const key = `${MONTHS_FR[d.getMonth()]}-${d.getFullYear()}`;
        if (monthAmounts.has(key)) {
          monthAmounts.set(key, (monthAmounts.get(key) ?? 0) + (o.total_ttc ?? 0));
        }
      }
      const ms = monthKeys.map((k) => ({ month: k.split('-')[0], amount: monthAmounts.get(k) ?? 0 }));
      setMonthlySpend(ms);

      // ── Top Vendors ───────────────────────────────────────────────
      const vendorMap = new Map<string, { name: string; amount: number; orders: number }>();
      for (const o of orders) {
        const id = o.seller_org_id;
        const name = (o.seller as { name: string } | null)?.name ?? 'Vendeur';
        const prev = vendorMap.get(id) ?? { name, amount: 0, orders: 0 };
        vendorMap.set(id, { name, amount: prev.amount + (o.total_ttc ?? 0), orders: prev.orders + 1 });
      }
      const vendors = Array.from(vendorMap.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      setTopVendors(vendors);

      // ── Category Spend ────────────────────────────────────────────
      const catMap = new Map<string, { amount: number; colorIdx: number }>();
      let cIdx = 0;
      for (const l of lines) {
        const cat = l.products?.categories?.name ?? 'Autres';
        if (!catMap.has(cat)) catMap.set(cat, { amount: 0, colorIdx: cIdx++ });
        catMap.get(cat)!.amount += l.line_total_ht;
      }
      const totalCat = Array.from(catMap.values()).reduce((s, c) => s + c.amount, 0);
      setCategorySpend(
        Array.from(catMap.entries())
          .map(([name, { amount, colorIdx }]) => ({
            name, amount,
            pct: totalCat > 0 ? Math.round((amount / totalCat) * 100) : 0,
            color: CAT_COLORS[colorIdx % CAT_COLORS.length],
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6)
      );

      // ── Recommendations ───────────────────────────────────────────
      const recos: Reco[] = [];

      const critical = alerts.filter((a) => a.days <= 7);
      if (critical.length > 0) {
        recos.push({
          id: 'dlc-urgent', type: 'dlc', urgency: 'high',
          text: critical.length > 1
            ? `${critical.length} produits expirent dans moins de 7 jours — mettez-les en avant ou repositionnez vos stocks rapidement.`
            : `"${critical[0].name}" expire dans ${critical[0].days} jour(s) — pensez à écouler ce stock dès maintenant.`,
          action: 'Voir les commandes', cta: '/buyer/orders',
        });
      }

      const warning = alerts.filter((a) => a.days > 7 && a.days <= 30);
      if (warning.length > 0) {
        recos.push({
          id: 'dlc-warning', type: 'dlc', urgency: 'medium',
          text: `${warning.length} produit(s) arrivent à expiration dans les 30 prochains jours. Planifiez leur écoulement.`,
          action: 'Voir les alertes', cta: '/buyer/insights',
        });
      }

      if (vendors.length > 0) {
        const totalVSpend = vendors.reduce((s, v) => s + v.amount, 0);
        const topShare = totalVSpend > 0 ? vendors[0].amount / totalVSpend : 0;
        if (topShare > 0.45) {
          recos.push({
            id: 'diversify', type: 'savings', urgency: 'medium',
            text: `${vendors[0].name} représente ${Math.round(topShare * 100)}% de vos achats. Diversifier vos fournisseurs réduit les risques de rupture.`,
            action: 'Explorer le catalogue', cta: '/catalog',
          });
        }
      }

      const amounts = monthKeys.map((k) => monthAmounts.get(k) ?? 0);
      if (amounts.length >= 2) {
        const last = amounts[amounts.length - 1];
        const prev = amounts[amounts.length - 2];
        if (prev > 0 && last > prev * 1.15) {
          const growth = Math.round(((last - prev) / prev) * 100);
          recos.push({
            id: 'volume', type: 'volume', urgency: 'low',
            text: `Vos achats ont progressé de +${growth}% ce mois. Négociez un volume annuel avec vos principaux fournisseurs pour bénéficier de remises supplémentaires.`,
            action: 'Envoyer un devis', cta: '/buyer/quotes',
          });
        }
      }

      if (recos.length === 0) {
        recos.push({
          id: 'default', type: 'savings', urgency: 'low',
          text: "Continuez à commander régulièrement pour générer des recommandations personnalisées sur vos habitudes d'achat.",
          action: 'Parcourir le catalogue', cta: '/catalog',
        });
      }

      setRecommendations(recos);
      setLoading(false);
    }

    load();
  }, [activeOrg]);

  const criticalDlc = dlcAlerts.filter((a) => a.days <= 7).length;
  const warningDlc  = dlcAlerts.filter((a) => a.days > 7 && a.days <= 30).length;
  const totalSpend  = monthlySpend.reduce((s, m) => s + m.amount, 0);
  const maxSpend    = Math.max(...monthlySpend.map((m) => m.amount), 1);

  const tabs = [
    { k: 'dlc',  l: 'Alertes DLC',     icon: AlertTriangle, badge: criticalDlc > 0 ? String(criticalDlc) : null },
    { k: 'spend',l: 'Mes dépenses',    icon: BarChart2,     badge: null },
    { k: 'reco', l: 'Recommandations', icon: Lightbulb,     badge: recommendations.length > 0 ? String(recommendations.length) : null },
  ] as const;

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
      <Flex align="flex-start" justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
            style={{ color: C.muted }} mb={1} onClick={() => navigate('/buyer')}>
            Tableau de bord
          </Button>
          <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>Insights & Alertes</Heading>
          <Text fontSize="sm" style={{ color: C.muted }}>
            DLC, dépenses et recommandations personnalisées
          </Text>
        </Box>
      </Flex>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        {[
          { label: 'DLC critiques',    value: criticalDlc, sub: '< 7 jours',         dot: C.red,   bg: C.redLight },
          { label: 'DLC attention',    value: warningDlc,  sub: '< 30 jours',         dot: '#f97316', bg: '#fff7ed' },
          { label: 'Dépenses totales', value: totalSpend > 0 ? `${(totalSpend / 1000).toFixed(0)}k MAD` : '—', sub: '7 derniers mois', dot: C.navy, bg: '#f0f4ff' },
          { label: 'Recommandations',  value: recommendations.length, sub: 'Ce mois', dot: C.amber, bg: C.amberLight },
        ].map(({ label, value, sub, dot, bg }) => (
          <Box key={label} rounded="xl" p={4} style={{ background: bg, border: `1px solid ${dot}25` }}>
            <HStack spacing={1.5} mb={1}>
              <Box w={2} h={2} rounded="full" style={{ background: dot }} />
              <Text fontSize="11px" fontWeight="700" style={{ color: dot }}>{label}</Text>
            </HStack>
            <Text fontSize="2xl" fontWeight="900" style={{ color: dot }} lineHeight={1}>{value}</Text>
            <Text fontSize="11px" style={{ color: dot + 'aa' }} mt={0.5}>{sub}</Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* ── ONGLETS ──────────────────────────────────────────────────── */}
      <HStack spacing={2} flexWrap="wrap">
        {tabs.map(({ k, l, icon: Icon, badge }) => {
          const active = activeTab === k;
          return (
            <Box key={k} px={4} py={2.5} rounded="xl" cursor="pointer" transition="all 0.15s"
              style={{
                background: active ? C.navy : 'white',
                border: `1px solid ${active ? C.navy : C.border}`,
              }}
              _hover={{ borderColor: C.navy }} onClick={() => setActiveTab(k)}>
              <HStack spacing={2}>
                <Icon size={14} color={active ? 'white' : C.muted} />
                <Text fontSize="sm" fontWeight="700"
                  style={{ color: active ? 'white' : C.slate }}>{l}</Text>
                {badge && (
                  <Box rounded="full" px={1.5} py={0} minW="18px" textAlign="center"
                    style={{ background: active ? 'rgba(255,255,255,0.25)' : C.redLight }}>
                    <Text fontSize="10px" fontWeight="800"
                      style={{ color: active ? 'white' : C.red }}>{badge}</Text>
                  </Box>
                )}
              </HStack>
            </Box>
          );
        })}
      </HStack>

      {/* ── CONTENU DLC ──────────────────────────────────────────────── */}
      {activeTab === 'dlc' && (
        <Box bg="white" rounded="2xl" overflow="hidden"
          style={{ border: `1px solid ${C.border}` }}>
          <Box px={5} py={3} style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
            <HStack spacing={2}>
              <AlertTriangle size={14} color={C.red} />
              <Text fontSize="sm" fontWeight="700" style={{ color: C.navy }}>
                Produits avec DLC proche
              </Text>
            </HStack>
          </Box>
          {dlcAlerts.length === 0 ? (
            <Flex direction="column" align="center" py={12} gap={2}>
              <Package size={28} color={C.border} />
              <Text fontWeight="600" style={{ color: C.slate }}>Aucune alerte DLC</Text>
              <Text fontSize="xs" style={{ color: C.muted }}>
                Les alertes apparaîtront pour vos produits livrés avec une DLC proche
              </Text>
            </Flex>
          ) : (
            <VStack spacing={0} align="stretch">
              {dlcAlerts.map((alert) => (
                <Flex key={alert.id} px={5} py={4} align="center"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                  _hover={{ background: C.bgAlt }} transition="background 0.12s">
                  <Box flex={1} minW={0}>
                    <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }} noOfLines={1}>
                      {alert.name}
                    </Text>
                    <HStack spacing={2} mt={0.5}>
                      <Text fontSize="10px" style={{ color: C.muted }}>{alert.category}</Text>
                      <Text fontSize="10px" style={{ color: C.muted }}>·</Text>
                      <Text fontSize="10px" style={{ color: C.muted }}>{alert.qty} unités</Text>
                    </HStack>
                  </Box>
                  <VStack spacing={1} align="flex-end" minW="140px">
                    <DlcBadge days={alert.days} />
                    <Text fontSize="10px" style={{ color: C.muted }}>
                      Expire le {new Date(alert.dlcDate).toLocaleDateString('fr-FR')}
                    </Text>
                  </VStack>
                  <Button size="xs" variant="ghost" ml={3}
                    style={{ color: C.navy }} _hover={{ bg: C.bgAlt }}
                    rightIcon={<ChevronRight size={12} />}
                    onClick={() => navigate('/buyer/orders')}>
                    Commande
                  </Button>
                </Flex>
              ))}
            </VStack>
          )}
        </Box>
      )}

      {/* ── CONTENU DÉPENSES ─────────────────────────────────────────── */}
      {activeTab === 'spend' && (
        <VStack spacing={4} align="stretch">
          <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
            <Flex justify="space-between" align="center" mb={6}>
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase"
                  letterSpacing="0.8px" style={{ color: C.muted }}>Dépenses mensuelles</Text>
                <Text fontSize="2xl" fontWeight="900" style={{ color: C.navy }}>
                  {totalSpend > 0 ? `${(totalSpend / 1000).toFixed(0)}k MAD` : '—'}{' '}
                  <Text as="span" fontSize="sm" fontWeight="500" style={{ color: C.muted }}>sur 7 mois</Text>
                </Text>
              </Box>
              {monthlySpend.length >= 2 && monthlySpend[monthlySpend.length - 2].amount > 0 && (
                <HStack spacing={3}>
                  <TrendingUp size={20} color={C.green} />
                  <Box>
                    <Text fontSize="xs" fontWeight="700" style={{ color: C.green }}>
                      {monthlySpend[monthlySpend.length - 2].amount > 0
                        ? `+${Math.round(((monthlySpend[monthlySpend.length - 1].amount - monthlySpend[monthlySpend.length - 2].amount) / monthlySpend[monthlySpend.length - 2].amount) * 100)}%`
                        : '—'}
                    </Text>
                    <Text fontSize="10px" style={{ color: C.muted }}>vs mois préc.</Text>
                  </Box>
                </HStack>
              )}
            </Flex>
            {monthlySpend.length > 0 ? (
              <HStack spacing={2} align="flex-end" h="120px">
                {monthlySpend.map((m, i) => (
                  <SpendBar key={m.month + i} month={m.month} amount={m.amount}
                    isLast={i === monthlySpend.length - 1} maxSpend={maxSpend} />
                ))}
              </HStack>
            ) : (
              <Flex justify="center" align="center" h="120px">
                <Text style={{ color: C.muted }}>Aucune donnée disponible</Text>
              </Flex>
            )}
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {/* Par catégorie */}
            <Box bg="white" rounded="2xl" p={5} style={{ border: `1px solid ${C.border}` }}>
              <Text fontSize="sm" fontWeight="700" mb={4} style={{ color: C.navy }}>
                Répartition par catégorie
              </Text>
              {categorySpend.length === 0 ? (
                <Text fontSize="sm" style={{ color: C.muted }}>Aucune donnée</Text>
              ) : (
                <VStack spacing={3} align="stretch">
                  {categorySpend.map(({ name, amount, pct, color }) => (
                    <Box key={name}>
                      <Flex justify="space-between" mb={1}>
                        <HStack spacing={2}>
                          <Box w={2.5} h={2.5} rounded="sm" style={{ background: color }} />
                          <Text fontSize="sm" fontWeight="600" style={{ color: C.slate }}>{name}</Text>
                        </HStack>
                        <HStack spacing={2}>
                          <Text fontSize="sm" fontWeight="700" style={{ color: C.navy }}>
                            {(amount / 1000).toFixed(1)}k MAD
                          </Text>
                          <Text fontSize="11px" style={{ color: C.muted }}>{pct}%</Text>
                        </HStack>
                      </Flex>
                      <Progress value={pct} size="xs" rounded="full"
                        sx={{ '& > div': { background: color } }} />
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Top vendeurs */}
            <Box bg="white" rounded="2xl" p={5} style={{ border: `1px solid ${C.border}` }}>
              <Text fontSize="sm" fontWeight="700" mb={4} style={{ color: C.navy }}>
                Top vendeurs
              </Text>
              {topVendors.length === 0 ? (
                <Text fontSize="sm" style={{ color: C.muted }}>Aucune donnée</Text>
              ) : (
                <VStack spacing={3} align="stretch">
                  {topVendors.map((v, i) => (
                    <Flex key={v.id} align="center" gap={3}>
                      <Box w={7} h={7} rounded="lg" flexShrink={0} display="flex"
                        alignItems="center" justifyContent="center"
                        style={{ background: i === 0 ? C.amberLight : C.bgAlt }}>
                        <Text fontSize="12px" fontWeight="800"
                          style={{ color: i === 0 ? C.amber : C.muted }}>
                          {i + 1}
                        </Text>
                      </Box>
                      <Box flex={1} minW={0}>
                        <Text fontSize="sm" fontWeight="600" style={{ color: C.slate }} noOfLines={1}>
                          {v.name}
                        </Text>
                        <Text fontSize="10px" style={{ color: C.muted }}>
                          {v.orders} commande{v.orders > 1 ? 's' : ''}
                        </Text>
                      </Box>
                      <Text fontSize="sm" fontWeight="800" style={{ color: C.navy }}>
                        {(v.amount / 1000).toFixed(1)}k MAD
                      </Text>
                    </Flex>
                  ))}
                </VStack>
              )}
            </Box>
          </SimpleGrid>
        </VStack>
      )}

      {/* ── CONTENU RECOMMANDATIONS ───────────────────────────────────── */}
      {activeTab === 'reco' && (
        <VStack spacing={3} align="stretch">
          {recommendations.map((reco) => {
            const urgencyConfig = ({
              high:   { bg: C.redLight,   border: C.redBorder,   dot: C.red,   iconColor: C.red },
              medium: { bg: C.amberLight, border: C.amberBorder, dot: C.amber, iconColor: C.amber },
              low:    { bg: C.greenLight, border: '#86efac',     dot: C.green, iconColor: C.green },
            } as Record<string, { bg: string; border: string; dot: string; iconColor: string }>)[reco.urgency]
              ?? { bg: C.amberLight, border: C.amberBorder, dot: C.amber, iconColor: C.amber };

            return (
              <Box key={reco.id} rounded="2xl" p={5}
                style={{ background: urgencyConfig.bg, border: `1px solid ${urgencyConfig.border}` }}>
                <HStack spacing={4} align="flex-start">
                  <Box p={2.5} rounded="xl" flexShrink={0}
                    style={{ background: 'white', border: `1px solid ${urgencyConfig.border}` }}>
                    <Lightbulb size={16} color={urgencyConfig.iconColor} />
                  </Box>
                  <Box flex={1}>
                    <Text fontSize="sm" fontWeight="600" style={{ color: C.navy }} lineHeight={1.6}>
                      {reco.text}
                    </Text>
                    <Button size="xs" mt={3} fontWeight="700" rounded="full"
                      style={{ background: urgencyConfig.dot, color: 'white' }}
                      _hover={{ opacity: 0.9 }}
                      rightIcon={<ChevronRight size={12} />}
                      onClick={() => navigate(reco.cta)}>
                      {reco.action}
                    </Button>
                  </Box>
                </HStack>
              </Box>
            );
          })}
          <Box rounded="2xl" p={5} bg="white" textAlign="center"
            style={{ border: `1px solid ${C.border}` }}>
            <Package size={28} color={C.border} style={{ margin: '0 auto 8px' }} />
            <Text fontSize="sm" style={{ color: C.muted }}>
              De nouvelles recommandations apparaîtront au fil de votre activité
            </Text>
          </Box>
        </VStack>
      )}
    </VStack>
  );
}
