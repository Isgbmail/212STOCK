import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid, Badge,
  Input, InputGroup, InputLeftElement, Select, Checkbox,
  Button, Divider, Skeleton,
} from '@chakra-ui/react';
import { Search, MapPin, Weight, Star, Truck, Thermometer, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DeliveryProvider {
  id: string;
  name: string;
  delivery_profiles: {
    delivery_type: string;
    base_rate: number | null;
    avg_rating: number;
    review_count: number;
    validation_status: string;
  }[];
  delivery_zones: { region: string; postal_codes: string[] }[];
  delivery_capabilities: {
    max_weight_kg: number | null;
    cold_chain: boolean;
    last_mile: boolean;
  }[];
}

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  logistics_company: 'Société de logistique',
  independent: 'Indépendant',
  internal_fleet: 'Flotte interne',
};

export default function DeliveryDirectoryPage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<DeliveryProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [coldChainOnly, setColdChainOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('organisations')
        .select(`
          id, name,
          delivery_profiles(delivery_type, base_rate, avg_rating, review_count, validation_status),
          delivery_zones(region, postal_codes),
          delivery_capabilities(max_weight_kg, cold_chain, last_mile)
        `)
        .eq('org_type', 'delivery');

      const validated = (data as DeliveryProvider[])?.filter(
        (p) => p.delivery_profiles?.[0]?.validation_status === 'validated'
      ) ?? [];
      setProviders(validated);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = providers.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter && p.delivery_profiles?.[0]?.delivery_type !== typeFilter) return false;
    if (coldChainOnly && !p.delivery_capabilities?.[0]?.cold_chain) return false;
    if (regionFilter && !p.delivery_zones?.some((z) =>
      z.region?.toLowerCase().includes(regionFilter.toLowerCase())
    )) return false;
    return true;
  });

  return (
    <VStack spacing={6} align="stretch">
      {/* En-tête — remplace le hero gradient B2C */}
      <Box
        bg="blue.900"
        rounded="md"
        p={{ base: 6, md: 8 }}
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute" top={0} right={0}
          w="0" h="0"
          style={{
            borderLeft: '300px solid transparent',
            borderTop: '300px solid rgba(255,255,255,0.03)',
          }}
        />
        <Flex align="center" gap={4} position="relative">
          <Flex
            w={10} h={10}
            bg="blue.800"
            border="1px" borderColor="blue.700"
            rounded="sm"
            align="center" justify="center"
            flexShrink={0}
          >
            <Truck size={19} color="white" />
          </Flex>
          <Box>
            <Heading size="md" color="white" fontWeight="700" letterSpacing="-0.01em">
              Annuaire des transporteurs
            </Heading>
            <Text color="blue.300" fontSize="xs" mt={0.5}>
              {loading ? '—' : `${providers.length} prestataire${providers.length !== 1 ? 's' : ''} validé${providers.length !== 1 ? 's' : ''}`}
              {' '}· Chaîne du froid disponible · Couverture nationale et régionale
            </Text>
          </Box>
        </Flex>
      </Box>

      {/* Filtres */}
      <Box bg="white" rounded="md" p={4} border="1px" borderColor="gray.200">
        <Flex gap={3} flexWrap="wrap" align="center">
          <InputGroup flex={1} minW="180px">
            <InputLeftElement pointerEvents="none">
              <Search size={14} color="gray" />
            </InputLeftElement>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom du prestataire..."
              rounded="sm"
              fontSize="sm"
            />
          </InputGroup>
          <InputGroup minW="150px">
            <InputLeftElement pointerEvents="none">
              <MapPin size={14} color="gray" />
            </InputLeftElement>
            <Input
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              placeholder="Région / ville..."
              rounded="sm"
              fontSize="sm"
            />
          </InputGroup>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            rounded="sm"
            fontSize="sm"
            minW="200px"
            placeholder="Type de prestataire"
          >
            <option value="logistics_company">Société de logistique</option>
            <option value="independent">Indépendant</option>
            <option value="internal_fleet">Flotte interne</option>
          </Select>
          <Checkbox
            isChecked={coldChainOnly}
            onChange={(e) => setColdChainOnly(e.target.checked)}
            colorScheme="blue"
            size="sm"
          >
            <Text fontSize="sm" color="gray.700">Chaîne du froid</Text>
          </Checkbox>
        </Flex>
      </Box>

      <Text fontSize="xs" color="gray.400" fontWeight="500">
        {loading ? 'Chargement...' : `${filtered.length} prestataire${filtered.length !== 1 ? 's' : ''} trouvé${filtered.length !== 1 ? 's' : ''}`}
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h="200px" rounded="md" />)
          : filtered.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
      </SimpleGrid>

      {!loading && filtered.length === 0 && (
        <Box
          bg="white" border="1px" borderColor="gray.200"
          rounded="md" textAlign="center" py={14}
        >
          <Flex w={12} h={12} bg="gray.50" border="1px" borderColor="gray.200"
            rounded="md" align="center" justify="center" mx="auto" mb={3}>
            <Truck size={22} color="var(--chakra-colors-gray-300)" />
          </Flex>
          <Text fontWeight="600" color="gray.500" fontSize="sm">Aucun prestataire trouvé</Text>
          <Text fontSize="xs" color="gray.400" mt={1}>Modifiez vos critères de recherche.</Text>
        </Box>
      )}
    </VStack>
  );
}

function ProviderCard({ provider }: { provider: DeliveryProvider }) {
  const navigate = useNavigate();
  const profile = provider.delivery_profiles?.[0];
  const caps = provider.delivery_capabilities?.[0];
  const zones = provider.delivery_zones ?? [];

  return (
    <Box
      bg="white"
      rounded="md"
      border="1px"
      borderColor="gray.200"
      _hover={{ borderColor: 'blue.300' }}
      transition="border-color 0.15s"
      overflow="hidden"
    >
      {/* En-tête prestataire */}
      <Box bg="gray.50" borderBottom="1px" borderColor="gray.200" px={4} py={3}>
        <Flex justify="space-between" align="start">
          <HStack spacing={3}>
            <Flex
              w={9} h={9}
              bg="blue.800"
              rounded="sm"
              align="center" justify="center"
              flexShrink={0}
            >
              <Text fontSize="xs" fontWeight="800" color="white">
                {provider.name.slice(0, 2).toUpperCase()}
              </Text>
            </Flex>
            <Box>
              <Text fontWeight="700" color="gray.800" fontSize="sm">{provider.name}</Text>
              <Badge colorScheme="blue" fontSize="10px" rounded="sm" fontWeight="600">
                {DELIVERY_TYPE_LABELS[profile?.delivery_type ?? ''] ?? profile?.delivery_type}
              </Badge>
            </Box>
          </HStack>
          {(profile?.avg_rating ?? 0) > 0 && (
            <HStack spacing={1}>
              <Star size={12} fill="#D97706" color="#D97706" />
              <Text fontSize="sm" fontWeight="700" color="gray.700">
                {profile?.avg_rating?.toFixed(1)}
              </Text>
              <Text fontSize="10px" color="gray.400">({profile?.review_count})</Text>
            </HStack>
          )}
        </Flex>
      </Box>

      <Box p={4}>
        {/* Capacités */}
        <HStack spacing={2} mb={3} flexWrap="wrap">
          {caps?.cold_chain && (
            <Badge colorScheme="cyan" rounded="sm" fontSize="10px">
              <HStack spacing={1}><Thermometer size={9} /><Text>Chaîne du froid</Text></HStack>
            </Badge>
          )}
          {caps?.last_mile && (
            <Badge colorScheme="blue" rounded="sm" fontSize="10px">Dernier kilomètre</Badge>
          )}
          {caps?.max_weight_kg && (
            <Badge colorScheme="gray" rounded="sm" fontSize="10px">
              <HStack spacing={1}><Weight size={9} /><Text>Max {caps.max_weight_kg} kg</Text></HStack>
            </Badge>
          )}
        </HStack>

        {/* Zones */}
        {zones.length > 0 && (
          <Box mb={3}>
            <Text fontSize="10px" color="gray.400" mb={1} fontWeight="600"
              textTransform="uppercase" letterSpacing="0.05em">
              Zones d'intervention
            </Text>
            <Flex gap={1} flexWrap="wrap">
              {zones.slice(0, 3).map((z, i) => (
                <Badge key={i} colorScheme="gray" variant="outline" fontSize="10px" rounded="sm">
                  {z.region}
                </Badge>
              ))}
              {zones.length > 3 && (
                <Badge colorScheme="gray" variant="outline" fontSize="10px" rounded="sm">
                  +{zones.length - 3}
                </Badge>
              )}
            </Flex>
          </Box>
        )}

        <Divider mb={3} borderColor="gray.100" />

        <Flex justify="space-between" align="center">
          <Box>
            {profile?.base_rate ? (
              <>
                <Text fontSize="10px" color="gray.400" textTransform="uppercase"
                  letterSpacing="0.05em">Tarif de base</Text>
                <Text fontWeight="700" color="gray.800" fontSize="sm" fontFamily="mono">
                  {profile.base_rate.toFixed(2)} €
                </Text>
              </>
            ) : (
              <Text fontSize="xs" color="gray.400" fontStyle="italic">Tarif sur demande</Text>
            )}
          </Box>
          <Button
            size="xs"
            colorScheme="blue"
            rounded="md"
            rightIcon={<ArrowRight size={11} />}
            onClick={() => navigate('/buyer/tickets/new')}
            bg="blue.800"
            _hover={{ bg: 'blue.700' }}
            fontSize="xs"
            fontWeight="600"
          >
            Contacter
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
