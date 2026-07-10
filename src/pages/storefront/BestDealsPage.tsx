import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid,
  Badge, Image, Button, Tabs, TabList, Tab, TabPanels, TabPanel,
  Skeleton,
} from '@chakra-ui/react';
import { TrendingDown, Clock, ShoppingCart, Lock, ArrowRight, Package, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Product, Promotion } from '../../types';

export default function BestDealsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [promoProducts, setPromoProducts] = useState<Product[]>([]);
  const [flashPromos, setFlashPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [promoRes, flashRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, organisations(name), price_tiers(*)')
          .eq('status', 'active')
          .eq('is_on_promotion', true)
          .limit(16),
        supabase
          .from('promotions')
          .select('*')
          .eq('active', true)
          .gte('ends_at', new Date().toISOString())
          .lte('ends_at', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()),
      ]);
      setPromoProducts((promoRes.data as Product[]) ?? []);
      setFlashPromos((flashRes.data as Promotion[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <VStack spacing={6} align="stretch">
      {/* En-tête section — remplace le hero Pexels B2C */}
      <Box
        bg="blue.900"
        rounded="md"
        overflow="hidden"
        position="relative"
        minH={{ base: '150px', md: '180px' }}
      >
        {/* Accents géométriques sobres */}
        <Box
          position="absolute" top={0} right={0}
          w="0" h="0"
          style={{
            borderLeft: '280px solid transparent',
            borderTop: '280px solid rgba(255,255,255,0.03)',
          }}
        />
        <Box
          position="absolute" bottom="-30px" left="-30px"
          w="140px" h="140px"
          bg="blue.800"
          style={{ clipPath: 'circle()' }}
        />

        <Flex
          position="relative"
          p={{ base: 6, md: 10 }}
          align="center"
          minH={{ base: '150px', md: '180px' }}
        >
          <VStack align="start" spacing={3} maxW="560px">
            <HStack spacing={3}>
              <Flex
                w={9} h={9}
                bg="blue.800"
                border="1px" borderColor="blue.700"
                rounded="sm"
                align="center" justify="center"
                flexShrink={0}
              >
                <TrendingDown size={18} color="white" />
              </Flex>
              <Box>
                <Heading size="md" color="white" fontWeight="700" letterSpacing="-0.01em">
                  Offres négociées
                </Heading>
                <Text color="blue.300" fontSize="xs">
                  Conditions tarifaires préférentielles · Actualisées quotidiennement
                </Text>
              </Box>
            </HStack>
            <HStack spacing={6} pt={1} flexWrap="wrap">
              {[
                { icon: TrendingDown, label: 'Remises volume négociées' },
                { icon: Clock, label: 'Disponibilité limitée' },
                { icon: ShoppingCart, label: 'Prix nets professionnels HT' },
              ].map(({ icon: Icon, label }) => (
                <HStack key={label} spacing={1.5} color="blue.300">
                  <Icon size={12} />
                  <Text fontSize="xs" fontWeight="500">{label}</Text>
                </HStack>
              ))}
            </HStack>
          </VStack>
        </Flex>
      </Box>

      {/* Bannière accès restreint — remplace le gradient orange/red B2C */}
      {!user && (
        <Box
          bg="white"
          border="1px"
          borderColor="gray.200"
          rounded="md"
          p={4}
        >
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <HStack spacing={3}>
              <Flex
                w={8} h={8}
                bg="blue.50"
                border="1px" borderColor="blue.200"
                rounded="sm"
                align="center" justify="center"
                flexShrink={0}
              >
                <Lock size={15} color="var(--chakra-colors-blue-700)" />
              </Flex>
              <Box>
                <Text fontWeight="600" color="gray.800" fontSize="sm">
                  Accès réservé aux membres qualifiés
                </Text>
                <Text color="gray.500" fontSize="xs" lineHeight={1.5}>
                  Les conditions tarifaires sont visibles après qualification de votre dossier professionnel.
                </Text>
              </Box>
            </HStack>
            <HStack spacing={2}>
              <Button
                size="sm"
                colorScheme="blue"
                rounded="md"
                rightIcon={<ArrowRight size={13} />}
                onClick={() => navigate('/auth')}
                bg="blue.800"
                _hover={{ bg: 'blue.700' }}
                fontSize="xs"
                fontWeight="600"
              >
                Déposer mon dossier
              </Button>
              <Button
                size="sm"
                variant="outline"
                colorScheme="blue"
                rounded="md"
                fontSize="xs"
                onClick={() => navigate('/auth')}
              >
                Se connecter
              </Button>
            </HStack>
          </Flex>
        </Box>
      )}

      <Tabs colorScheme="blue" variant="line">
        <TabList borderBottom="2px" borderColor="gray.100">
          <Tab fontSize="sm" fontWeight="500" pb={3}>
            <HStack spacing={2}><TrendingDown size={13} /><Text>En promotion</Text></HStack>
          </Tab>
          <Tab fontSize="sm" fontWeight="500" pb={3}>
            <HStack spacing={2}>
              <Clock size={13} />
              <Text>Disponibilité limitée</Text>
              {flashPromos.length > 0 && (
                <Badge colorScheme="blue" rounded="sm" fontSize="10px">{flashPromos.length}</Badge>
              )}
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0} pt={5}>
            <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={3}>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} h="200px" rounded="md" />
                  ))
                : promoProducts.map((p) => (
                    <DealCard key={p.id} product={p} isAuthenticated={!!user} />
                  ))}
              {!loading && promoProducts.length === 0 && (
                <Box gridColumn="1/-1" textAlign="center" py={12} color="gray.400">
                  <Flex
                    w={12} h={12} bg="gray.50" border="1px" borderColor="gray.200"
                    rounded="md" align="center" justify="center" mx="auto" mb={3}
                  >
                    <Tag size={22} color="var(--chakra-colors-gray-400)" />
                  </Flex>
                  <Text fontSize="sm" color="gray.500" fontWeight="500">
                    Aucune offre promotionnelle active pour le moment.
                  </Text>
                </Box>
              )}
            </SimpleGrid>
          </TabPanel>

          <TabPanel px={0} pt={5}>
            {flashPromos.length === 0 ? (
              <Box textAlign="center" py={14} color="gray.400">
                <Flex
                  w={12} h={12} bg="gray.50" border="1px" borderColor="gray.200"
                  rounded="md" align="center" justify="center" mx="auto" mb={3}
                >
                  <Clock size={22} color="var(--chakra-colors-gray-400)" />
                </Flex>
                <Text fontSize="sm" color="gray.500" fontWeight="500">
                  Aucune offre à disponibilité limitée en cours.
                </Text>
              </Box>
            ) : (
              <VStack spacing={3} align="stretch">
                {flashPromos.map((promo) => (
                  <LimitedOfferCard key={promo.id} promo={promo} isAuthenticated={!!user} />
                ))}
              </VStack>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}

function DealCard({ product, isAuthenticated }: { product: Product; isAuthenticated: boolean }) {
  const navigate = useNavigate();
  const bestPrice = product.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0];

  return (
    <Box
      bg="white"
      rounded="md"
      overflow="hidden"
      border="1px"
      borderColor="gray.200"
      _hover={{ borderColor: 'blue.200', bg: 'blue.50' }}
      transition="border-color 0.15s, background 0.15s"
      cursor="pointer"
      onClick={() => navigate(`/product/${product.id}`)}
      position="relative"
    >
      {/* Badge promotion */}
      <Badge
        position="absolute" top={2} left={2}
        colorScheme="blue"
        rounded="sm"
        px={2} py={0.5}
        zIndex={1}
        fontSize="10px"
        fontWeight="700"
        textTransform="uppercase"
        letterSpacing="0.05em"
      >
        Promo
      </Badge>

      <Box h="150px" bg="gray.50" borderBottom="1px" borderColor="gray.100">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover" />
        ) : (
          <Flex w="full" h="full" align="center" justify="center" bg="gray.50">
            <Package size={28} color="var(--chakra-colors-gray-300)" />
          </Flex>
        )}
      </Box>

      <Box p={3}>
        <Text fontSize="10px" color="gray.400" noOfLines={1} mb={0.5} textTransform="uppercase"
          letterSpacing="0.04em">
          {product.organisations?.name}
        </Text>
        <Text fontWeight="600" fontSize="sm" color="gray.800" noOfLines={2} mb={3} lineHeight={1.4}>
          {product.name}
        </Text>

        {isAuthenticated ? (
          <Flex justify="space-between" align="center">
            <Box>
              {bestPrice ? (
                <Text fontWeight="700" color="blue.800" fontSize="md" fontFamily="mono">
                  {bestPrice.unit_price.toFixed(2)} {product.currency}
                </Text>
              ) : (
                <Text fontSize="xs" color="gray.400" fontStyle="italic">Sur devis</Text>
              )}
            </Box>
            <Button
              size="xs"
              colorScheme="blue"
              rounded="sm"
              leftIcon={<ShoppingCart size={11} />}
              bg="blue.800"
              _hover={{ bg: 'blue.700' }}
              fontSize="10px"
              onClick={(e) => e.stopPropagation()}
            >
              Commander
            </Button>
          </Flex>
        ) : (
          <Box
            bg="gray.50"
            border="1px"
            borderColor="gray.200"
            rounded="sm"
            p={2.5}
            textAlign="center"
            cursor="pointer"
            onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
            _hover={{ bg: 'blue.50', borderColor: 'blue.200' }}
            transition="all 0.1s"
          >
            <HStack justify="center" spacing={1.5}>
              <Lock size={11} color="var(--chakra-colors-gray-500)" />
              <Text fontSize="11px" fontWeight="500" color="gray.600">
                Accéder aux conditions tarifaires
              </Text>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function LimitedOfferCard({ promo, isAuthenticated }: { promo: Promotion; isAuthenticated: boolean }) {
  const navigate = useNavigate();
  const endsAt = new Date(promo.ends_at ?? '');
  const hoursLeft = Math.max(0, Math.round((endsAt.getTime() - Date.now()) / 3_600_000));

  return (
    <Box
      bg="white"
      rounded="md"
      border="1px"
      borderColor="gray.200"
      p={4}
    >
      <Flex justify="space-between" align="start">
        <HStack spacing={3} align="start">
          <Box w={1} h="full" bg="amber.400" rounded="full" alignSelf="stretch" minH="40px" />
          <Box>
            <HStack mb={1} spacing={2}>
              <Text fontWeight="600" color="gray.800" fontSize="sm">{promo.name}</Text>
              <Badge colorScheme="amber" rounded="sm" fontSize="9px" textTransform="uppercase"
                letterSpacing="0.05em">
                Disponibilité limitée
              </Badge>
            </HStack>
            {isAuthenticated ? (
              <Text fontSize="sm" color="blue.700" fontWeight="500">
                {promo.promo_type === 'percentage'
                  ? `Remise de ${promo.discount_value}% sur volume`
                  : `Remise de ${promo.discount_value} MAD`}
              </Text>
            ) : (
              <HStack spacing={1.5} cursor="pointer" onClick={() => navigate('/auth')}>
                <Lock size={11} color="var(--chakra-colors-gray-400)" />
                <Text fontSize="sm" color="gray.500">
                  Remise exclusive — <Text as="span" fontWeight="600">accès membres</Text>
                </Text>
              </HStack>
            )}
          </Box>
        </HStack>
        <Box textAlign="right" flexShrink={0}>
          <Text fontWeight="700" color="gray.700" fontSize="sm" fontFamily="mono">{hoursLeft}h</Text>
          <Text fontSize="10px" color="gray.400">restantes</Text>
          <Text fontSize="10px" color="gray.400" mt={0.5}>
            {endsAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}
