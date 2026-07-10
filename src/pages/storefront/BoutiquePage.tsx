import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid, Image,
  Button, Skeleton, SkeletonText, Badge, Wrap, WrapItem, Tag,
  TagLabel, Divider, Avatar, Tabs, TabList, Tab, TabPanels,
  TabPanel, Progress, Tooltip, IconButton,
} from '@chakra-ui/react';
import {
  ArrowLeft, Store, MapPin, Calendar, ShieldCheck, Package,
  Truck, Star, Award, CreditCard, Clock, Globe, BarChart3,
  CheckCircle, ChevronRight, Lock, ShoppingCart,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Organisation, Product, Brand, Category } from '../../types';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SellerProfile {
  certifications: string[];
  accepted_payment_terms: string[];
  default_prep_days: number;
  avg_rating: number;
  review_count: number;
  description: string | null;
  website: string | null;
  default_moq: number | null;
  default_franco_eur: number | null;
  default_delivery_methods: string[];
  default_incoterms: string[];
  default_export_countries: string[];
}

interface VendorReview {
  id: string;
  rating_global: number;
  rating_service: number | null;
  rating_conformity: number | null;
  comment: string | null;
  created_at: string;
  buyer_org_id: string;
  organisations?: { name: string } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const PAYMENT_LABELS: Record<string, string> = {
  prepayment: 'Prépaiement', '30_days': '30 jours', '45_days': '45 jours',
  '60_days': '60 jours', '90_days': '90 jours', cheque: 'Chèque',
  wire: 'Virement', paypal: 'PayPal',
};

const DELIVERY_LABELS: Record<string, string> = {
  express: 'Express', standard: 'Standard', pallet: 'Palette',
  cold: 'Chaîne du froid', bulk: 'Vrac', pickup: 'Retrait', freight: 'Transport de fret',
};

const CERT_COLORS: Record<string, string> = {
  bio: 'green', halal: 'teal', haccp: 'blue', ifs: 'purple',
  brc: 'purple', iso: 'cyan', organic: 'green', fairtrade: 'orange',
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <HStack spacing={0.5}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={i} color={i < Math.round(rating) ? '#D97706' : 'gray.200'}>
          <Star size={size} fill={i < Math.round(rating) ? '#D97706' : 'transparent'} />
        </Box>
      ))}
    </HStack>
  );
}

// ─── Carte produit compacte ────────────────────────────────────────────────────
function ProductCard({ p }: { p: Product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const best = p.price_tiers?.sort((a, b) => a.qty_min - b.qty_min)[0];
  return (
    <Box
      bg="white" border="1px solid" borderColor="gray.200" rounded="xl"
      overflow="hidden" cursor="pointer"
      _hover={{ borderColor: 'blue.300', boxShadow: '0 4px 16px rgba(37,99,235,0.08)', transform: 'translateY(-2px)' }}
      transition="all 0.18s"
      onClick={() => navigate(`/product/${p.id}`)}
    >
      <Box h="130px" bg="gray.50" overflow="hidden">
        {p.images?.[0]
          ? <Image src={p.images[0]} alt={p.name} w="full" h="full" objectFit="cover" loading="lazy" />
          : <Flex w="full" h="full" align="center" justify="center"><Package size={26} color="var(--chakra-colors-gray-300)" /></Flex>
        }
      </Box>
      <Box p={3}>
        <Text fontSize="xs" color="gray.400" noOfLines={1} mb={0.5}>{p.brands?.name ?? p.categories?.name ?? '—'}</Text>
        <Text fontWeight="600" color="gray.800" fontSize="sm" noOfLines={2} lineHeight={1.3} mb={2}>{p.name}</Text>
        <Flex justify="space-between" align="center">
          {user
            ? best
              ? <Text fontWeight="700" color="blue.800" fontSize="sm" fontFamily="mono">{best.unit_price.toFixed(2)} {p.currency}</Text>
              : <Text fontSize="xs" color="gray.400" fontStyle="italic">Sur devis</Text>
            : <HStack spacing={1} cursor="pointer" onClick={e => { e.stopPropagation(); navigate('/auth'); }}>
                <Lock size={10} color="var(--chakra-colors-gray-400)" />
                <Text fontSize="10px" color="blue.600" fontWeight="500">Accéder aux tarifs</Text>
              </HStack>
          }
          <Tooltip label="Commander" placement="top" hasArrow>
            <IconButton
              aria-label="Commander" icon={user ? <ShoppingCart size={13} /> : <Lock size={13} />}
              size="xs" colorScheme={user ? 'blue' : 'gray'} variant={user ? 'solid' : 'outline'}
              rounded="md" isDisabled={!user} bg={user ? 'blue.800' : undefined}
              _hover={user ? { bg: 'blue.700' } : undefined}
              onClick={e => e.stopPropagation()}
            />
          </Tooltip>
        </Flex>
      </Box>
    </Box>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────
export default function BoutiquePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organisation | null>(null);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('organisations').select('*').eq('id', id).maybeSingle(),
      supabase.from('seller_profiles').select('certifications,accepted_payment_terms,default_prep_days,avg_rating,review_count,description,website,default_moq,default_franco_eur,default_delivery_methods,default_incoterms,default_export_countries').eq('organisation_id', id).maybeSingle(),
      supabase.from('products').select('*, brands(id,name,logo_url), categories(id,name), price_tiers(*)').eq('seller_org_id', id).eq('status', 'active').order('is_sponsored', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('vendor_reviews').select('*, organisations!buyer_org_id(name)').eq('seller_org_id', id).order('created_at', { ascending: false }).limit(20),
    ]).then(([orgRes, profRes, prodRes, revRes]) => {
      setOrg(orgRes.data as Organisation | null);
      setProfile(profRes.data as SellerProfile | null);
      setProducts((prodRes.data ?? []) as Product[]);
      setReviews((revRes.data ?? []) as VendorReview[]);
      setLoading(false);
    });
  }, [id]);

  // Données dérivées des produits
  const brands = useMemo(() => {
    const map = new Map<string, Brand>();
    products.forEach(p => { if (p.brands?.id) map.set(p.brands.id, p.brands as Brand); });
    return Array.from(map.values());
  }, [products]);

  const categories = useMemo(() => {
    const map = new Map<string, Category>();
    products.forEach(p => { if (p.categories?.id) map.set(p.categories.id, p.categories as Category); });
    return Array.from(map.values());
  }, [products]);

  // Livraison : profil vendeur en priorité, sinon dérivé des produits
  const deliveryMethods = useMemo(() => {
    const fromProfile = profile?.default_delivery_methods ?? [];
    if (fromProfile.length > 0) return fromProfile;
    return [...new Set(products.flatMap(p => p.delivery_methods ?? []))];
  }, [profile, products]);

  const incoterms = useMemo(() => {
    const fromProfile = profile?.default_incoterms ?? [];
    if (fromProfile.length > 0) return fromProfile;
    return [...new Set(products.flatMap(p => p.incoterms ?? []))];
  }, [profile, products]);

  const exportCountries = useMemo(() => {
    const fromProfile = profile?.default_export_countries ?? [];
    if (fromProfile.length > 0) return fromProfile;
    return [...new Set(products.flatMap(p => p.export_countries ?? []))].filter(Boolean);
  }, [profile, products]);

  const filteredProducts = useMemo(() =>
    activeCategory === 'all' ? products : products.filter(p => p.categories?.id === activeCategory),
    [products, activeCategory]);

  const avgGlobal = reviews.length
    ? reviews.reduce((s, r) => s + r.rating_global, 0) / reviews.length : 0;
  const avgService = reviews.filter(r => r.rating_service).length
    ? reviews.filter(r => r.rating_service).reduce((s, r) => s + (r.rating_service ?? 0), 0) / reviews.filter(r => r.rating_service).length : 0;
  const avgConformity = reviews.filter(r => r.rating_conformity).length
    ? reviews.filter(r => r.rating_conformity).reduce((s, r) => s + (r.rating_conformity ?? 0), 0) / reviews.filter(r => r.rating_conformity).length : 0;

  // ── Chargement ──
  if (loading) return (
    <VStack spacing={5} align="stretch">
      <Skeleton h="180px" rounded="2xl" />
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h="100px" rounded="xl" />)}
      </SimpleGrid>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} rounded="xl" overflow="hidden" border="1px solid" borderColor="gray.200">
            <Skeleton h="130px" />
            <Box p={3}><SkeletonText noOfLines={3} spacing={2} /></Box>
          </Box>
        ))}
      </SimpleGrid>
    </VStack>
  );

  // ── Not found ──
  if (!org) return (
    <Flex direction="column" align="center" justify="center" minH="60vh" gap={4}>
      <Flex w={14} h={14} bg="gray.50" border="1px solid" borderColor="gray.200" rounded="xl" align="center" justify="center">
        <Store size={26} color="var(--chakra-colors-gray-300)" />
      </Flex>
      <Box textAlign="center">
        <Heading size="sm" color="gray.700" fontWeight="700" mb={1}>Boutique introuvable</Heading>
        <Text fontSize="sm" color="gray.400">Cette boutique n'existe pas ou n'est plus active.</Text>
      </Box>
      <Button onClick={() => navigate('/boutiques')} leftIcon={<ArrowLeft size={14} />}
        size="sm" colorScheme="blue" rounded="xl" bg="blue.800" _hover={{ bg: 'blue.700' }}>
        Toutes les boutiques
      </Button>
    </Flex>
  );

  return (
    <VStack spacing={5} align="stretch">
      {/* ── Bouton retour ── */}
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={13} />}
        onClick={() => navigate('/boutiques')} color="gray.500" alignSelf="flex-start">
        Toutes les boutiques
      </Button>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Identité du vendeur
      ══════════════════════════════════════════════════════════════════ */}
      <Box
        bg="white" rounded="2xl" overflow="hidden"
        border="1px solid" borderColor="gray.200"
        boxShadow="0 2px 12px rgba(0,0,0,0.05)"
      >
        {/* Bandeau couleur */}
        <Box h="80px" bgGradient="linear(135deg, blue.800 0%, blue.600 60%, blue.400 100%)" />

        <Box px={{ base: 4, md: 6 }} pb={5}>
          <Flex align="flex-end" gap={4} mt="-36px" mb={4} flexWrap="wrap">
            {/* Avatar boutique */}
            <Box
              w="72px" h="72px" rounded="xl" overflow="hidden"
              bg="white" border="3px solid white"
              boxShadow="0 2px 12px rgba(0,0,0,0.12)" flexShrink={0}
              display="flex" alignItems="center" justifyContent="center"
            >
              <Store size={30} color="var(--chakra-colors-blue-500)" />
            </Box>

            {/* Infos principales */}
            <Box flex={1} pt={2}>
              <HStack spacing={2} flexWrap="wrap">
                <Heading size="md" color="gray.900" fontWeight="800" letterSpacing="-0.02em">
                  {org.name}
                </Heading>
                {org.validation_status === 'active' && (
                  <Tooltip label="Vendeur certifié Stock212" hasArrow>
                    <Box color="blue.500"><CheckCircle size={18} /></Box>
                  </Tooltip>
                )}
                <Badge
                  colorScheme={org.validation_status === 'active' ? 'green' : 'yellow'}
                  rounded="full" fontSize="9px" px={2} fontWeight="700"
                >
                  {org.validation_status === 'active' ? 'Certifié' : 'En cours de validation'}
                </Badge>
                {org.sub_type && (
                  <Badge colorScheme="blue" rounded="full" fontSize="9px" px={2} variant="subtle">
                    {org.sub_type}
                  </Badge>
                )}
              </HStack>

              <HStack spacing={4} mt={1.5} flexWrap="wrap">
                {(org.city || org.country) && (
                  <HStack spacing={1} color="gray.400">
                    <MapPin size={12} />
                    <Text fontSize="xs">{[org.city, org.country].filter(Boolean).join(', ')}</Text>
                  </HStack>
                )}
                <HStack spacing={1} color="gray.400">
                  <Calendar size={12} />
                  <Text fontSize="xs">Membre depuis {new Date(org.created_at).getFullYear()}</Text>
                </HStack>
                <HStack spacing={1} color="gray.400">
                  <Package size={12} />
                  <Text fontSize="xs">{products.length} référence{products.length !== 1 ? 's' : ''}</Text>
                </HStack>
                {profile?.website && (
                  <HStack spacing={1} color="blue.500" cursor="pointer"
                    as="a" href={profile.website} target="_blank" rel="noopener noreferrer">
                    <Globe size={12} />
                    <Text fontSize="xs" textDecoration="underline">
                      {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </Text>
                  </HStack>
                )}
              </HStack>

              {/* Description */}
              {profile?.description && (
                <Text fontSize="xs" color="gray.500" mt={2} lineHeight={1.7} maxW="480px">
                  {profile.description}
                </Text>
              )}
            </Box>

            {/* Note & CTA */}
            <VStack align={{ base: 'flex-start', md: 'flex-end' }} spacing={2} flexShrink={0}>
              {(profile?.avg_rating ?? 0) > 0 && (
                <HStack spacing={2}>
                  <Stars rating={profile?.avg_rating ?? 0} size={13} />
                  <Text fontSize="sm" fontWeight="700" color="gray.700">{(profile?.avg_rating ?? 0).toFixed(1)}</Text>
                  <Text fontSize="xs" color="gray.400">({profile?.review_count} avis)</Text>
                </HStack>
              )}
              <Button
                colorScheme="blue" rounded="xl" size="sm" fontWeight="700"
                rightIcon={<ChevronRight size={14} />}
                bgGradient="linear(to-r, blue.700, blue.500)"
                _hover={{ bgGradient: 'linear(to-r, blue.800, blue.600)', transform: 'translateY(-1px)' }}
                boxShadow="0 2px 10px rgba(37,99,235,0.30)"
                transition="all 0.15s"
                onClick={() => navigate(`/catalog?seller=${org.id}`)}
              >
                Voir le catalogue
              </Button>
            </VStack>
          </Flex>
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════
          ONGLETS
      ══════════════════════════════════════════════════════════════════ */}
      <Tabs colorScheme="blue" variant="enclosed" isLazy>
        <TabList bg="white" rounded="xl" border="1px solid" borderColor="gray.200" p={1} gap={1}>
          {[
            { label: 'Qualification',    icon: <ShieldCheck size={13} /> },
            { label: `Catalogue (${products.length})`, icon: <Package size={13} /> },
            { label: `Marques (${brands.length})`,     icon: <Award size={13} /> },
            { label: 'Livraison',        icon: <Truck size={13} /> },
            { label: `Avis (${reviews.length})`,       icon: <Star size={13} /> },
          ].map(({ label, icon }) => (
            <Tab
              key={label}
              fontSize="xs" fontWeight="600" rounded="lg" px={3} py={2}
              _selected={{ bg: 'blue.50', color: 'blue.700', borderColor: 'blue.200' }}
              color="gray.500" border="1px solid transparent"
            >
              <HStack spacing={1.5}>{icon}<Text>{label}</Text></HStack>
            </Tab>
          ))}
        </TabList>

        <TabPanels mt={0}>
          {/* ── Tab 1 : Qualification ── */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>

              {/* Certifications */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="green.50" display="flex" alignItems="center" justifyContent="center">
                    <Award size={14} color="var(--chakra-colors-green-600)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Certifications</Text>
                </HStack>
                {(profile?.certifications?.length ?? 0) > 0
                  ? <Wrap spacing={2}>
                      {profile!.certifications.map(c => (
                        <WrapItem key={c}>
                          <Tag
                            colorScheme={CERT_COLORS[c.toLowerCase()] ?? 'blue'}
                            rounded="lg" size="md" variant="subtle"
                          >
                            <HStack spacing={1.5} px={1}>
                              <CheckCircle size={10} />
                              <TagLabel fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.04em">
                                {c}
                              </TagLabel>
                            </HStack>
                          </Tag>
                        </WrapItem>
                      ))}
                    </Wrap>
                  : <Text fontSize="sm" color="gray.400">Aucune certification renseignée</Text>
                }
              </Box>

              {/* Conditions de paiement */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="blue.50" display="flex" alignItems="center" justifyContent="center">
                    <CreditCard size={14} color="var(--chakra-colors-blue-600)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Conditions de paiement</Text>
                </HStack>
                {(profile?.accepted_payment_terms?.length ?? 0) > 0
                  ? <Wrap spacing={2}>
                      {profile!.accepted_payment_terms.map(t => (
                        <WrapItem key={t}>
                          <Tag colorScheme="blue" rounded="lg" size="md" variant="subtle">
                            <TagLabel fontSize="xs" fontWeight="600">{PAYMENT_LABELS[t] ?? t}</TagLabel>
                          </Tag>
                        </WrapItem>
                      ))}
                    </Wrap>
                  : <Text fontSize="sm" color="gray.400">—</Text>
                }
              </Box>

              {/* Délai de préparation */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="orange.50" display="flex" alignItems="center" justifyContent="center">
                    <Clock size={14} color="var(--chakra-colors-orange-500)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Délai de préparation</Text>
                </HStack>
                <HStack spacing={2} align="baseline">
                  <Text fontSize="3xl" fontWeight="800" color="gray.900" fontFamily="mono" lineHeight="1">
                    {profile?.default_prep_days ?? '—'}
                  </Text>
                  <Text fontSize="sm" color="gray.400">jours ouvrés</Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" mt={1}>Délai moyen avant expédition</Text>
              </Box>

              {/* Implantation géographique */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="purple.50" display="flex" alignItems="center" justifyContent="center">
                    <MapPin size={14} color="var(--chakra-colors-purple-600)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Implantation</Text>
                </HStack>
                <VStack align="start" spacing={2}>
                  {[
                    { label: 'Pays', value: org.country || '—' },
                    { label: 'Ville', value: org.city || '—' },
                    { label: 'Région', value: org.region || '—' },
                    { label: 'Code postal', value: org.postal_code || '—' },
                  ].map(({ label, value }) => (
                    <Flex key={label} w="full" justify="space-between" align="center">
                      <Text fontSize="xs" color="gray.400">{label}</Text>
                      <Text fontSize="xs" fontWeight="600" color="gray.700">{value}</Text>
                    </Flex>
                  ))}
                </VStack>
              </Box>

              {/* Incoterms */}
              {incoterms.length > 0 && (
                <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                  <HStack spacing={2} mb={4}>
                    <Box w={7} h={7} rounded="lg" bg="cyan.50" display="flex" alignItems="center" justifyContent="center">
                      <Globe size={14} color="var(--chakra-colors-cyan-600)" />
                    </Box>
                    <Text fontSize="sm" fontWeight="700" color="gray.800">Incoterms</Text>
                  </HStack>
                  <Wrap spacing={2}>
                    {incoterms.map(t => (
                      <WrapItem key={t}>
                        <Tag colorScheme="cyan" rounded="lg" size="md" variant="subtle">
                          <TagLabel fontSize="xs" fontWeight="700" fontFamily="mono">{t}</TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              )}

              {/* Stats catalogue */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="blue.50" display="flex" alignItems="center" justifyContent="center">
                    <BarChart3 size={14} color="var(--chakra-colors-blue-600)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Chiffres clés</Text>
                </HStack>
                <SimpleGrid columns={2} spacing={4}>
                  {[
                    { label: 'Références actives', value: products.length },
                    { label: 'Marques distribuées', value: brands.length },
                    { label: 'Catégories', value: categories.length },
                    { label: 'Pays d\'export', value: exportCountries.length || '—' },
                  ].map(({ label, value }) => (
                    <Box key={label}>
                      <Text fontSize="2xl" fontWeight="800" color="blue.700" fontFamily="mono" lineHeight="1">{value}</Text>
                      <Text fontSize="10px" color="gray.400" mt={0.5}>{label}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            </SimpleGrid>
          </TabPanel>

          {/* ── Tab 2 : Catalogue ── */}
          <TabPanel px={0}>
            {/* Filtre par catégorie */}
            {categories.length > 0 && (
              <Flex gap={2} mb={4} overflowX="auto" pb={1}
                css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                <Button
                  size="xs" rounded="full" fontWeight="600" fontSize="xs"
                  colorScheme={activeCategory === 'all' ? 'blue' : 'gray'}
                  variant={activeCategory === 'all' ? 'solid' : 'outline'}
                  onClick={() => setActiveCategory('all')}
                  flexShrink={0}
                  bg={activeCategory === 'all' ? 'blue.700' : undefined}
                >
                  Tout ({products.length})
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat.id} size="xs" rounded="full" fontWeight="600" fontSize="xs"
                    colorScheme={activeCategory === cat.id ? 'blue' : 'gray'}
                    variant={activeCategory === cat.id ? 'solid' : 'outline'}
                    onClick={() => setActiveCategory(cat.id)}
                    flexShrink={0}
                    bg={activeCategory === cat.id ? 'blue.700' : undefined}
                  >
                    {cat.name} ({products.filter(p => p.categories?.id === cat.id).length})
                  </Button>
                ))}
              </Flex>
            )}

            {filteredProducts.length === 0
              ? <Flex align="center" justify="center" py={12} direction="column" gap={3}>
                  <Box w={12} h={12} bg="gray.50" border="1px solid" borderColor="gray.200" rounded="xl" display="flex" alignItems="center" justifyContent="center">
                    <Package size={22} color="var(--chakra-colors-gray-300)" />
                  </Box>
                  <Text fontSize="sm" color="gray.400">Aucun produit dans cette catégorie</Text>
                </Flex>
              : <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={3}>
                  {filteredProducts.map(p => <ProductCard key={p.id} p={p} />)}
                </SimpleGrid>
            }
          </TabPanel>

          {/* ── Tab 3 : Marques ── */}
          <TabPanel px={0}>
            {brands.length === 0
              ? <Flex align="center" justify="center" py={12} direction="column" gap={3}>
                  <Award size={24} color="var(--chakra-colors-gray-300)" />
                  <Text fontSize="sm" color="gray.400">Aucune marque identifiée</Text>
                </Flex>
              : <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={4}>
                  {brands.map(b => (
                    <Box
                      key={b.id} bg="white" border="1px solid" borderColor="gray.200" rounded="xl"
                      p={4} cursor="pointer"
                      _hover={{ borderColor: 'blue.300', boxShadow: '0 4px 14px rgba(37,99,235,0.08)', transform: 'translateY(-2px)' }}
                      transition="all 0.18s"
                      onClick={() => navigate(`/brands/${b.id}`)}
                    >
                      <Box
                        w="56px" h="56px" rounded="xl" overflow="hidden" bg="gray.50"
                        border="1px solid" borderColor="gray.100" mx="auto" mb={3}
                        display="flex" alignItems="center" justifyContent="center"
                      >
                        {b.logo_url
                          ? <Image src={b.logo_url} alt={b.name} w="full" h="full" objectFit="contain" p={1} />
                          : <Award size={22} color="var(--chakra-colors-gray-300)" />
                        }
                      </Box>
                      <Text fontSize="sm" fontWeight="700" color="gray.800" textAlign="center" noOfLines={1}>{b.name}</Text>
                      <Text fontSize="10px" color="gray.400" textAlign="center" mt={0.5}>
                        {products.filter(p => p.brands?.id === b.id).length} référence{products.filter(p => p.brands?.id === b.id).length > 1 ? 's' : ''}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
            }
          </TabPanel>

          {/* ── Tab 4 : Livraison ── */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>

              {/* Méthodes de livraison */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="teal.50" display="flex" alignItems="center" justifyContent="center">
                    <Truck size={14} color="var(--chakra-colors-teal-600)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Méthodes de livraison</Text>
                </HStack>
                {deliveryMethods.length > 0
                  ? <VStack align="stretch" spacing={2}>
                      {deliveryMethods.map(m => (
                        <HStack key={m} spacing={2} p={2} rounded="lg" bg="gray.50">
                          <CheckCircle size={14} color="var(--chakra-colors-teal-500)" />
                          <Text fontSize="sm" color="gray.700" fontWeight="500">{DELIVERY_LABELS[m] ?? m}</Text>
                        </HStack>
                      ))}
                    </VStack>
                  : <Text fontSize="sm" color="gray.400">Non renseigné</Text>
                }
              </Box>

              {/* Pays & régions d'export */}
              <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                <HStack spacing={2} mb={4}>
                  <Box w={7} h={7} rounded="lg" bg="blue.50" display="flex" alignItems="center" justifyContent="center">
                    <Globe size={14} color="var(--chakra-colors-blue-600)" />
                  </Box>
                  <Text fontSize="sm" fontWeight="700" color="gray.800">Zones d'expédition</Text>
                </HStack>
                {exportCountries.length > 0
                  ? <Wrap spacing={2}>
                      {exportCountries.map(c => (
                        <WrapItem key={c}>
                          <Tag colorScheme="blue" rounded="full" size="sm" variant="subtle">
                            <TagLabel fontSize="xs" fontWeight="600">{c}</TagLabel>
                          </Tag>
                        </WrapItem>
                      ))}
                    </Wrap>
                  : <VStack align="start" spacing={1}>
                      <Text fontSize="sm" color="gray.700" fontWeight="500">
                        {org.country ? `Expédition depuis ${org.country}` : 'Non renseigné'}
                      </Text>
                      <Text fontSize="xs" color="gray.400">Contactez le vendeur pour les zones couvertes</Text>
                    </VStack>
                }
              </Box>

              {/* Délai moyen */}
              {products.length > 0 && (
                <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                  <HStack spacing={2} mb={4}>
                    <Box w={7} h={7} rounded="lg" bg="orange.50" display="flex" alignItems="center" justifyContent="center">
                      <Clock size={14} color="var(--chakra-colors-orange-500)" />
                    </Box>
                    <Text fontSize="sm" fontWeight="700" color="gray.800">Délai d'expédition moyen</Text>
                  </HStack>
                  <HStack spacing={2} align="baseline">
                    <Text fontSize="3xl" fontWeight="800" color="gray.900" fontFamily="mono" lineHeight="1">
                      {Math.round(products.reduce((s, p) => s + (p.estimated_lead_days ?? 0), 0) / products.length)}
                    </Text>
                    <Text fontSize="sm" color="gray.400">jours ouvrés</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.400" mt={1}>Calculé sur {products.length} référence{products.length > 1 ? 's' : ''}</Text>
                </Box>
              )}

              {/* Incoterms */}
              {incoterms.length > 0 && (
                <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                  <HStack spacing={2} mb={4}>
                    <Box w={7} h={7} rounded="lg" bg="purple.50" display="flex" alignItems="center" justifyContent="center">
                      <Globe size={14} color="var(--chakra-colors-purple-600)" />
                    </Box>
                    <Text fontSize="sm" fontWeight="700" color="gray.800">Incoterms supportés</Text>
                  </HStack>
                  <Wrap spacing={2}>
                    {incoterms.map(t => (
                      <WrapItem key={t}>
                        <Tag colorScheme="purple" rounded="lg" size="md" variant="subtle">
                          <TagLabel fontSize="xs" fontWeight="700" fontFamily="mono">{t}</TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              )}
            </SimpleGrid>
          </TabPanel>

          {/* ── Tab 5 : Avis ── */}
          <TabPanel px={0}>
            {reviews.length === 0
              ? <Flex align="center" justify="center" py={12} direction="column" gap={3}>
                  <Star size={24} color="var(--chakra-colors-gray-300)" />
                  <Text fontSize="sm" color="gray.400">Aucun avis pour ce vendeur</Text>
                </Flex>
              : <VStack align="stretch" spacing={5}>

                  {/* Récapitulatif notes */}
                  <Box bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={5}>
                    <Flex gap={8} flexWrap="wrap" align="center">
                      {/* Note globale */}
                      <VStack spacing={1} flexShrink={0}>
                        <Text fontSize="4xl" fontWeight="900" color="gray.900" lineHeight="1" fontFamily="mono">
                          {avgGlobal.toFixed(1)}
                        </Text>
                        <Stars rating={avgGlobal} size={15} />
                        <Text fontSize="xs" color="gray.400">{reviews.length} avis</Text>
                      </VStack>

                      <Divider orientation="vertical" h="70px" display={{ base: 'none', md: 'block' }} />

                      {/* Sous-scores */}
                      <VStack align="stretch" flex={1} spacing={3} minW="200px">
                        {[
                          { label: 'Note globale', val: avgGlobal },
                          { label: 'Service client', val: avgService },
                          { label: 'Conformité produits', val: avgConformity },
                        ].map(({ label, val }) => (
                          <HStack key={label} spacing={3}>
                            <Text fontSize="xs" color="gray.500" w="130px" flexShrink={0}>{label}</Text>
                            <Progress
                              value={(val / 5) * 100} size="sm" colorScheme="yellow"
                              rounded="full" flex={1} bg="gray.100"
                            />
                            <Text fontSize="xs" fontWeight="700" color="gray.700" w="24px" textAlign="right">
                              {val > 0 ? val.toFixed(1) : '—'}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    </Flex>
                  </Box>

                  {/* Liste des avis */}
                  <VStack align="stretch" spacing={3}>
                    {reviews.map(r => (
                      <Box key={r.id} bg="white" border="1px solid" borderColor="gray.200" rounded="xl" p={4}>
                        <Flex justify="space-between" align="start" mb={2}>
                          <HStack spacing={3}>
                            <Avatar
                              size="sm" name={r.organisations?.name ?? 'Acheteur'}
                              bg="blue.100" color="blue.700" fontSize="xs"
                            />
                            <Box>
                              <Text fontSize="sm" fontWeight="600" color="gray.800">
                                {r.organisations?.name ?? 'Acheteur vérifié'}
                              </Text>
                              <Text fontSize="10px" color="gray.400">
                                {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </Text>
                            </Box>
                          </HStack>
                          <HStack spacing={1}>
                            <Stars rating={r.rating_global} size={12} />
                            <Text fontSize="xs" fontWeight="700" color="gray.600">{r.rating_global}/5</Text>
                          </HStack>
                        </Flex>

                        {r.comment && (
                          <Text fontSize="sm" color="gray.600" lineHeight={1.7} mt={2}>{r.comment}</Text>
                        )}

                        {(r.rating_service || r.rating_conformity) && (
                          <HStack spacing={4} mt={3} pt={3} borderTop="1px solid" borderColor="gray.100">
                            {r.rating_service && (
                              <HStack spacing={1}>
                                <Text fontSize="10px" color="gray.400">Service</Text>
                                <Stars rating={r.rating_service} size={10} />
                                <Text fontSize="10px" fontWeight="600" color="gray.600">{r.rating_service}/5</Text>
                              </HStack>
                            )}
                            {r.rating_conformity && (
                              <HStack spacing={1}>
                                <Text fontSize="10px" color="gray.400">Conformité</Text>
                                <Stars rating={r.rating_conformity} size={10} />
                                <Text fontSize="10px" fontWeight="600" color="gray.600">{r.rating_conformity}/5</Text>
                              </HStack>
                            )}
                          </HStack>
                        )}
                      </Box>
                    ))}
                  </VStack>
                </VStack>
            }
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}
