import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, HStack, VStack, Text, Badge, Image, Button,
  Skeleton, SkeletonText, SimpleGrid, Tag, TagLabel, Divider,
  IconButton,
} from '@chakra-ui/react';
import {
  Sparkles, ChevronLeft, ChevronRight, ExternalLink,
  Package, Store, Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Campaign } from '../../types/marketing';
import type { Product, Brand, Organisation } from '../../types';

// ─── Types locaux ──────────────────────────────────────────────────────────────
interface SponsoredProduct {
  campaign: Campaign;
  product: Product;
}

interface SponsoredBrand {
  campaign: Campaign;
  brand: Brand;
}

interface SponsoredBoutique {
  campaign: Campaign;
  org: Organisation;
}

interface AdsData {
  products: SponsoredProduct[];
  brands: SponsoredBrand[];
  boutiques: SponsoredBoutique[];
  loading: boolean;
}

// ─── Hook de données ───────────────────────────────────────────────────────────
function useComparatorAds(): AdsData {
  const [data, setData] = useState<AdsData>({ products: [], brands: [], boutiques: [], loading: true });

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .in('type', ['sponsored_product', 'sponsored_brand', 'sponsored_boutique'])
      .or(`end_date.gte.${today},end_date.is.null`)
      .limit(30)
      .then(async ({ data: camps }) => {
        const campaigns = (camps ?? []) as Campaign[];

        const productCamps = campaigns.filter(c => c.type === 'sponsored_product' && c.scope_value);
        const brandCamps   = campaigns.filter(c => c.type === 'sponsored_brand'   && c.scope_value);
        const boutCamps    = campaigns.filter(c => c.type === 'sponsored_boutique' && c.scope_value);

        const [prodRes, brandRes, boutRes] = await Promise.all([
          productCamps.length
            ? supabase.from('products')
                .select('*, organisations(id,name), brands(id,name,logo_url), price_tiers(*)')
                .in('id', productCamps.map(c => c.scope_value!))
                .eq('status', 'active')
            : { data: [] },
          brandCamps.length
            ? supabase.from('brands')
                .select('id, name, description, logo_url')
                .in('id', brandCamps.map(c => c.scope_value!))
            : { data: [] },
          boutCamps.length
            ? supabase.from('organisations')
                .select('id, name, org_type, country, city, postal_code, validation_status')
                .in('id', boutCamps.map(c => c.scope_value!))
                .eq('org_type', 'seller')
            : { data: [] },
        ]);

        const prodMap = new Map((prodRes.data ?? []).map((p: Product) => [p.id, p]));
        const brandMap = new Map((brandRes.data ?? []).map((b: Brand) => [b.id, b]));
        const orgMap   = new Map((boutRes.data ?? []).map((o: Organisation) => [o.id, o]));

        setData({
          products: productCamps
            .filter(c => prodMap.has(c.scope_value!))
            .map(c => ({ campaign: c, product: prodMap.get(c.scope_value!)! })),
          brands: brandCamps
            .filter(c => brandMap.has(c.scope_value!))
            .map(c => ({ campaign: c, brand: brandMap.get(c.scope_value!)! })),
          boutiques: boutCamps
            .filter(c => orgMap.has(c.scope_value!))
            .map(c => ({ campaign: c, org: orgMap.get(c.scope_value!)! })),
          loading: false,
        });
      });
  }, []);

  return data;
}

// ─── Carte produit sponsorisé ──────────────────────────────────────────────────
function SponsoredProductCard({ item }: { item: SponsoredProduct }) {
  const navigate = useNavigate();
  const bestTier = item.product.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0];

  return (
    <Box
      bg="white" border="1px solid" borderColor="blue.100" rounded="xl"
      overflow="hidden" cursor="pointer"
      _hover={{ borderColor: 'blue.300', boxShadow: '0 4px 16px rgba(37,99,235,0.10)', transform: 'translateY(-2px)' }}
      transition="all 0.18s"
      onClick={() => navigate(`/product/${item.product.id}`)}
      position="relative"
    >
      {/* Badge sponsorisé */}
      <Badge
        position="absolute" top={2} left={2} zIndex={1}
        fontSize="8px" fontWeight="700" letterSpacing="0.04em"
        bg="rgba(37,99,235,0.90)" color="white"
        px={1.5} py={0.5} rounded="sm"
        textTransform="uppercase"
      >
        Sponsorisé
      </Badge>

      {/* Image */}
      <Box h="130px" bg="gray.50" display="flex" alignItems="center" justifyContent="center" overflow="hidden">
        {item.product.images?.[0]
          ? <Image src={item.product.images[0]} alt={item.product.name} h="full" w="full" objectFit="cover" />
          : <Package size={32} color="var(--chakra-colors-gray-300)" />
        }
      </Box>

      {/* Infos */}
      <Box px={3} py={2.5}>
        <Text fontSize="xs" color="gray.400" noOfLines={1} mb={0.5}>
          {item.product.organisations?.name ?? item.product.brands?.name ?? '—'}
        </Text>
        <Text fontSize="sm" fontWeight="600" color="gray.800" noOfLines={2} lineHeight="1.3" mb={2}>
          {item.product.name}
        </Text>
        {bestTier && (
          <Text fontSize="sm" fontWeight="700" color="blue.700" fontFamily="mono">
            {bestTier.unit_price.toFixed(2)} {item.product.currency}
          </Text>
        )}
        <Button
          size="xs" w="full" mt={2} colorScheme="blue" variant="outline" rounded="md"
          fontSize="10px" fontWeight="600"
          onClick={(e) => { e.stopPropagation(); navigate(`/product/${item.product.id}`); }}
        >
          Voir le produit
        </Button>
      </Box>
    </Box>
  );
}

// ─── Carte marque sponsorisée ──────────────────────────────────────────────────
function SponsoredBrandCard({ item }: { item: SponsoredBrand }) {
  const navigate = useNavigate();
  return (
    <Box
      bg="white" border="1px solid" borderColor="purple.100" rounded="xl"
      px={4} py={3} minW="200px"
      display="flex" alignItems="center" gap={3}
      cursor="pointer"
      _hover={{ borderColor: 'purple.300', boxShadow: '0 4px 16px rgba(147,51,234,0.10)', transform: 'translateY(-1px)' }}
      transition="all 0.18s"
      onClick={() => navigate(`/brands/${item.brand.id}`)}
      position="relative"
    >
      <Badge
        position="absolute" top={1.5} right={2}
        fontSize="7px" fontWeight="700" letterSpacing="0.04em"
        bg="rgba(147,51,234,0.85)" color="white"
        px={1.5} py="2px" rounded="sm" textTransform="uppercase"
      >
        Partenaire
      </Badge>

      {/* Logo */}
      <Box
        w="44px" h="44px" rounded="lg" overflow="hidden" bg="gray.50"
        border="1px solid" borderColor="gray.100" flexShrink={0}
        display="flex" alignItems="center" justifyContent="center"
      >
        {item.brand.logo_url
          ? <Image src={item.brand.logo_url} alt={item.brand.name} w="full" h="full" objectFit="contain" p={1} />
          : <Star size={20} color="var(--chakra-colors-purple-300)" />
        }
      </Box>

      {/* Texte */}
      <Box minW={0}>
        <Text fontSize="sm" fontWeight="700" color="gray.800" noOfLines={1}>{item.brand.name}</Text>
        {item.brand.description && (
          <Text fontSize="10px" color="gray.400" noOfLines={1} mt={0.5}>{item.brand.description}</Text>
        )}
        <HStack spacing={1} mt={1}>
          <ExternalLink size={9} color="var(--chakra-colors-purple-500)" />
          <Text fontSize="10px" color="purple.600" fontWeight="600">Voir la marque</Text>
        </HStack>
      </Box>
    </Box>
  );
}

// ─── Carte boutique sponsorisée ────────────────────────────────────────────────
function SponsoredBoutiqueCard({ item }: { item: SponsoredBoutique }) {
  const navigate = useNavigate();
  return (
    <Box
      bg="white" border="1px solid" borderColor="teal.100" rounded="xl"
      px={4} py={3} minW="200px"
      display="flex" alignItems="center" gap={3}
      cursor="pointer"
      _hover={{ borderColor: 'teal.300', boxShadow: '0 4px 16px rgba(20,184,166,0.10)', transform: 'translateY(-1px)' }}
      transition="all 0.18s"
      onClick={() => navigate(`/catalog?seller=${item.org.id}`)}
      position="relative"
    >
      <Badge
        position="absolute" top={1.5} right={2}
        fontSize="7px" fontWeight="700" letterSpacing="0.04em"
        bg="rgba(15,118,110,0.85)" color="white"
        px={1.5} py="2px" rounded="sm" textTransform="uppercase"
      >
        Boutique
      </Badge>

      <Box
        w="44px" h="44px" rounded="lg" overflow="hidden" bg="teal.50"
        border="1px solid" borderColor="teal.100" flexShrink={0}
        display="flex" alignItems="center" justifyContent="center"
      >
        <Store size={20} color="var(--chakra-colors-teal-500)" />
      </Box>

      <Box minW={0}>
        <Text fontSize="sm" fontWeight="700" color="gray.800" noOfLines={1}>{item.org.name}</Text>
        <Text fontSize="10px" color="gray.400" noOfLines={1} mt={0.5}>
          {[item.org.city, item.org.country].filter(Boolean).join(', ') || 'Vendeur certifié'}
        </Text>
        <HStack spacing={1} mt={1}>
          <ExternalLink size={9} color="var(--chakra-colors-teal-500)" />
          <Text fontSize="10px" color="teal.600" fontWeight="600">Voir la boutique</Text>
        </HStack>
      </Box>
    </Box>
  );
}

// ─── Carrousel horizontal avec flèches ────────────────────────────────────────
function HorizontalCarousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (ref.current) ref.current.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };
  return (
    <Box position="relative">
      <IconButton
        aria-label="Précédent" icon={<ChevronLeft size={16} />}
        position="absolute" left="-14px" top="50%" transform="translateY(-50%)"
        zIndex={2} size="sm" rounded="full" bg="white" shadow="md"
        border="1px solid" borderColor="gray.200" color="gray.600"
        _hover={{ bg: 'gray.50' }}
        onClick={() => scroll('left')}
      />
      <Box
        ref={ref}
        display="flex" gap={3} overflowX="auto" pb={1} px={1}
        css={{
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {children}
      </Box>
      <IconButton
        aria-label="Suivant" icon={<ChevronRight size={16} />}
        position="absolute" right="-14px" top="50%" transform="translateY(-50%)"
        zIndex={2} size="sm" rounded="full" bg="white" shadow="md"
        border="1px solid" borderColor="gray.200" color="gray.600"
        _hover={{ bg: 'gray.50' }}
        onClick={() => scroll('right')}
      />
    </Box>
  );
}

// ─── Section principale ────────────────────────────────────────────────────────
export default function ComparatorAdsSection() {
  const { products, brands, boutiques, loading } = useComparatorAds();

  const hasAds = products.length > 0 || brands.length > 0 || boutiques.length > 0;

  return (
    <Box
      bg="gray.50" border="1px solid" borderColor="gray.200"
      rounded="xl" px={5} py={4}
    >
      {/* En-tête section */}
      <Flex justify="space-between" align="center" mb={4}>
        <HStack spacing={2}>
          <Box
            w={6} h={6} rounded="md" bg="blue.50" border="1px solid" borderColor="blue.100"
            display="flex" alignItems="center" justifyContent="center"
          >
            <Sparkles size={13} color="var(--chakra-colors-blue-500)" />
          </Box>
          <Text fontSize="sm" fontWeight="700" color="gray.700">
            Produits & Marques mis en avant
          </Text>
        </HStack>
        <Tag size="sm" colorScheme="gray" rounded="full" variant="subtle">
          <TagLabel fontSize="9px" fontWeight="600" letterSpacing="0.04em" textTransform="uppercase">
            Publicité
          </TagLabel>
        </Tag>
      </Flex>

      {/* ── Chargement ── */}
      {loading && (
        <VStack align="stretch" spacing={4}>
          <HStack spacing={2}>
            <Skeleton h="12px" w="12px" rounded="sm" />
            <Skeleton h="10px" w="120px" />
          </HStack>
          <HStack spacing={3}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} h="72px" w="200px" rounded="xl" flexShrink={0} />
            ))}
          </HStack>
          <Divider />
          <HStack spacing={2}>
            <Skeleton h="12px" w="12px" rounded="sm" />
            <Skeleton h="10px" w="140px" />
          </HStack>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} bg="white" rounded="xl" overflow="hidden">
                <Skeleton h="110px" />
                <Box p={3}><SkeletonText noOfLines={3} spacing={2} /></Box>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      )}

      {/* ── Aucune campagne active ── */}
      {!loading && !hasAds && (
        <Flex
          direction="column" align="center" justify="center"
          py={8} gap={3} textAlign="center"
        >
          <Flex
            w={12} h={12} rounded="xl" bg="white"
            border="1px dashed" borderColor="gray.300"
            align="center" justify="center"
          >
            <Sparkles size={20} color="var(--chakra-colors-gray-300)" />
          </Flex>
          <Box>
            <Text fontSize="sm" fontWeight="600" color="gray.500">
              Aucune annonce sponsorisée active
            </Text>
            <Text fontSize="xs" color="gray.400" mt={1}>
              Les vendeurs peuvent booster leurs produits et marques depuis leur espace marketing.
            </Text>
          </Box>
        </Flex>
      )}

      {/* ── Contenu ── */}
      {!loading && hasAds && (
        <VStack align="stretch" spacing={5} divider={<Divider borderColor="gray.200" />}>
          {brands.length > 0 && (
            <Box>
              <HStack spacing={1.5} mb={3}>
                <Star size={12} color="var(--chakra-colors-purple-500)" />
                <Text fontSize="xs" fontWeight="700" color="gray.600" textTransform="uppercase" letterSpacing="0.06em">
                  Marques partenaires
                </Text>
                <Badge colorScheme="purple" rounded="full" fontSize="9px" px={1.5}>{brands.length}</Badge>
              </HStack>
              <HorizontalCarousel>
                {brands.map(item => <SponsoredBrandCard key={item.campaign.id} item={item} />)}
              </HorizontalCarousel>
            </Box>
          )}

          {boutiques.length > 0 && (
            <Box>
              <HStack spacing={1.5} mb={3}>
                <Store size={12} color="var(--chakra-colors-teal-500)" />
                <Text fontSize="xs" fontWeight="700" color="gray.600" textTransform="uppercase" letterSpacing="0.06em">
                  Boutiques en vedette
                </Text>
                <Badge colorScheme="teal" rounded="full" fontSize="9px" px={1.5}>{boutiques.length}</Badge>
              </HStack>
              <HorizontalCarousel>
                {boutiques.map(item => <SponsoredBoutiqueCard key={item.campaign.id} item={item} />)}
              </HorizontalCarousel>
            </Box>
          )}

          {products.length > 0 && (
            <Box>
              <HStack spacing={1.5} mb={3}>
                <Package size={12} color="var(--chakra-colors-blue-500)" />
                <Text fontSize="xs" fontWeight="700" color="gray.600" textTransform="uppercase" letterSpacing="0.06em">
                  Produits sponsorisés
                </Text>
                <Badge colorScheme="blue" rounded="full" fontSize="9px" px={1.5}>{products.length}</Badge>
              </HStack>
              <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={3}>
                {products.map(item => <SponsoredProductCard key={item.campaign.id} item={item} />)}
              </SimpleGrid>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}
