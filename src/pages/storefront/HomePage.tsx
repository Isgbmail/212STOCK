import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box, Button, Flex, Heading, Text, VStack, HStack, SimpleGrid,
  Image, Badge, IconButton, Skeleton, useDisclosure, Progress,
} from '@chakra-ui/react';
import { ArrowRight, Star, ChevronRight, ChevronLeft, Lock, Scale, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useComparator } from '../../contexts/ComparatorContext';
import { AllCategoriesModal } from '../../layouts/StorefrontLayout';
import { useMarketingStorefront } from '../../hooks/useMarketingStorefront';
import PromoCodeBanner from '../../components/marketing/PromoCodeBanner';
import LiquidationLotsSection from '../../components/marketing/LiquidationLotsSection';
import {
  TopBannerBlock, ExtraRemiseBlock, RecommandePourVous, DealOfDayBlock,
  DynamicCategoryRows, FooterBannerBlock, RFQBoostBlock,
} from '../../components/marketing/HomepageBlocks';
import type { Category, Product, Brand } from '../../types';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:        '#0d1f38',
  navyMid:     '#1a3558',
  amber:       '#c97d1a',
  amberLight:  '#fef3c7',
  amberBorder: '#fbbf24',
  red:         '#be1c1c',
  redLight:    '#fff1f1',
  redBorder:   '#fca5a5',
  green:       '#1a5c35',
  greenLight:  '#dcfce7',
  slate:       '#334155',
  muted:       '#64748b',
  border:      '#e2e8f0',
  bgAlt:       '#f8fafc',
  bgWarm:      '#fafaf9',
};

// ── Countdown ─────────────────────────────────────────────────────────────────
function getFlashEnd() { const d = new Date(); d.setHours(23, 59, 59, 0); return d; }
function useCountdown(target: Date) {
  const calc = () => {
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
      m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  return t;
}

// ── Carousel hook ─────────────────────────────────────────────────────────────
function useCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = useCallback((dir: 'left' | 'right') => {
    if (ref.current) ref.current.scrollLeft += dir === 'right' ? 340 : -340;
  }, []);
  return { ref, scroll };
}

// ── Container ─────────────────────────────────────────────────────────────────
function Container({ children, py = 0 }: { children: React.ReactNode; py?: number }) {
  return <Box maxW="1400px" mx="auto" px={{ base: 4, md: 6 }} py={py}>{children}</Box>;
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({
  eyebrow, title, onAction, actionLabel, right, accentColor,
}: {
  eyebrow?: string; title: string;
  onAction?: () => void; actionLabel?: string;
  right?: React.ReactNode;
  accentColor?: string;
}) {
  const accent = accentColor ?? C.amber;
  return (
    <Flex align="center" justify="space-between" mb={6}>
      <Box style={{ borderLeft: `3px solid ${accent}`, paddingLeft: '14px' }}>
        {eyebrow && (
          <Text fontSize="10px" fontWeight="800" letterSpacing="2px"
            textTransform="uppercase" mb={0.5} style={{ color: accent }}>
            {eyebrow}
          </Text>
        )}
        <Heading size="md" fontWeight="800" style={{ color: C.navy }}>{title}</Heading>
      </Box>
      <HStack spacing={2}>
        {right}
        {onAction && (
          <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm"
            color={C.slate} _hover={{ color: accent, bg: 'transparent' }}
            rightIcon={<ChevronRight size={13} />} onClick={onAction}>
            {actionLabel ?? 'Voir tout'}
          </Button>
        )}
      </HStack>
    </Flex>
  );
}

// ── Carousel wrapper ──────────────────────────────────────────────────────────
function Carousel({ scrollRef, onScroll, children }: {
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: (dir: 'left' | 'right') => void;
  children: React.ReactNode;
}) {
  return (
    <Box position="relative">
      <IconButton aria-label="Gauche" icon={<ChevronLeft size={16} />}
        position="absolute" left="-14px" top="50%" transform="translateY(-50%)"
        zIndex={10} size="sm" bg="white" shadow="md" border="1px" borderColor={C.border}
        color={C.slate} rounded="full"
        _hover={{ bg: C.amberLight, color: C.amber, borderColor: C.amberBorder }}
        display={{ base: 'none', md: 'flex' }} onClick={() => onScroll('left')} />
      <Box ref={scrollRef} display="flex" gap={3} overflowX="auto" pb={1}
        style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none' }}
        sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        {children}
      </Box>
      <IconButton aria-label="Droite" icon={<ChevronRight size={16} />}
        position="absolute" right="-14px" top="50%" transform="translateY(-50%)"
        zIndex={10} size="sm" bg="white" shadow="md" border="1px" borderColor={C.border}
        color={C.slate} rounded="full"
        _hover={{ bg: C.amberLight, color: C.amber, borderColor: C.amberBorder }}
        display={{ base: 'none', md: 'flex' }} onClick={() => onScroll('right')} />
    </Box>
  );
}

// ── Product card (standard + compare toggle) ──────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, removeItem, hasItem } = useComparator();
  const inComp = hasItem(product.id);
  const tiers = product.price_tiers?.sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const first = tiers[0];
  const last = tiers[tiers.length - 1];
  const hasRange = tiers.length > 1 && first && last && first.unit_price !== last.unit_price;

  return (
    <Box flexShrink={0} w={{ base: '158px', md: '192px' }} bg="white" rounded="lg"
      overflow="hidden" border="1px solid" borderColor={C.border}
      cursor="pointer" onClick={() => navigate(`/product/${product.id}`)} role="group"
      _hover={{ shadow: 'md', transform: 'translateY(-3px)', borderColor: C.amberBorder }}
      transition="all 0.2s ease" position="relative">
      {product.is_on_promotion && (
        <Box position="absolute" top={2} left={2} zIndex={2}>
          <Box style={{ background: C.amber }} rounded="sm" px={1.5} py={0.5}>
            <Text fontSize="8px" fontWeight="800" color="white">PROMO</Text>
          </Box>
        </Box>
      )}

      {/* Compare toggle — appears on hover */}
      <Box position="absolute" top={2} right={2} zIndex={2}
        opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.18s">
        <Box w={7} h={7} rounded="sm" cursor="pointer"
          display="flex" alignItems="center" justifyContent="center"
          title={inComp ? 'Retirer du comparateur' : 'Ajouter au comparateur'}
          style={{
            background: inComp ? C.amber : 'rgba(255,255,255,0.93)',
            border: `1px solid ${inComp ? C.amber : C.border}`,
          }}
          onClick={(e) => { e.stopPropagation(); inComp ? removeItem(product.id) : addItem(product); }}>
          <Scale size={13} color={inComp ? 'white' : C.slate} />
        </Box>
      </Box>

      <Box h={{ base: '128px', md: '155px' }} position="relative" overflow="hidden">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover"
            transition="transform 0.35s ease" _groupHover={{ transform: 'scale(1.05)' }} />
        ) : (
          <Flex w="full" h="full" align="center" justify="center" style={{ background: C.bgAlt }}>
            <Text fontWeight="900" fontSize="4xl" lineHeight={1} userSelect="none" style={{ color: '#cbd5e1' }}>
              {product.name.charAt(0).toUpperCase()}
            </Text>
          </Flex>
        )}
        {user && product.moq > 1 && (
          <Box position="absolute" bottom={2} left={2}
            style={{ background: 'rgba(13,31,56,0.75)' }} rounded="sm" px={1.5} py={0.5}>
            <Text fontSize="8px" fontWeight="700" color="white">MOQ {product.moq}</Text>
          </Box>
        )}
      </Box>
      <Box p={3}>
        <Text fontSize="9px" fontWeight="700" noOfLines={1} mb={0.5}
          textTransform="uppercase" letterSpacing="0.6px" style={{ color: C.amber }}>
          {product.organisations?.name ?? 'Vendeur'}
        </Text>
        <Text fontWeight="600" color="gray.800" fontSize="xs" noOfLines={2} mb={1.5} lineHeight={1.4}>
          {product.name}
        </Text>
        {product.avg_rating > 0 && (
          <HStack spacing={0.5} mb={1.5}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={9}
                fill={i < Math.round(product.avg_rating) ? '#F59E0B' : 'none'} color="#F59E0B" />
            ))}
          </HStack>
        )}
        {user ? (
          first ? (
            <Box>
              <HStack spacing={1} align="baseline">
                <Text fontWeight="800" fontSize="md" lineHeight={1} style={{ color: C.navy }}>
                  {first.unit_price.toFixed(2)}
                </Text>
                <Text fontSize="9px" style={{ color: C.muted }}>{product.currency}</Text>
              </HStack>
              {hasRange && (
                <Text fontSize="8px" color="gray.400" mt={0.5}>
                  jusqu'à {last!.unit_price.toFixed(2)} {product.currency}
                </Text>
              )}
            </Box>
          ) : <Text fontSize="xs" color="gray.400" fontStyle="italic">Sur devis</Text>
        ) : (
          <Box rounded="md" px={2} py={1} cursor="pointer"
            style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}
            onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
            _hover={{ borderColor: C.amberBorder }}>
            <HStack spacing={1}>
              <Lock size={9} color={C.muted} />
              <Text fontSize="9px" fontWeight="700" style={{ color: C.slate }}>Voir le prix</Text>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Destocking card ───────────────────────────────────────────────────────────
function DestockCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, removeItem, hasItem } = useComparator();
  const inComp = hasItem(product.id);
  const tiers = product.price_tiers?.sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const first = tiers[0];
  const stockQty = product.stock_qty ?? 0;
  const stockPct = stockQty > 0 ? Math.min(100, Math.round((stockQty / 100) * 100)) : 5;
  const stockUrgent = stockQty > 0 && stockQty <= 20;

  return (
    <Box flexShrink={0} w={{ base: '168px', md: '205px' }} bg="white" rounded="lg"
      overflow="hidden" cursor="pointer" role="group" position="relative"
      onClick={() => navigate(`/product/${product.id}`)}
      style={{ border: `1.5px solid ${stockUrgent ? C.redBorder : C.border}` }}
      _hover={{ shadow: 'md', transform: 'translateY(-3px)' }}
      transition="all 0.2s ease">

      {/* Red accent top bar */}
      <Box h="3px" style={{ background: `linear-gradient(to right, ${C.red}, ${C.amber})` }} />

      {/* Destocking badge */}
      <Box position="absolute" top={3} left={2} zIndex={2}>
        <Box style={{ background: C.red }} rounded="sm" px={1.5} py={0.5}>
          <Text fontSize="8px" fontWeight="800" color="white" letterSpacing="0.5px">DÉSTOCK</Text>
        </Box>
      </Box>

      {/* Compare toggle */}
      <Box position="absolute" top={3} right={2} zIndex={2}
        opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.18s">
        <Box w={7} h={7} rounded="sm" cursor="pointer"
          display="flex" alignItems="center" justifyContent="center"
          style={{
            background: inComp ? C.amber : 'rgba(255,255,255,0.93)',
            border: `1px solid ${inComp ? C.amber : C.border}`,
          }}
          onClick={(e) => { e.stopPropagation(); inComp ? removeItem(product.id) : addItem(product); }}>
          <Scale size={13} color={inComp ? 'white' : C.slate} />
        </Box>
      </Box>

      <Box h={{ base: '130px', md: '158px' }} position="relative" overflow="hidden">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover"
            transition="transform 0.35s" _groupHover={{ transform: 'scale(1.05)' }} />
        ) : (
          <Flex w="full" h="full" align="center" justify="center" style={{ background: C.redLight }}>
            <Text fontWeight="900" fontSize="4xl" lineHeight={1} userSelect="none"
              style={{ color: '#fca5a5' }}>
              {product.name.charAt(0).toUpperCase()}
            </Text>
          </Flex>
        )}
        {user && product.moq > 1 && (
          <Box position="absolute" bottom={2} left={2}
            style={{ background: 'rgba(190,28,28,0.8)' }} rounded="sm" px={1.5} py={0.5}>
            <Text fontSize="8px" fontWeight="700" color="white">MOQ {product.moq}</Text>
          </Box>
        )}
      </Box>

      <Box p={3}>
        <Text fontSize="9px" fontWeight="700" noOfLines={1} mb={0.5}
          textTransform="uppercase" letterSpacing="0.6px" style={{ color: C.red }}>
          {product.organisations?.name ?? 'Vendeur'}
        </Text>
        <Text fontWeight="600" color="gray.800" fontSize="xs" noOfLines={2} mb={2} lineHeight={1.4}>
          {product.name}
        </Text>

        {/* Stock indicator */}
        {stockQty > 0 && (
          <Box mb={2}>
            <Flex justify="space-between" align="center" mb={0.5}>
              <Text fontSize="8px" fontWeight="700"
                style={{ color: stockUrgent ? C.red : C.muted }}>
                {stockUrgent ? 'Dernières unités !' : `${stockQty} unités restantes`}
              </Text>
            </Flex>
            <Progress
              value={stockPct} size="xs" rounded="full"
              colorScheme={stockUrgent ? 'red' : 'orange'}
              style={{ height: '4px' }}
            />
          </Box>
        )}

        {user ? (
          first ? (
            <HStack spacing={1} align="baseline">
              <Text fontWeight="900" fontSize="md" lineHeight={1} style={{ color: C.red }}>
                {first.unit_price.toFixed(2)}
              </Text>
              <Text fontSize="9px" style={{ color: C.muted }}>{product.currency}</Text>
            </HStack>
          ) : <Text fontSize="xs" color="gray.400" fontStyle="italic">Sur devis</Text>
        ) : (
          <Box rounded="md" px={2} py={1} cursor="pointer"
            style={{ background: C.redLight, border: `1px solid ${C.redBorder}` }}
            onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
            _hover={{ opacity: 0.8 }}>
            <HStack spacing={1}>
              <Lock size={9} color={C.red} />
              <Text fontSize="9px" fontWeight="700" style={{ color: C.red }}>Voir le prix</Text>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Brand card ────────────────────────────────────────────────────────────────
function BrandCard({ brand, onClick }: { brand: Brand; onClick: () => void }) {
  return (
    <Box flexShrink={0} w="108px" bg="white" rounded="lg" p={3}
      border="1px solid" borderColor={C.border} cursor="pointer" onClick={onClick}
      display="flex" flexDirection="column" alignItems="center" gap={2}
      _hover={{ shadow: 'sm', borderColor: C.amberBorder }} transition="all 0.18s">
      <Box w="50px" h="50px" rounded="md" overflow="hidden" bg={C.bgAlt} border="1px solid" borderColor={C.border}>
        {brand.logo_url
          ? <Image src={brand.logo_url} alt={brand.name} w="full" h="full" objectFit="contain" p={1} />
          : <Flex w="full" h="full" align="center" justify="center">
              <Text fontWeight="900" fontSize="xl" userSelect="none" style={{ color: '#cbd5e1' }}>
                {brand.name.charAt(0).toUpperCase()}
              </Text>
            </Flex>}
      </Box>
      <Text fontWeight="600" fontSize="10px" textAlign="center" noOfLines={1} style={{ color: C.slate }}>
        {brand.name}
      </Text>
    </Box>
  );
}

// ── Platform stat formatter ────────────────────────────────────────────────────
function fmtStat(n: number, fallback: string): string {
  if (n <= 0) return fallback;
  return `${n.toLocaleString('fr-FR')}+`;
}

const PILL_COLORS = [
  { bg: '#f0f4ff', color: '#1e3a8a', bdr: '#a5b4fc' },
  { bg: '#f0fdf4', color: '#14532d', bdr: '#86efac' },
  { bg: '#fff5f8', color: '#881337', bdr: '#fda4af' },
  { bg: '#f5f3ff', color: '#312e81', bdr: '#c4b5fd' },
  { bg: '#fef9f0', color: '#92400e', bdr: '#fcd34d' },
  { bg: '#ecfeff', color: '#164e63', bdr: '#67e8f9' },
  { bg: '#fff5f5', color: '#7f1d1d', bdr: '#fca5a5' },
  { bg: '#fdf6f0', color: '#3b1a06', bdr: '#f59e0b' },
];

interface ContentBanner {
  id: string; label: string; sub: string; image: string;
  tag: string; tagColor: string; href: string;
}

const BANNER_OVERLAY = 'linear-gradient(to top, rgba(13,31,56,0.96) 0%, rgba(13,31,56,0.65) 45%, rgba(0,0,0,0.12) 100%)';
const BANNER_TAG_COLORS = ['#c97d1a', '#22d3ee', '#4ade80', '#f59e0b', '#818cf8', '#f87171'];

// ═════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items: compItems, clearItems: clearComp } = useComparator();
  const { isOpen: isCatOpen, onOpen: openCat, onClose: closeCat } = useDisclosure();
  const countdown = useCountdown(getFlashEnd());

  const [roots, setRoots] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [destocking, setDestocking] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sponsored, setSponsored] = useState<Product[]>([]);
  const [tempProducts, setTempProducts] = useState<Record<string, Product[]>>({});
  const [tempTab, setTempTab] = useState<'ambient' | 'refrigerated' | 'frozen'>('ambient');
  const [topRated, setTopRated] = useState<Product[]>([]);
  const [dealProduct, setDealProduct] = useState<Product | null>(null);
  const [loadingFeat, setLoadingFeat] = useState(true);
  const [loadingPromo, setLoadingPromo] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingDestock, setLoadingDestock] = useState(true);
  const [loadingSponsored, setLoadingSponsored] = useState(true);
  const [loadingTemp, setLoadingTemp] = useState(true);
  const [loadingTopRated, setLoadingTopRated] = useState(true);
  const [platformCounts, setPlatformCounts] = useState({ products: 0, vendors: 0, delivery: 0 });
  const [banners, setBanners] = useState<ContentBanner[]>([]);

  const mktData = useMarketingStorefront();

  useEffect(() => {
    if (!mktData.dealOfDay?.product_id) return;
    supabase.from('products')
      .select('*, organisations(name), price_tiers(*)')
      .eq('id', mktData.dealOfDay.product_id)
      .single()
      .then(({ data }) => setDealProduct(data as Product | null));
  }, [mktData.dealOfDay?.product_id]);

  const featCarousel = useCarousel();
  const promoCarousel = useCarousel();
  const newCarousel = useCarousel();
  const destockCarousel = useCarousel();
  const sponsoredCarousel = useCarousel();
  const tempCarousel = useCarousel();
  const topRatedCarousel = useCarousel();

  useEffect(() => {
    supabase.from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true).order('display_order')
      .then(({ data }) => {
        const all = (data as Category[]) ?? [];
        setRoots(all.filter((c) => !c.parent_id));
        setSubCategories(all.filter((c) => !!c.parent_id));
      });

    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').limit(12).order('avg_rating', { ascending: false })
      .then(({ data }) => { setFeatured((data as Product[]) ?? []); setLoadingFeat(false); });

    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').eq('is_on_promotion', true).limit(10)
      .then(({ data }) => { setPromos((data as Product[]) ?? []); setLoadingPromo(false); });

    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').eq('is_new', true).limit(12).order('created_at', { ascending: false })
      .then(({ data }) => { setNewArrivals((data as Product[]) ?? []); setLoadingNew(false); });

    // Destockage: promotions + lowest stock first
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').eq('is_on_promotion', true)
      .order('stock_qty', { ascending: true, nullsFirst: false })
      .limit(12)
      .then(({ data }) => { setDestocking((data as Product[]) ?? []); setLoadingDestock(false); });

    supabase.from('brands').select('*').limit(14)
      .then(({ data }) => setBrands((data as Brand[]) ?? []));

    // Produits sponsorisés
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').eq('is_sponsored', true).limit(10)
      .then(({ data }) => { setSponsored((data as Product[]) ?? []); setLoadingSponsored(false); });

    // Top notés (avg_rating >= 4, séparés de "featured" pour garder l'indépendance)
    supabase.from('products').select('*, organisations(name), price_tiers(*)')
      .eq('status', 'active').gte('avg_rating', 4)
      .order('avg_rating', { ascending: false }).limit(12)
      .then(({ data }) => { setTopRated((data as Product[]) ?? []); setLoadingTopRated(false); });

    // Zones thermiques — prefetch les 3 en parallèle
    Promise.all(
      (['ambient', 'refrigerated', 'frozen'] as const).map((zone) =>
        supabase.from('products').select('*, organisations(name), price_tiers(*)')
          .eq('status', 'active').eq('temperature', zone).limit(12)
          .then(({ data }) => ({ zone, products: (data as Product[]) ?? [] }))
      )
    ).then((results) => {
      const map: Record<string, Product[]> = {};
      results.forEach(({ zone, products }) => { map[zone] = products; });
      setTempProducts(map);
      setLoadingTemp(false);
    });

    // Statistiques plateforme
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'seller').eq('validation_status', 'active'),
      supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('org_type', 'delivery').eq('validation_status', 'active'),
    ]).then(([prodRes, vendorRes, deliveryRes]) => {
      setPlatformCounts({
        products: prodRes.count ?? 0,
        vendors:  vendorRes.count ?? 0,
        delivery: deliveryRes.count ?? 0,
      });
    });

    // Bannières éditoriales depuis content_items
    supabase.from('content_items')
      .select('id, title, subtitle, cta_label, cta_url, image_url, body')
      .eq('type', 'banner')
      .eq('active', true)
      .order('display_order')
      .limit(6)
      .then(({ data }) => {
        type RawItem = { id: string; title: string; subtitle: string | null; cta_label: string | null; cta_url: string | null; image_url: string | null; body: string | null };
        setBanners(
          ((data ?? []) as RawItem[]).map((item, idx) => {
            let tagColor = BANNER_TAG_COLORS[idx % BANNER_TAG_COLORS.length];
            try {
              const parsed = JSON.parse(item.body ?? '{}');
              if (typeof parsed.tagColor === 'string') tagColor = parsed.tagColor;
            } catch {}
            return {
              id:       item.id,
              label:    item.title,
              sub:      item.subtitle ?? '',
              image:    item.image_url ?? '',
              tag:      item.cta_label ?? '',
              tagColor,
              href:     item.cta_url ?? '/catalog',
            };
          })
        );
      });
  }, []);

  return (
    <Box bg="white">

      {/* ══════════════════════════════════════════════════════════════
          HERO — Dark navy split layout
      ══════════════════════════════════════════════════════════════ */}
      <Box position="relative" overflow="hidden"
        minH={{ base: '460px', md: '500px', lg: '560px' }} style={{ background: C.navy }}>
        <Box position="absolute" right={0} top={0} bottom={0}
          w={{ base: 'full', lg: '48%' }} opacity={{ base: 0.12, lg: 1 }}>
          <Image
            src="https://images.pexels.com/photos/4481259/pexels-photo-4481259.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="" w="full" h="full" objectFit="cover" objectPosition="center" />
          <Box position="absolute" inset={0} style={{
            background: 'linear-gradient(to right, #0d1f38 0%, rgba(13,31,56,0.55) 35%, transparent 70%)',
          }} />
        </Box>
        <Box position="absolute" inset={0} opacity={0.03} style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }} />

        <Container>
          <Box py={{ base: 16, md: 20, lg: 24 }} maxW={{ lg: '56%' }} position="relative" zIndex={2}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}>
              <HStack spacing={3} mb={5} align="center">
                <Box w={8} h="2px" style={{ background: C.amber }} />
                <Text fontSize="10px" fontWeight="800" letterSpacing="3.5px"
                  textTransform="uppercase" style={{ color: C.amber }}>
                  MARKETPLACE B2B · FMCG
                </Text>
              </HStack>
              <Heading color="white" fontWeight="900"
                fontSize={{ base: '32px', md: '42px', lg: '52px' }}
                lineHeight={1.05} letterSpacing="-0.025em" mb={5}>
                La référence B2B<br />pour les professionnels<br />
                <Text as="span" style={{ color: C.amber }}>du FMCG</Text>
              </Heading>
              <Text fontSize={{ base: 'sm', md: 'md' }} lineHeight={1.85} maxW="440px" mb={8}
                style={{ color: 'rgba(203,213,225,0.82)' }}>
                {fmtStat(platformCounts.products, '10 000+')} produits,{' '}
                {fmtStat(platformCounts.vendors, '500+')} vendeurs vérifiés, prix dégressifs MOQ,
                livreurs certifiés chaîne du froid — en Europe &amp; Afrique.
              </Text>
              <HStack spacing={3} mb={12} flexWrap="wrap">
                <Button size="md" rounded="md" fontWeight="700" fontSize="sm"
                  rightIcon={<ArrowRight size={15} />} onClick={() => navigate('/catalog')}
                  style={{ background: C.amber, color: 'white', boxShadow: '0 4px 20px rgba(201,125,26,0.4)' }}
                  _hover={{ opacity: 0.9, transform: 'translateY(-1px)' }} transition="all 0.18s">
                  Explorer le catalogue
                </Button>
                <Button size="md" rounded="md" fontWeight="600" fontSize="sm" variant="outline"
                  color="white" borderColor="rgba(255,255,255,0.28)"
                  onClick={() => navigate('/auth')}
                  _hover={{ bg: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.55)' }}>
                  {user ? 'Mon espace' : 'Créer un compte'}
                </Button>
              </HStack>
              <Flex align="center" flexWrap="wrap" rowGap={4}>
                {[
                  { v: fmtStat(platformCounts.products, '10 000+'), l: 'Produits actifs' },
                  { v: fmtStat(platformCounts.vendors, '500+'),     l: 'Vendeurs vérifiés' },
                  { v: fmtStat(platformCounts.delivery, '200+'),    l: 'Livreurs partenaires' },
                  { v: '30+',                                        l: 'Pays couverts' },
                ].map(({ v, l }, i) => (
                  <Flex key={l} align="center">
                    {i > 0 && <Box flexShrink={0} w="1px" h="36px" mx={5}
                      style={{ background: 'rgba(255,255,255,0.12)' }} />}
                    <Box>
                      <Text fontWeight="900" fontSize="xl" color="white" lineHeight={1}>{v}</Text>
                      <Text fontSize="10px" fontWeight="500" mt={0.5}
                        style={{ color: 'rgba(148,163,184,0.8)' }}>{l}</Text>
                    </Box>
                  </Flex>
                ))}
              </Flex>
            </motion.div>
          </Box>
        </Container>
      </Box>

      <TopBannerBlock campaigns={mktData.topBanners} />

      {/* ══════════════════════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════════════════════ */}
      <Box style={{ background: C.bgWarm, borderBottom: `1px solid ${C.border}` }}>
        <Container>
          <Flex py={3} gap={0} align="center" justify="center" flexWrap="wrap"
            display={{ base: 'none', md: 'flex' }}>
            {[
              { label: 'Vendeurs certifiés',        accent: C.amber },
              { label: 'Prix dégressifs MOQ',        accent: C.amber },
              { label: 'Chaîne du froid ATP',        accent: C.green },
              { label: 'Paiements sécurisés',        accent: C.navy },
              { label: 'Livraison Europe & Afrique', accent: C.navy },
            ].map(({ label, accent }, i) => (
              <Flex key={label} align="center">
                {i > 0 && <Box w="1px" h="14px" mx={5} style={{ background: C.border }} flexShrink={0} />}
                <Flex align="center" gap={2}>
                  <Box w={1.5} h={1.5} rounded="full" style={{ background: accent }} flexShrink={0} />
                  <Text fontSize="xs" fontWeight="600" style={{ color: C.slate }}>{label}</Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY BAR — sticky pill scroll
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" position="sticky" top={{ base: '108px', lg: '130px' }} zIndex={100}
        style={{ borderBottom: `1px solid ${C.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
        <Container>
          <Box display="flex" gap={2} py={3} alignItems="center"
            overflowX="auto" style={{ scrollbarWidth: 'none' }}
            sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
            <Box flexShrink={0} px={4} py="7px" rounded="md" cursor="pointer"
              style={{ background: C.navy }} onClick={openCat}
              _hover={{ opacity: 0.85 }} transition="opacity 0.15s">
              <Text fontSize="xs" fontWeight="700" color="white" whiteSpace="nowrap">
                Toutes les catégories
              </Text>
            </Box>
            {roots.map((cat, i) => {
              const { bg: pBg, color: pColor, bdr: pBdr } = PILL_COLORS[i % PILL_COLORS.length];
              return (
                <Box key={cat.id} flexShrink={0} px={4} py="7px" rounded="md" cursor="pointer"
                  style={{ background: pBg, border: `1px solid ${pBdr}40` }}
                  _hover={{ opacity: 0.8 }} transition="opacity 0.14s"
                  onClick={() => navigate(`/catalog?category=${cat.id}`)}>
                  <Text fontSize="xs" fontWeight="600" style={{ color: pColor }}
                    whiteSpace="nowrap" maxW="110px" overflow="hidden" textOverflow="ellipsis">
                    {cat.name}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          CODES PROMO ACTIFS — bande horizontale copyable
      ══════════════════════════════════════════════════════════════ */}
      {mktData.promoCodes.length > 0 && (
        <PromoCodeBanner promoCodes={mktData.promoCodes} />
      )}

      <ExtraRemiseBlock campaigns={mktData.extraRemises} />

      {/* ══════════════════════════════════════════════════════════════
          FLASH DEALS — promo carousel avec countdown
      ══════════════════════════════════════════════════════════════ */}
      {(loadingPromo || promos.length > 0 || mktData.flashSales.length > 0) && (
        <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
          <Container>
            <SectionHead
              eyebrow="Flash Deals" title={mktData.flashSales.length > 0 ? `Offres du jour · ${mktData.flashSales.length} flash sale${mktData.flashSales.length > 1 ? 's' : ''} active${mktData.flashSales.length > 1 ? 's' : ''}` : 'Offres du jour'}
              onAction={() => navigate('/best-deals')}
              right={
                <Flex align="center" gap={2} rounded="md" px={3} py={1.5}
                  style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}` }}>
                  <Box w={2} h={2} rounded="full" style={{ background: C.amber }}
                    sx={{ '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animation: 'pulse 1.5s ease infinite' }} />
                  <Text fontSize="sm" fontWeight="800" fontFamily="mono" style={{ color: '#92400e' }}>
                    {countdown.h}:{countdown.m}:{countdown.s}
                  </Text>
                </Flex>
              }
            />
            <Carousel scrollRef={promoCarousel.ref} onScroll={promoCarousel.scroll}>
              {loadingPromo
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                      style={{ border: `1px solid ${C.border}` }}>
                      <Skeleton h="155px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                    </Box>
                  ))
                : promos.map((p) => <ProductCard key={p.id} product={p} />)}
            </Carousel>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PRODUITS SPONSORISÉS
      ══════════════════════════════════════════════════════════════ */}
      {(loadingSponsored || sponsored.length > 0) && (
        <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
          <Container>
            <SectionHead
              eyebrow="Mis en avant" title="Sélection partenaires"
              onAction={() => navigate('/catalog?sponsored=true')}
              right={
                <Box rounded="sm" px={2.5} py={1}
                  style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}` }}>
                  <Text fontSize="9px" fontWeight="800" letterSpacing="1px"
                    textTransform="uppercase" style={{ color: '#92400e' }}>SPONSORISÉ</Text>
                </Box>
              }
            />
            <Carousel scrollRef={sponsoredCarousel.ref} onScroll={sponsoredCarousel.scroll}>
              {loadingSponsored
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                      style={{ border: `1px solid ${C.border}` }}>
                      <Skeleton h="155px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                    </Box>
                  ))
                : sponsored.map((p) => <ProductCard key={p.id} product={p} />)}
            </Carousel>
          </Container>
        </Box>
      )}

      <RecommandePourVous products={topRated.slice(0, 8)} />

      {/* ══════════════════════════════════════════════════════════════
          DÉSTOCKAGE — produits à écouler rapidement
      ══════════════════════════════════════════════════════════════ */}
      {(loadingDestock || destocking.length > 0) && (
        <Box pt={8} pb={6} style={{ background: '#fff8f8', borderBottom: `8px solid ${C.bgAlt}` }}>
          <Container>
            {/* Header spécial déstockage */}
            <Flex align="center" justify="space-between" mb={6}>
              <Box style={{ borderLeft: `3px solid ${C.red}`, paddingLeft: '14px' }}>
                <Text fontSize="10px" fontWeight="800" letterSpacing="2px"
                  textTransform="uppercase" mb={0.5} style={{ color: C.red }}>
                  Déstockage
                </Text>
                <Heading size="md" fontWeight="800" style={{ color: C.navy }}>
                  Stocks à écouler
                </Heading>
              </Box>
              <HStack spacing={3}>
                {/* Stock urgency label */}
                <Box rounded="md" px={3} py={1.5}
                  style={{ background: C.redLight, border: `1px solid ${C.redBorder}` }}>
                  <Text fontSize="xs" fontWeight="700" style={{ color: C.red }}>
                    Quantités limitées
                  </Text>
                </Box>
                <Button variant="ghost" size="sm" fontWeight="600" fontSize="sm"
                  color={C.slate} _hover={{ color: C.red, bg: 'transparent' }}
                  rightIcon={<ChevronRight size={13} />}
                  onClick={() => navigate('/best-deals')}>
                  Voir tout
                </Button>
              </HStack>
            </Flex>

            <Carousel scrollRef={destockCarousel.ref} onScroll={destockCarousel.scroll}>
              {loadingDestock
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Box key={i} flexShrink={0} w="205px" rounded="lg" overflow="hidden"
                      style={{ border: `1px solid ${C.border}` }}>
                      <Skeleton h="158px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                    </Box>
                  ))
                : destocking.map((p) => <DestockCard key={p.id} product={p} />)}
            </Carousel>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          LIQUIDATION & ENCHÈRES — lots marketing live
      ══════════════════════════════════════════════════════════════ */}
      {mktData.activeLots.length > 0 && (
        <LiquidationLotsSection lots={mktData.activeLots} />
      )}

      {/* ══════════════════════════════════════════════════════════════
          EDITORIAL BANNERS
      ══════════════════════════════════════════════════════════════ */}
      {banners.length > 0 && (
      <Box py={7} style={{ background: C.bgAlt, borderBottom: `8px solid ${C.bgAlt}` }}>
        <Container>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {banners.map(({ id, label, sub, image, tag, tagColor, href }) => (
              <Box key={id} rounded="lg" overflow="hidden" position="relative"
                cursor="pointer" onClick={() => navigate(href)}
                _hover={{ transform: 'translateY(-4px)', shadow: 'xl' }} transition="all 0.25s ease"
                minH={{ base: '210px', md: '240px' }}
                style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <Box position="absolute" inset={0} style={{ background: BANNER_OVERLAY }} />
                <Flex p={6} flexDirection="column" justify="flex-end"
                  h="full" minH={{ base: '210px', md: '240px' }} position="relative">
                  <Box mb={3} alignSelf="flex-start">
                    <Box px={2.5} py={1} rounded="sm"
                      style={{ background: `${tagColor}22`, border: `1px solid ${tagColor}66` }}>
                      <Text fontSize="9px" fontWeight="800" letterSpacing="1.5px"
                        textTransform="uppercase" style={{ color: tagColor }}>{tag}</Text>
                    </Box>
                  </Box>
                  <Text fontWeight="900" color="white" fontSize="xl" mb={1.5} lineHeight={1.15}>{label}</Text>
                  <Text fontSize="xs" mb={5} style={{ color: 'rgba(226,232,240,0.78)' }}>{sub}</Text>
                  <Box alignSelf="flex-start">
                    <Box px={4} py={2} rounded="md"
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}
                      _hover={{ background: 'rgba(255,255,255,0.2)' }} transition="background 0.15s">
                      <Text fontSize="xs" fontWeight="700" color="white">Voir le catalogue</Text>
                    </Box>
                  </Box>
                </Flex>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      </Box>
      )}

      <DealOfDayBlock campaign={mktData.dealOfDay} product={dealProduct} />

      {/* ══════════════════════════════════════════════════════════════
          FEATURED PRODUCTS
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
        <Container>
          <SectionHead title="Produits populaires" onAction={() => navigate('/catalog')} />
          <Carousel scrollRef={featCarousel.ref} onScroll={featCarousel.scroll}>
            {loadingFeat
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                    style={{ border: `1px solid ${C.border}` }}>
                    <Skeleton h="155px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                  </Box>
                ))
              : featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </Carousel>
        </Container>
      </Box>

      <DynamicCategoryRows campaigns={mktData.categoryRows} />

      {/* ══════════════════════════════════════════════════════════════
          SEGMENTS THERMIQUES — Ambiant / Réfrigéré / Surgelé
      ══════════════════════════════════════════════════════════════ */}
      <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
        <Container>
          <SectionHead
            eyebrow="Catalogue par zone" title="Segments thermiques"
            onAction={() => navigate('/catalog')}
          />
          {/* Tab selector */}
          <HStack spacing={2} mb={6} flexWrap="wrap">
            {([
              { key: 'ambient',      label: 'Ambiant',    color: C.amber,   bg: C.amberLight,  bdr: C.amberBorder, dot: '#f59e0b' },
              { key: 'refrigerated', label: 'Réfrigéré',  color: '#0369a1', bg: '#f0f9ff',     bdr: '#7dd3fc',     dot: '#38bdf8' },
              { key: 'frozen',       label: 'Surgelé',    color: '#155e75', bg: '#ecfeff',     bdr: '#67e8f9',     dot: '#22d3ee' },
            ] as const).map(({ key, label, color, bg, bdr, dot }) => {
              const active = tempTab === key;
              return (
                <Box key={key} px={5} py={2} rounded="full" cursor="pointer"
                  style={{
                    background: active ? color : bg,
                    border: `1.5px solid ${active ? color : bdr}`,
                    transition: 'all 0.18s',
                  }}
                  _hover={{ opacity: 0.85 }}
                  onClick={() => {
                    setTempTab(key);
                    if (tempCarousel.ref.current) tempCarousel.ref.current.scrollLeft = 0;
                  }}>
                  <HStack spacing={2}>
                    <Box w={2} h={2} rounded="full"
                      style={{ background: active ? 'rgba(255,255,255,0.85)' : dot }} />
                    <Text fontSize="sm" fontWeight="700"
                      style={{ color: active ? 'white' : color }}>
                      {label}
                    </Text>
                  </HStack>
                </Box>
              );
            })}
          </HStack>

          {/* Products carousel for active tab */}
          <Carousel scrollRef={tempCarousel.ref} onScroll={tempCarousel.scroll}>
            {loadingTemp || (tempProducts[tempTab] ?? []).length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                    style={{ border: `1px solid ${C.border}` }}>
                    <Skeleton h="155px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                  </Box>
                ))
              : (tempProducts[tempTab] ?? []).map((p) => <ProductCard key={p.id} product={p} />)}
          </Carousel>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          COMPARATEUR — widget interactif
      ══════════════════════════════════════════════════════════════ */}
      <Box py={8} style={{ background: C.navy, borderBottom: `8px solid ${C.bgAlt}` }}>
        {/* Top amber line */}
        <Box position="absolute" left={0} right={0}
          h="2px" style={{ background: `linear-gradient(to right, ${C.amber}, transparent 50%)` }}
          mt="-8px" />
        <Container>
          {compItems.length === 0 ? (
            /* — Empty state — feature presentation */
            <Flex direction={{ base: 'column', lg: 'row' }} gap={10} align="center">
              <Box flex={1}>
                <HStack spacing={3} mb={4}>
                  <Box w={6} h="2px" style={{ background: C.amber }} />
                  <Text fontSize="10px" fontWeight="800" letterSpacing="3px"
                    textTransform="uppercase" style={{ color: C.amber }}>
                    OUTIL COMPARATEUR
                  </Text>
                </HStack>
                <Heading color="white" fontWeight="900" size="lg" mb={3} lineHeight={1.15}>
                  Comparez jusqu'à 4 produits<br />côte à côte
                </Heading>
                <Text fontSize="sm" lineHeight={1.8} mb={6}
                  style={{ color: 'rgba(148,163,184,0.85)' }}>
                  Prix, MOQ, certifications, délai de livraison, pays d'origine —
                  prenez la meilleure décision d'achat en un coup d'œil.
                </Text>
                <HStack spacing={3} flexWrap="wrap">
                  <Button size="sm" rounded="md" fontWeight="700"
                    rightIcon={<ArrowRight size={14} />}
                    onClick={() => navigate('/catalog')}
                    style={{ background: C.amber, color: 'white' }}
                    _hover={{ opacity: 0.9 }}>
                    Ajouter des produits
                  </Button>
                  <Button size="sm" variant="outline" rounded="md" fontWeight="600"
                    color="white" borderColor="rgba(255,255,255,0.25)"
                    onClick={() => navigate('/compare')}
                    _hover={{ bg: 'rgba(255,255,255,0.07)' }}>
                    Voir le comparateur
                  </Button>
                </HStack>
              </Box>

              {/* 4 empty slots preview */}
              <Flex gap={3} flexShrink={0} flexWrap="wrap" justify={{ base: 'center', lg: 'flex-start' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Flex key={i} w="110px" h="130px" rounded="lg" flexDirection="column"
                    align="center" justify="center" gap={2} cursor="pointer"
                    onClick={() => navigate('/catalog')}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1.5px dashed rgba(255,255,255,0.18)`,
                    }}
                    _hover={{ background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(201,125,26,0.5)' }}
                    transition="all 0.18s">
                    <Box w={8} h={8} rounded="md"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      display="flex" alignItems="center" justifyContent="center">
                      <Text color="white" fontSize="xl" fontWeight="300" lineHeight={1}>+</Text>
                    </Box>
                    <Text fontSize="9px" fontWeight="600" letterSpacing="0.5px"
                      style={{ color: 'rgba(148,163,184,0.7)' }}>
                      PRODUIT {i + 1}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          ) : (
            /* — Active state — shows comparator items */
            <Box>
              <Flex justify="space-between" align="center" mb={6}>
                <Box>
                  <HStack spacing={3} mb={1.5}>
                    <Box w={6} h="2px" style={{ background: C.amber }} />
                    <Text fontSize="10px" fontWeight="800" letterSpacing="3px"
                      textTransform="uppercase" style={{ color: C.amber }}>
                      COMPARATEUR ACTIF
                    </Text>
                  </HStack>
                  <Heading color="white" fontWeight="900" size="md">
                    {compItems.length} produit{compItems.length > 1 ? 's' : ''} à comparer
                  </Heading>
                </Box>
                <HStack spacing={2}>
                  <Button size="sm" variant="ghost" color="gray.400" rounded="md"
                    leftIcon={<X size={13} />} onClick={clearComp}
                    _hover={{ color: 'white', bg: 'rgba(255,255,255,0.07)' }}>
                    Vider
                  </Button>
                  <Button size="sm" rounded="md" fontWeight="700"
                    leftIcon={<Scale size={14} />}
                    onClick={() => navigate('/compare')}
                    style={{ background: C.amber, color: 'white' }}
                    _hover={{ opacity: 0.9 }}>
                    Comparer maintenant
                  </Button>
                </HStack>
              </Flex>

              <Flex gap={3} flexWrap="wrap">
                {/* Filled slots */}
                {compItems.map((p) => (
                  <CompareSlot key={p.id} product={p} />
                ))}
                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 4 - compItems.length) }).map((_, i) => (
                  <Flex key={i} w={{ base: '110px', md: '130px' }} h="150px" rounded="lg"
                    flexDirection="column" align="center" justify="center" gap={2}
                    cursor="pointer" onClick={() => navigate('/catalog')}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1.5px dashed rgba(255,255,255,0.15)',
                    }}
                    _hover={{ background: 'rgba(255,255,255,0.08)' }} transition="all 0.18s">
                    <Box w={8} h={8} rounded="md"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                      display="flex" alignItems="center" justifyContent="center">
                      <Text color="white" fontSize="xl" fontWeight="300" lineHeight={1}>+</Text>
                    </Box>
                    <Text fontSize="9px" style={{ color: 'rgba(148,163,184,0.6)' }} fontWeight="600">
                      Ajouter
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Box>
          )}
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          CATEGORY IMAGE GRID
      ══════════════════════════════════════════════════════════════ */}
      {roots.length > 0 && (
        <Box py={8} style={{ background: C.bgAlt, borderBottom: `8px solid ${C.bgAlt}` }}>
          <Container>
            <SectionHead title="Acheter par catégorie"
              onAction={openCat} actionLabel="Toutes les catégories" />
            <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={3}>
              {roots.slice(0, 10).map((cat, i) => {
                const { bg: tileBg } = PILL_COLORS[i % PILL_COLORS.length];
                return (
                  <Box key={cat.id} rounded="lg" overflow="hidden" position="relative"
                    cursor="pointer" onClick={() => navigate(`/catalog?category=${cat.id}`)}
                    h={{ base: '112px', md: '132px' }}
                    style={{ border: `1px solid ${C.border}` }}
                    _hover={{ transform: 'scale(1.025)', shadow: 'md', borderColor: C.amberBorder }}
                    transition="all 0.22s">
                    {cat.image_url
                      ? <Image src={cat.image_url} alt={cat.name} w="full" h="full" objectFit="cover" />
                      : <Box w="full" h="full" style={{ background: tileBg }} />}
                    <Box position="absolute" inset={0}
                      style={{ background: 'linear-gradient(to top, rgba(13,31,56,0.75) 0%, transparent 55%)' }} />
                    <Text position="absolute" bottom={3} left={3} right={3}
                      color="white" fontWeight="700" fontSize="sm" noOfLines={1}>
                      {cat.name}
                    </Text>
                  </Box>
                );
              })}
            </SimpleGrid>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TOP NOTÉS — Produits mieux évalués (≥ 4 étoiles)
      ══════════════════════════════════════════════════════════════ */}
      {(loadingTopRated || topRated.length > 0) && (
        <Box bg="white" pt={8} pb={6} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
          <Container>
            <SectionHead
              eyebrow="Qualité garantie" title="Mieux évalués par les acheteurs"
              onAction={() => navigate('/catalog?sort=rating')}
              right={
                <HStack spacing={0.5}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} fill="#F59E0B" color="#F59E0B" />
                  ))}
                  <Text fontSize="xs" fontWeight="700" ml={1.5} style={{ color: C.muted }}>
                    4.0+
                  </Text>
                </HStack>
              }
            />
            <Carousel scrollRef={topRatedCarousel.ref} onScroll={topRatedCarousel.scroll}>
              {loadingTopRated
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                      style={{ border: `1px solid ${C.border}` }}>
                      <Skeleton h="155px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                    </Box>
                  ))
                : topRated.map((p) => <ProductCard key={p.id} product={p} />)}
            </Carousel>
          </Container>
        </Box>
      )}

      <RFQBoostBlock rfqPosts={mktData.boostedRFQs} />

      {/* ══════════════════════════════════════════════════════════════
          BRAND STRIP
      ══════════════════════════════════════════════════════════════ */}
      {brands.length > 0 && (
        <Box bg="white" py={7} style={{ borderBottom: `8px solid ${C.bgAlt}` }}>
          <Container>
            <SectionHead title="Nos marques partenaires" onAction={() => navigate('/brands')} />
            <Box display="flex" gap={3} overflowX="auto" pb={1}
              style={{ scrollbarWidth: 'none' }}
              sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
              {brands.map((b) => <BrandCard key={b.id} brand={b} onClick={() => navigate(`/brands/${b.id}`)} />)}
            </Box>
          </Container>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════
          NEW ARRIVALS
      ══════════════════════════════════════════════════════════════ */}
      <Box pt={8} pb={6} style={{ background: C.bgAlt, borderBottom: `8px solid ${C.bgAlt}` }}>
        <Container>
          <SectionHead eyebrow="Nouveautés" title="Dernières références"
            onAction={() => navigate('/catalog?sort=new')} />
          <Carousel scrollRef={newCarousel.ref} onScroll={newCarousel.scroll}>
            {loadingNew
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Box key={i} flexShrink={0} w="192px" rounded="lg" overflow="hidden"
                    style={{ border: `1px solid ${C.border}` }}>
                    <Skeleton h="155px" /><Box p={3}><Skeleton noOfLines={3} spacing={2} /></Box>
                  </Box>
                ))
              : (newArrivals.length > 0 ? newArrivals : featured).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
          </Carousel>
        </Container>
      </Box>

      <FooterBannerBlock campaigns={mktData.footerBanners} />

      {/* ══════════════════════════════════════════════════════════════
          VENDOR CTA
      ══════════════════════════════════════════════════════════════ */}
      <Box py={16} position="relative" overflow="hidden" style={{ background: C.navy }}>
        <Box position="absolute" top={0} left={0} right={0} h="3px"
          style={{ background: `linear-gradient(to right, ${C.amber}, transparent 60%)` }} />
        <Container>
          <Flex direction={{ base: 'column', md: 'row' }}
            align={{ base: 'start', md: 'center' }} justify="space-between" gap={10}>
            <Box maxW="540px">
              <HStack spacing={3} mb={4} align="center">
                <Box w={6} h="2px" style={{ background: C.amber }} />
                <Text fontSize="10px" fontWeight="800" letterSpacing="3px"
                  textTransform="uppercase" style={{ color: C.amber }}>
                  POUR LES VENDEURS &amp; LIVREURS
                </Text>
              </HStack>
              <Heading color="white" size="xl" fontWeight="900" lineHeight={1.1} mb={4}>
                Développez votre activité<br />en Europe &amp; Afrique
              </Heading>
              <Text fontSize="sm" lineHeight={1.85} mb={7}
                style={{ color: 'rgba(148,163,184,0.85)' }}>
                Rejoignez {fmtStat(platformCounts.vendors, '500+')} vendeurs FMCG vérifiés. Accédez à des milliers d'acheteurs
                professionnels qualifiés en France, au Maghreb et dans toute l'Afrique subsaharienne.
              </Text>
              <Flex align="center" gap={0} flexWrap="wrap">
                {[
                  { v: fmtStat(platformCounts.vendors, '500+'), l: 'Vendeurs actifs' },
                  { v: '30+',                                   l: 'Pays couverts' },
                  { v: '0€',                                    l: 'Inscription' },
                ].map(({ v, l }, i) => (
                  <Flex key={l} align="center">
                    {i > 0 && <Box w="1px" h="32px" mx={6} flexShrink={0}
                      style={{ background: 'rgba(255,255,255,0.1)' }} />}
                    <Box>
                      <Text fontWeight="900" fontSize="lg" color="white" lineHeight={1}>{v}</Text>
                      <Text fontSize="9px" fontWeight="500" mt={0.5}
                        style={{ color: 'rgba(100,116,139,0.9)' }}>{l}</Text>
                    </Box>
                  </Flex>
                ))}
              </Flex>
            </Box>
            <VStack spacing={3} flexShrink={0} w={{ base: 'full', md: 'auto' }}>
              <Button size="lg" rounded="md" fontWeight="700" w={{ base: 'full', md: 'auto' }}
                minW="230px" rightIcon={<ArrowRight size={16} />} onClick={() => navigate('/auth')}
                style={{ background: C.amber, color: 'white', boxShadow: '0 8px 28px rgba(201,125,26,0.4)' }}
                _hover={{ opacity: 0.9, transform: 'translateY(-2px)' }} transition="all 0.18s">
                Devenir vendeur — Gratuit
              </Button>
            </VStack>
          </Flex>
        </Container>
      </Box>

      {/* Mobile KPIs */}
      <Box bg="white" py={6} display={{ base: 'block', lg: 'none' }}>
        <Container>
          <SimpleGrid columns={2} spacing={3}>
            {[
              { v: fmtStat(platformCounts.products, '10 000+'), l: 'Produits',          accent: C.amber },
              { v: fmtStat(platformCounts.vendors, '500+'),     l: 'Vendeurs vérifiés', accent: C.navy  },
              { v: fmtStat(platformCounts.delivery, '200+'),    l: 'Livreurs',          accent: C.green },
              { v: '30+',                                        l: 'Pays couverts',     accent: C.amber },
            ].map(({ v, l, accent }) => (
              <Box key={l} rounded="lg" p={5} textAlign="center"
                style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}>
                <Box w={8} h="2px" mx="auto" mb={3} rounded="full" style={{ background: accent }} />
                <Text fontWeight="900" fontSize="2xl" lineHeight={1} mb={1} style={{ color: C.navy }}>{v}</Text>
                <Text fontSize="10px" fontWeight="500" style={{ color: C.muted }}>{l}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      <AllCategoriesModal isOpen={isCatOpen} onClose={closeCat} roots={roots} subCategories={subCategories} />
    </Box>
  );
}

// ── Compare slot (mini card in comparator widget) ─────────────────────────────
function CompareSlot({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { removeItem } = useComparator();
  const tiers = product.price_tiers?.sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const first = tiers[0];

  return (
    <Box w={{ base: '110px', md: '130px' }} rounded="lg" overflow="hidden" position="relative"
      cursor="pointer" role="group"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
      _hover={{ background: 'rgba(255,255,255,0.12)', borderColor: C.amberBorder }}
      transition="all 0.18s"
      onClick={() => navigate(`/product/${product.id}`)}>

      {/* Remove button */}
      <Box position="absolute" top={1.5} right={1.5} zIndex={2}
        opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s">
        <Box w={5} h={5} rounded="full" cursor="pointer"
          display="flex" alignItems="center" justifyContent="center"
          style={{ background: 'rgba(190,28,28,0.85)' }}
          onClick={(e) => { e.stopPropagation(); removeItem(product.id); }}>
          <X size={10} color="white" />
        </Box>
      </Box>

      <Box h="80px" overflow="hidden" style={{ background: C.navyMid }}>
        {product.images?.[0]
          ? <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover" />
          : <Flex w="full" h="full" align="center" justify="center">
              <Text fontWeight="900" fontSize="2xl" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {product.name.charAt(0).toUpperCase()}
              </Text>
            </Flex>}
      </Box>
      <Box p={2.5}>
        <Text fontSize="9px" fontWeight="700" noOfLines={2} lineHeight={1.3} color="white" mb={1}>
          {product.name}
        </Text>
        {first && (
          <Text fontSize="10px" fontWeight="800" style={{ color: C.amber }}>
            {first.unit_price.toFixed(2)} {product.currency}
          </Text>
        )}
      </Box>
    </Box>
  );
}
