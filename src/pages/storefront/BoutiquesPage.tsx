import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid,
  Skeleton, Input, InputGroup, InputLeftElement, Badge, Tag, TagLabel,
} from '@chakra-ui/react';
import { Search, Store, MapPin, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Organisation } from '../../types';

export default function BoutiquesPage() {
  const navigate = useNavigate();
  const [boutiques, setBoutiques] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    supabase
      .from('organisations')
      .select('id, name, org_type, sub_type, country, city, validation_status')
      .eq('org_type', 'seller')
      .eq('validation_status', 'active')
      .order('name')
      .then(({ data }) => {
        setBoutiques((data as Organisation[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = boutiques.filter(b =>
    b.name.toLowerCase().includes(query.toLowerCase()) ||
    (b.city ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (b.country ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <VStack spacing={6} align="stretch">
      {/* En-tête */}
      <Flex justify="space-between" align="end" flexWrap="wrap" gap={4}>
        <Box>
          <Text fontSize="11px" color="gray.400" fontWeight="600" textTransform="uppercase"
            letterSpacing="0.08em" mb={1}>
            Marketplace B2B
          </Text>
          <Heading size="md" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Boutiques vendeurs
          </Heading>
          {!loading && (
            <Text color="gray.400" fontSize="sm" mt={1}>
              {boutiques.length} vendeur{boutiques.length > 1 ? 's' : ''} certifié{boutiques.length > 1 ? 's' : ''}
            </Text>
          )}
        </Box>
        <Box w={{ base: 'full', md: '260px' }}>
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <Search size={13} color="var(--chakra-colors-gray-400)" />
            </InputLeftElement>
            <Input
              placeholder="Rechercher une boutique..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              bg="white" border="1px solid" borderColor="gray.200" rounded="lg"
              _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
              fontSize="sm"
            />
          </InputGroup>
        </Box>
      </Flex>

      {/* Grille */}
      {loading ? (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} h="110px" rounded="xl" />
          ))}
        </SimpleGrid>
      ) : filtered.length === 0 ? (
        <Flex direction="column" align="center" justify="center" py={16} gap={3}>
          <Box w={12} h={12} rounded="xl" bg="gray.50" border="1px solid" borderColor="gray.200"
            display="flex" alignItems="center" justifyContent="center">
            <Store size={22} color="var(--chakra-colors-gray-300)" />
          </Box>
          <Text color="gray.400" fontSize="sm">Aucune boutique trouvée</Text>
        </Flex>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
          {filtered.map(b => (
            <Box
              key={b.id}
              bg="white" border="1px solid" borderColor="gray.200" rounded="xl"
              px={4} py={4} cursor="pointer"
              _hover={{ borderColor: 'blue.300', boxShadow: '0 4px 16px rgba(37,99,235,0.08)', transform: 'translateY(-2px)' }}
              transition="all 0.18s"
              onClick={() => navigate(`/boutiques/${b.id}`)}
            >
              <HStack spacing={3} mb={3}>
                <Flex
                  w={10} h={10} rounded="lg" bg="blue.50"
                  border="1px solid" borderColor="blue.100" flexShrink={0}
                  align="center" justify="center"
                >
                  <Store size={18} color="var(--chakra-colors-blue-500)" />
                </Flex>
                <Box minW={0}>
                  <Text fontSize="sm" fontWeight="700" color="gray.800" noOfLines={1}>
                    {b.name}
                  </Text>
                  {(b.city || b.country) && (
                    <HStack spacing={1} mt={0.5}>
                      <MapPin size={10} color="var(--chakra-colors-gray-400)" />
                      <Text fontSize="10px" color="gray.400" noOfLines={1}>
                        {[b.city, b.country].filter(Boolean).join(', ')}
                      </Text>
                    </HStack>
                  )}
                </Box>
              </HStack>

              <Flex justify="space-between" align="center">
                {b.sub_type ? (
                  <Tag size="sm" colorScheme="blue" rounded="md" variant="subtle">
                    <TagLabel fontSize="9px" fontWeight="600">{b.sub_type}</TagLabel>
                  </Tag>
                ) : (
                  <Box />
                )}
                <HStack spacing={1} color="blue.600">
                  <ShoppingBag size={11} />
                  <Text fontSize="10px" fontWeight="600">Voir le catalogue</Text>
                </HStack>
              </Flex>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}
