import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid, Image,
  Button, Skeleton, SkeletonText, Badge, IconButton, Wrap, WrapItem, Tag, TagLabel,
} from '@chakra-ui/react';
import { ArrowLeft, Package, Star, ShoppingCart, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Brand, Product } from '../../types';

function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bestPrice = product.price_tiers?.sort((a, b) => a.qty_min - b.qty_min)[0];

  return (
    <Box
      bg="white"
      rounded="md"
      overflow="hidden"
      border="1px"
      borderColor="gray.200"
      _hover={{ borderColor: 'blue.300' }}
      transition="border-color 0.15s"
      cursor="pointer"
      onClick={() => navigate(`/product/${product.id}`)}
      position="relative"
    >
      {product.is_on_promotion && (
        <Badge
          position="absolute" top={2} left={2}
          colorScheme="blue" rounded="sm" px={2} fontSize="10px" zIndex={1}
          fontWeight="700" textTransform="uppercase" letterSpacing="0.04em"
        >
          Promo
        </Badge>
      )}
      <Box h="140px" bg="gray.50" borderBottom="1px" borderColor="gray.100">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover" loading="lazy" />
        ) : (
          <Flex w="full" h="full" align="center" justify="center" bg="gray.50">
            <Package size={28} color="var(--chakra-colors-gray-300)" />
          </Flex>
        )}
      </Box>
      <Box p={3}>
        <Text fontWeight="600" color="gray.800" fontSize="sm" noOfLines={2} mb={1} lineHeight={1.4}>
          {product.name}
        </Text>
        {product.avg_rating > 0 && (
          <HStack spacing={1} mb={2}>
            <Star size={10} fill="#D97706" color="#D97706" />
            <Text fontSize="10px" color="gray.500">{product.avg_rating.toFixed(1)}</Text>
          </HStack>
        )}
        <Flex justify="space-between" align="center">
          {user ? (
            <Box>
              {bestPrice ? (
                <Text fontWeight="700" color="blue.800" fontSize="sm" fontFamily="mono">
                  {bestPrice.unit_price.toFixed(2)} {product.currency}
                </Text>
              ) : (
                <Text fontSize="xs" color="gray.400" fontStyle="italic">Sur devis</Text>
              )}
              <Text fontSize="10px" color="gray.400" fontFamily="mono">MOQ : {product.moq}</Text>
            </Box>
          ) : (
            <Box
              bg="gray.50" border="1px" borderColor="gray.200" rounded="sm" px={2} py={1}
              cursor="pointer"
              onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
              _hover={{ bg: 'blue.50', borderColor: 'blue.200' }}
              transition="all 0.1s"
            >
              <HStack spacing={1}>
                <Lock size={10} color="var(--chakra-colors-gray-400)" />
                <Text fontSize="10px" color="gray.600" fontWeight="500">Accéder aux tarifs</Text>
              </HStack>
            </Box>
          )}
          <IconButton
            aria-label="Commander"
            icon={user ? <ShoppingCart size={13} /> : <Lock size={13} />}
            size="xs"
            colorScheme={user ? 'blue' : 'gray'}
            variant={user ? 'solid' : 'outline'}
            rounded="sm"
            isDisabled={!user}
            opacity={user ? 1 : 0.5}
            bg={user ? 'blue.800' : undefined}
            _hover={user ? { bg: 'blue.700' } : undefined}
            onClick={(e) => e.stopPropagation()}
          />
        </Flex>
      </Box>
    </Box>
  );
}

export default function BrandPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('brands').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('products')
        .select('*, organisations(name), price_tiers(*)')
        .eq('brand_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    ]).then(([brandRes, prodsRes]) => {
      setBrand(brandRes.data as Brand);
      setProducts((prodsRes.data as Product[]) ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <VStack spacing={5} align="stretch">
        <Skeleton h="140px" rounded="md" />
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Box key={i} rounded="md" overflow="hidden" border="1px" borderColor="gray.200" bg="white">
              <Skeleton h="140px" />
              <Box p={3}><SkeletonText noOfLines={3} spacing={2} /></Box>
            </Box>
          ))}
        </SimpleGrid>
      </VStack>
    );
  }

  if (!brand) {
    return (
      <Flex direction="column" align="center" justify="center" minH="60vh" gap={4}>
        <Flex w={12} h={12} bg="gray.50" border="1px" borderColor="gray.200" rounded="md"
          align="center" justify="center">
          <Package size={24} color="var(--chakra-colors-gray-400)" />
        </Flex>
        <Box textAlign="center">
          <Heading size="sm" color="gray.700" fontWeight="700" mb={1}>Marque introuvable</Heading>
          <Text fontSize="sm" color="gray.400">Cette marque n'existe pas ou a été retirée du catalogue.</Text>
        </Box>
        <Button
          onClick={() => navigate('/brands')}
          leftIcon={<ArrowLeft size={14} />}
          size="sm"
          colorScheme="blue"
          rounded="md"
          bg="blue.800"
          _hover={{ bg: 'blue.700' }}
          fontSize="sm"
          fontWeight="600"
        >
          Toutes les marques
        </Button>
      </Flex>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Navigation retour */}
      <Box>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={13} />}
          onClick={() => navigate('/brands')}
          color="gray.500"
          rounded="md"
          mb={4}
          fontSize="sm"
        >
          Toutes les marques
        </Button>

        {/* En-tête marque */}
        <Box bg="white" rounded="md" p={{ base: 5, md: 6 }} border="1px" borderColor="gray.200">
          <Flex align="center" gap={5} flexWrap="wrap">
            <Box
              w="90px" h="90px"
              rounded="md"
              overflow="hidden"
              bg="gray.50"
              border="1px" borderColor="gray.200"
              flexShrink={0}
              display="flex" alignItems="center" justifyContent="center"
            >
              {brand.logo_url ? (
                <Image src={brand.logo_url} alt={brand.name} w="full" h="full" objectFit="contain" p={2} />
              ) : (
                <Package size={28} color="var(--chakra-colors-gray-300)" />
              )}
            </Box>
            <Box flex={1}>
              <HStack spacing={3} mb={1} align="center">
                <Heading size="md" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
                  {brand.name}
                </Heading>
                <Badge colorScheme="blue" rounded="sm" px={2} fontSize="11px">
                  {products.length} référence{products.length !== 1 ? 's' : ''}
                </Badge>
              </HStack>
              {brand.description && (
                <Text color="gray.500" fontSize="sm" lineHeight={1.7} maxW="580px">
                  {brand.description}
                </Text>
              )}
            </Box>
          </Flex>
        </Box>
      </Box>

      {/* Grille de produits */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Text fontSize="sm" fontWeight="700" color="gray.700">
            Références du catalogue
          </Text>
          <Text fontSize="xs" color="gray.400">{products.length} produit{products.length !== 1 ? 's' : ''}</Text>
        </HStack>
        {products.length === 0 ? (
          <Box
            bg="white"
            border="1px" borderColor="gray.200"
            rounded="md"
            textAlign="center"
            py={14}
          >
            <Flex w={12} h={12} bg="gray.50" border="1px" borderColor="gray.200"
              rounded="md" align="center" justify="center" mx="auto" mb={3}>
              <Package size={22} color="var(--chakra-colors-gray-300)" />
            </Flex>
            <Text fontWeight="600" color="gray.500" fontSize="sm">
              Aucune référence active pour cette marque.
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={3}>
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </SimpleGrid>
        )}
      </Box>
    </VStack>
  );
}
