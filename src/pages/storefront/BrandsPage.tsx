import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid, Image,
  Skeleton, Input, InputGroup, InputLeftElement,
} from '@chakra-ui/react';
import { Search, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Brand } from '../../types';

export default function BrandsPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    supabase
      .from('brands')
      .select('*')
      .order('name')
      .then(({ data }) => { setBrands((data as Brand[]) ?? []); setLoading(false); });
  }, []);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <VStack spacing={6} align="stretch">
      {/* En-tête */}
      <Flex justify="space-between" align="end" flexWrap="wrap" gap={4}>
        <Box>
          <Text fontSize="11px" color="gray.400" fontWeight="600" textTransform="uppercase"
            letterSpacing="0.08em" mb={1}>
            Catalogue marques
          </Text>
          <Heading size="md" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Marques référencées
          </Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            {!loading && `${brands.length} marque${brands.length !== 1 ? 's' : ''} disponible${brands.length !== 1 ? 's' : ''} sur la plateforme`}
          </Text>
        </Box>
        <InputGroup maxW="280px">
          <InputLeftElement pointerEvents="none">
            <Search size={14} color="gray" />
          </InputLeftElement>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une marque..."
            rounded="sm"
            bg="white"
            border="1px"
            borderColor="gray.200"
            fontSize="sm"
            _focus={{ borderColor: 'blue.500' }}
          />
        </InputGroup>
      </Flex>

      {/* Grille marques */}
      <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={3}>
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} h="130px" rounded="md" />)
          : filtered.map((b) => (
              <Box
                key={b.id}
                bg="white"
                rounded="md"
                p={4}
                border="1px"
                borderColor="gray.200"
                cursor="pointer"
                onClick={() => navigate(`/brands/${b.id}`)}
                _hover={{ borderColor: 'blue.300' }}
                transition="border-color 0.15s"
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={3}
              >
                <Box
                  w="64px" h="64px"
                  rounded="sm"
                  overflow="hidden"
                  bg="gray.50"
                  border="1px" borderColor="gray.200"
                  display="flex" alignItems="center" justifyContent="center"
                  flexShrink={0}
                >
                  {b.logo_url ? (
                    <Image src={b.logo_url} alt={b.name} w="full" h="full" objectFit="contain" p={2} />
                  ) : (
                    <Package size={24} color="var(--chakra-colors-gray-300)" />
                  )}
                </Box>
                <Text fontWeight="600" fontSize="sm" color="gray.800" textAlign="center" noOfLines={1}>
                  {b.name}
                </Text>
                {b.description && (
                  <Text fontSize="10px" color="gray.400" textAlign="center" noOfLines={2} lineHeight={1.4}>
                    {b.description}
                  </Text>
                )}
              </Box>
            ))}
      </SimpleGrid>

      {!loading && filtered.length === 0 && (
        <Box
          bg="white" border="1px" borderColor="gray.200"
          rounded="md" textAlign="center" py={14}
        >
          <Flex w={12} h={12} bg="gray.50" border="1px" borderColor="gray.200"
            rounded="md" align="center" justify="center" mx="auto" mb={3}>
            <Search size={22} color="var(--chakra-colors-gray-300)" />
          </Flex>
          <Text fontWeight="600" color="gray.500" fontSize="sm">Aucune marque trouvée</Text>
          <Text fontSize="xs" color="gray.400" mt={1}>Essayez un autre terme de recherche.</Text>
        </Box>
      )}
    </VStack>
  );
}
