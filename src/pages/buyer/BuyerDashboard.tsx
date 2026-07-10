import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Grid, Heading, Text, VStack, HStack,
  Badge, Button, SimpleGrid, Skeleton, Avatar, Divider,
} from '@chakra-ui/react';
import {
  ShoppingBag, FileText, Truck, Bell, ArrowRight, Package,
  Clock, Search, Plus, ChevronRight, TrendingUp, CheckCircle,
  AlertCircle, RefreshCw, Heart, BarChart2, CreditCard,
  User, ShoppingCart, ArrowUpRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import BuyerMarketingWidget from '../../components/marketing/BuyerMarketingWidget';
import type { Order, Quote, Notification } from '../../types';

// ── Tokens — alignés sur les autres pages acheteur ───────────────────────────
const C = {
  navy:    '#0d1f38',
  navyMid: '#1a3558',
  amber:   '#c97d1a',
  amberLight: '#fef3c7',
  amberBorder: '#fbbf24',
  slate:   '#334155',
  muted:   '#64748b',
  border:  '#e2e8f0',
  bgAlt:   '#f8fafc',
  green:   '#1a5c35',
  greenLight: '#dcfce7',
  red:     '#be1c1c',
  redLight: '#fff1f1',
};

// ── Status maps ───────────────────────────────────────────────────────────────
const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:        { label: 'En attente',     color: '#92400e', bg: '#fef3c7' },
  confirmed:      { label: 'Confirmée',      color: '#1e40af', bg: '#dbeafe' },
  in_preparation: { label: 'En préparation', color: '#4a1d96', bg: '#ede9fe' },
  shipped:        { label: 'Expédiée',       color: '#7c2d12', bg: '#ffedd5' },
  delivered:      { label: 'Livrée',         color: '#14532d', bg: '#dcfce7' },
  cancelled:      { label: 'Annulée',        color: '#7f1d1d', bg: '#fee2e2' },
  dispute:        { label: 'Litige',         color: '#7f1d1d', bg: '#fee2e2' },
};

const QUOTE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Nouveau',   color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'En cours',  color: '#1e40af', bg: '#dbeafe' },
  responded:   { label: 'Répondu',   color: '#4a1d96', bg: '#ede9fe' },
  accepted:    { label: 'Accepté',   color: '#14532d', bg: '#dcfce7' },
  refused:     { label: 'Refusé',    color: '#7f1d1d', bg: '#fee2e2' },
  expired:     { label: 'Expiré',    color: '#6b7280', bg: '#f3f4f6' },
  converted:   { label: 'Converti',  color: '#14532d', bg: '#dcfce7' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

// ── Composant KPI Card ────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, iconBg, iconColor, loading, onClick,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  loading: boolean; onClick: () => void;
}) {
  return (
    <Box
      bg="white" rounded="2xl" p={5}
      style={{ border: `1px solid ${C.border}` }}
      cursor="pointer" onClick={onClick}
      _hover={{ shadow: 'md', borderColor: C.amberBorder, transform: 'translateY(-2px)' }}
      transition="all 0.18s"
    >
      <Flex justify="space-between" align="start" mb={3}>
        <Text fontSize="xs" fontWeight="600" style={{ color: C.muted }} letterSpacing="0.3px">
          {label}
        </Text>
        <Flex w={9} h={9} rounded="lg" align="center" justify="center"
          style={{ background: iconBg }}>
          <Icon size={16} color={iconColor} />
        </Flex>
      </Flex>
      <Text fontSize="2xl" fontWeight="800" style={{ color: C.navy }} lineHeight={1}>
        {loading ? '—' : value}
      </Text>
      <Text fontSize="xs" mt={1} style={{ color: C.muted }}>{sub}</Text>
    </Box>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function BuyerDashboard() {
  const { activeOrg, profile } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;
    async function load() {
      const [ordersRes, quotesRes, notifRes] = await Promise.all([
        supabase.from('orders').select('*').eq('buyer_org_id', activeOrg!.id)
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('quotes').select('*').eq('buyer_org_id', activeOrg!.id)
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('notifications').select('*')
          .order('created_at', { ascending: false }).limit(6),
      ]);
      setOrders((ordersRes.data as Order[]) ?? []);
      setQuotes((quotesRes.data as Quote[]) ?? []);
      setNotifications((notifRes.data as Notification[]) ?? []);
      setLoading(false);
    }
    load();
  }, [activeOrg]);

  const currency = activeOrg?.country === 'MA' ? 'MAD' : '€';
  const totalSpend = orders
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + (o.total_ttc ?? 0), 0);

  const activeQuotes = quotes.filter(q =>
    ['new', 'in_progress', 'responded'].includes(q.status)
  ).length;

  const unreadNotifs = notifications.filter(n => !n.read).length;

  // ── Navigation grid — 7 modules acheteur ─────────────────────────────────
  const navModules = [
    { label: 'Commandes', icon: ShoppingBag,  to: '/buyer/orders',   bg: '#eff6ff', color: '#2563eb' },
    { label: 'Devis',     icon: FileText,     to: '/buyer/quotes',   bg: '#fdf4ff', color: '#9333ea' },
    { label: 'Paniers',   icon: ShoppingCart, to: '/buyer/carts',    bg: '#fff7ed', color: '#c2410c' },
    { label: 'Favoris',   icon: Heart,        to: '/buyer/wishlist',  bg: '#fff1f2', color: '#e11d48' },
    { label: 'Insights',  icon: BarChart2,    to: '/buyer/insights',  bg: '#f0fdf4', color: '#16a34a' },
    { label: 'Finances',  icon: CreditCard,   to: '/buyer/finances',  bg: '#fffbeb', color: '#d97706' },
    { label: 'Compte',    icon: User,         to: '/buyer/account',   bg: '#f8fafc', color: '#475569' },
  ];

  return (
    <VStack spacing={6} align="stretch">

      {/* ── WELCOME BANNER ────────────────────────────────────────────────── */}
      <Box
        rounded="2xl" p={6} position="relative" overflow="hidden"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 100%)` }}
      >
        {/* Decorative circles */}
        <Box position="absolute" right="-20px" top="-20px" w="160px" h="160px"
          bg="rgba(255,255,255,0.05)" rounded="full" />
        <Box position="absolute" right="60px" bottom="-40px" w="100px" h="100px"
          bg="rgba(255,255,255,0.05)" rounded="full" />
        <Box position="absolute" left="-30px" bottom="-30px" w="120px" h="120px"
          bg="rgba(255,255,255,0.03)" rounded="full" />

        <Flex justify="space-between" align="center" position="relative" flexWrap="wrap" gap={4}>
          <HStack spacing={4}>
            <Avatar
              size="md"
              name={profile?.full_name ?? activeOrg?.name ?? ''}
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
            />
            <Box>
              <Text fontSize="sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {getGreeting()},
              </Text>
              <Heading size="md" color="white" lineHeight={1.2}>
                {profile?.full_name ?? activeOrg?.name}
              </Heading>
              <Text fontSize="xs" mt={0.5} style={{ color: C.amber }}>
                {activeOrg?.name}
              </Text>
            </Box>
          </HStack>
          <HStack spacing={3}>
            {unreadNotifs > 0 && (
              <Box
                px={3} py={1} rounded="full"
                style={{ background: '#dc2626', border: '1px solid #ef4444' }}
              >
                <Text fontSize="xs" fontWeight="700" color="white">
                  {unreadNotifs} notification{unreadNotifs > 1 ? 's' : ''}
                </Text>
              </Box>
            )}
            <Button
              size="sm" rounded="full" fontWeight="700"
              style={{ background: C.amber, color: 'white', border: `1px solid #b56b10` }}
              leftIcon={<Package size={14} />}
              _hover={{ opacity: 0.9 }}
              onClick={() => navigate('/catalog')}
            >
              Explorer le catalogue
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <KpiCard
          label="Commandes" loading={loading}
          value={orders.length}
          sub={`${orders.filter(o => o.status === 'delivered').length} livrées`}
          icon={ShoppingBag} iconBg="#eff6ff" iconColor="#2563eb"
          onClick={() => navigate('/buyer/orders')}
        />
        <KpiCard
          label="Devis actifs" loading={loading}
          value={activeQuotes}
          sub={`${quotes.length} au total`}
          icon={FileText} iconBg="#fdf4ff" iconColor="#9333ea"
          onClick={() => navigate('/buyer/quotes')}
        />
        <KpiCard
          label="CA réalisé" loading={loading}
          value={`${totalSpend.toFixed(0)} ${currency}`}
          sub="Commandes livrées"
          icon={TrendingUp} iconBg="#f0fdf4" iconColor="#16a34a"
          onClick={() => navigate('/buyer/orders')}
        />
        <KpiCard
          label="Notifications" loading={loading}
          value={unreadNotifs > 0 ? unreadNotifs : notifications.length}
          sub={unreadNotifs > 0 ? `${unreadNotifs} non lue${unreadNotifs > 1 ? 's' : ''}` : 'Toutes lues'}
          icon={Bell} iconBg="#fff7ed" iconColor="#c2410c"
          onClick={() => {}}
        />
      </SimpleGrid>

      {/* ── MON ESPACE ACHETEUR ────────────────────────────────────────────── */}
      <Box>
        <Text
          fontSize="11px" fontWeight="700" letterSpacing="0.8px"
          textTransform="uppercase" mb={3}
          style={{ color: C.muted }}
        >
          Mon espace acheteur
        </Text>
        <SimpleGrid columns={{ base: 4, sm: 4, md: 7 }} spacing={3}>
          {navModules.map(({ label, icon: Icon, to, bg, color }) => (
            <Box
              key={to}
              bg="white" rounded="2xl" p={4} cursor="pointer"
              style={{ border: `1px solid ${C.border}` }}
              _hover={{ shadow: 'md', borderColor: C.amberBorder, transform: 'translateY(-2px)' }}
              transition="all 0.18s"
              onClick={() => navigate(to)}
            >
              <Flex w={10} h={10} rounded="xl" align="center" justify="center" mb={3}
                style={{ background: bg }}>
                <Icon size={18} color={color} />
              </Flex>
              <Text fontSize="xs" fontWeight="700" style={{ color: C.navy }}>{label}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      {/* ── MAIN GRID — Commandes + Devis ─────────────────────────────────── */}
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={5}>

        {/* Commandes récentes */}
        <Box bg="white" rounded="2xl" style={{ border: `1px solid ${C.border}` }} overflow="hidden">
          <Flex
            justify="space-between" align="center" px={5} py={4}
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <HStack spacing={2}>
              <Box p={1.5} rounded="lg" style={{ background: '#eff6ff' }}>
                <ShoppingBag size={14} color="#2563eb" />
              </Box>
              <Heading size="sm" style={{ color: C.navy }}>Commandes récentes</Heading>
            </HStack>
            <Button
              size="xs" variant="ghost" rightIcon={<ArrowRight size={12} />}
              style={{ color: C.navy }}
              _hover={{ bg: C.bgAlt }}
              onClick={() => navigate('/buyer/orders')}
            >
              Voir tout
            </Button>
          </Flex>
          <VStack spacing={0} align="stretch">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Box key={i} p={4} style={{ borderBottom: `1px solid ${C.bgAlt}` }}>
                    <Skeleton h="44px" rounded="lg" />
                  </Box>
                ))
              : orders.length === 0
                ? (
                  <Flex direction="column" align="center" py={10} gap={3}>
                    <Box p={4} rounded="full" style={{ background: C.bgAlt }}>
                      <ShoppingBag size={28} color={C.border} />
                    </Box>
                    <Text fontSize="sm" style={{ color: C.muted }}>Aucune commande</Text>
                    <Button size="sm" rounded="full" fontWeight="700"
                      style={{ background: C.navy, color: 'white' }}
                      onClick={() => navigate('/catalog')}>
                      Commencer vos achats
                    </Button>
                  </Flex>
                )
                : orders.map(order => {
                    const st = ORDER_STATUS[order.status] ?? { label: order.status, color: C.muted, bg: C.bgAlt };
                    return (
                      <Flex
                        key={order.id}
                        px={5} py={3.5}
                        style={{ borderBottom: `1px solid ${C.bgAlt}` }}
                        justify="space-between" align="center"
                        cursor="pointer"
                        _hover={{ background: C.bgAlt }}
                        transition="background 0.12s"
                        onClick={() => navigate(`/buyer/orders/${order.id}`)}
                      >
                        <Box flex={1} minW={0}>
                          <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }} noOfLines={1}>
                            {order.order_number}
                          </Text>
                          <HStack spacing={1} mt={0.5}>
                            <Clock size={10} color={C.muted} />
                            <Text fontSize="xs" style={{ color: C.muted }}>
                              {new Date(order.created_at).toLocaleDateString('fr-FR')}
                            </Text>
                          </HStack>
                        </Box>
                        <HStack spacing={2}>
                          <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }}>
                            {order.total_ttc.toFixed(2)} {order.currency}
                          </Text>
                          <Badge
                            px={2} py={0.5} rounded="md" fontSize="10px" fontWeight="700"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </Badge>
                          {order.status === 'delivered' && (
                            <Button
                              size="xs" variant="ghost" fontWeight="600"
                              leftIcon={<RefreshCw size={11} />}
                              style={{ color: C.navy }}
                              _hover={{ bg: C.bgAlt }}
                              onClick={e => { e.stopPropagation(); navigate('/catalog'); }}
                            >
                              Réorder
                            </Button>
                          )}
                        </HStack>
                      </Flex>
                    );
                  })}
          </VStack>
        </Box>

        {/* Devis récents */}
        <Box bg="white" rounded="2xl" style={{ border: `1px solid ${C.border}` }} overflow="hidden">
          <Flex
            justify="space-between" align="center" px={5} py={4}
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <HStack spacing={2}>
              <Box p={1.5} rounded="lg" style={{ background: '#fdf4ff' }}>
                <FileText size={14} color="#9333ea" />
              </Box>
              <Heading size="sm" style={{ color: C.navy }}>Demandes de devis</Heading>
            </HStack>
            <HStack spacing={1}>
              <Button
                size="xs" rounded="full" fontWeight="700"
                style={{ background: C.amber, color: 'white', border: `1px solid #b56b10` }}
                leftIcon={<Plus size={11} />}
                _hover={{ opacity: 0.9 }}
                onClick={() => navigate('/buyer/quotes')}
              >
                Nouveau
              </Button>
              <Button
                size="xs" variant="ghost" rightIcon={<ChevronRight size={12} />}
                style={{ color: C.navy }}
                _hover={{ bg: C.bgAlt }}
                onClick={() => navigate('/buyer/quotes')}
              >
                Voir tout
              </Button>
            </HStack>
          </Flex>
          <VStack spacing={0} align="stretch">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Box key={i} p={4} style={{ borderBottom: `1px solid ${C.bgAlt}` }}>
                    <Skeleton h="44px" rounded="lg" />
                  </Box>
                ))
              : quotes.length === 0
                ? (
                  <Flex direction="column" align="center" py={10} gap={3}>
                    <Box p={4} rounded="full" style={{ background: C.bgAlt }}>
                      <FileText size={28} color={C.border} />
                    </Box>
                    <Text fontSize="sm" style={{ color: C.muted }}>Aucun devis en cours</Text>
                    <Button size="sm" rounded="full" fontWeight="700"
                      style={{ background: C.navy, color: 'white' }}
                      leftIcon={<Plus size={13} />}
                      onClick={() => navigate('/buyer/quotes')}>
                      Demander un devis
                    </Button>
                  </Flex>
                )
                : quotes.map(quote => {
                    const qs = QUOTE_STATUS[quote.status] ?? { label: quote.status, color: C.muted, bg: C.bgAlt };
                    const responded = quote.status === 'responded';
                    return (
                      <Flex
                        key={quote.id}
                        px={5} py={3.5}
                        style={{ borderBottom: `1px solid ${C.bgAlt}` }}
                        justify="space-between" align="center"
                        cursor="pointer"
                        _hover={{ background: C.bgAlt }}
                        transition="background 0.12s"
                        onClick={() => navigate(`/buyer/quotes/${quote.id}`)}
                      >
                        <Box flex={1} minW={0}>
                          <HStack spacing={2}>
                            <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }}>
                              {quote.quote_number}
                            </Text>
                            {responded && (
                              <Box
                                px={1.5} py={0.5} rounded="md"
                                style={{ background: '#fef9c3', border: '1px solid #fbbf24' }}
                              >
                                <Text fontSize="9px" fontWeight="800" style={{ color: '#92400e' }}>
                                  ACTION REQUISE
                                </Text>
                              </Box>
                            )}
                          </HStack>
                          <Text fontSize="xs" style={{ color: C.muted }} mt={0.5}>
                            {new Date(quote.requested_at).toLocaleDateString('fr-FR')}
                          </Text>
                        </Box>
                        <HStack spacing={2}>
                          <Badge
                            px={2} py={0.5} rounded="md" fontSize="10px" fontWeight="700"
                            style={{ background: qs.bg, color: qs.color }}
                          >
                            {qs.label}
                          </Badge>
                          <ChevronRight size={14} color={C.muted} />
                        </HStack>
                      </Flex>
                    );
                  })}
          </VStack>
        </Box>

        {/* Notifications */}
        <Box
          bg="white" rounded="2xl"
          style={{ border: `1px solid ${C.border}` }}
          overflow="hidden"
          gridColumn={{ base: '1', lg: '1 / 3' }}
        >
          <Flex
            justify="space-between" align="center" px={5} py={4}
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <HStack spacing={2}>
              <Box p={1.5} rounded="lg" style={{ background: '#fff7ed' }}>
                <Bell size={14} color="#c2410c" />
              </Box>
              <Heading size="sm" style={{ color: C.navy }}>Notifications</Heading>
              {unreadNotifs > 0 && (
                <Box
                  px={2} py={0.5} rounded="full"
                  style={{ background: '#dc2626' }}
                >
                  <Text fontSize="9px" fontWeight="800" color="white">{unreadNotifs}</Text>
                </Box>
              )}
            </HStack>
          </Flex>
          {notifications.length === 0 ? (
            <Flex direction="column" align="center" py={8} gap={2}>
              <Bell size={28} color={C.border} />
              <Text fontSize="sm" style={{ color: C.muted }}>Aucune notification</Text>
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={0}>
              {notifications.map(notif => (
                <Flex
                  key={notif.id}
                  px={5} py={3.5}
                  gap={3} align="start"
                  style={{
                    borderBottom: `1px solid ${C.bgAlt}`,
                    background: notif.read ? 'white' : '#eff6ff',
                  }}
                  cursor="pointer"
                  _hover={{ background: C.bgAlt }}
                  transition="background 0.12s"
                >
                  <Box mt={1} flexShrink={0}>
                    {notif.read
                      ? <CheckCircle size={14} color={C.border} />
                      : <AlertCircle size={14} color="#2563eb" />
                    }
                  </Box>
                  <Box flex={1} minW={0}>
                    <Text
                      fontWeight={notif.read ? '500' : '700'}
                      fontSize="sm"
                      style={{ color: C.navy }}
                      noOfLines={1}
                    >
                      {notif.title}
                    </Text>
                    {notif.body && (
                      <Text fontSize="xs" style={{ color: C.muted }} noOfLines={1}>
                        {notif.body}
                      </Text>
                    )}
                    <Text fontSize="10px" style={{ color: C.muted }} mt={0.5}>
                      {new Date(notif.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </SimpleGrid>
          )}
        </Box>
      </Grid>

      {/* ── MARKETING WIDGET ─────────────────────────────────────────────────── */}
      <BuyerMarketingWidget />

      {/* ── CTA CATALOGUE ─────────────────────────────────────────────────── */}
      <Box
        rounded="2xl" p={6}
        style={{ background: C.navy }}
        display="flex" alignItems="center" justifyContent="space-between"
        flexWrap="wrap" gap={4}
      >
        <HStack spacing={4}>
          <Flex w={12} h={12} rounded="xl" align="center" justify="center" flexShrink={0}
            style={{ background: C.amber }}>
            <Package size={22} color="white" />
          </Flex>
          <Box>
            <Text fontWeight="800" color="white" fontSize="sm">
              Découvrez de nouveaux produits
            </Text>
            <Text fontSize="xs" style={{ color: 'rgba(255,255,255,0.55)' }} mt={0.5}>
              Des milliers de références B2B FMCG — prix dégressifs, MOQ transparent
            </Text>
          </Box>
        </HStack>
        <HStack spacing={3}>
          <Button
            size="sm" rounded="full" fontWeight="700"
            style={{ background: C.amber, color: 'white', border: `1px solid #b56b10` }}
            rightIcon={<ArrowUpRight size={14} />}
            _hover={{ opacity: 0.9 }}
            onClick={() => navigate('/catalog')}
          >
            Explorer le catalogue
          </Button>
          <Button
            size="sm" rounded="full" fontWeight="700" variant="outline"
            style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)' }}
            leftIcon={<Search size={13} />}
            _hover={{ bg: 'rgba(255,255,255,0.1)' }}
            onClick={() => navigate('/best-deals')}
          >
            Best Deals
          </Button>
        </HStack>
      </Box>

      <Divider display="none" />
    </VStack>
  );
}
