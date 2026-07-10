import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ComparatorAdsSection from '../../components/marketing/ComparatorAdsSection';
import {
  Box, Flex, Heading, Text, VStack, HStack, Button, Image,
  Badge, Table, Thead, Tbody, Tr, Th, Td, Tag, TagLabel,
  IconButton, Wrap, WrapItem, Checkbox, Divider, Tooltip,
  Popover, PopoverTrigger, PopoverContent, PopoverHeader,
  PopoverBody, PopoverCloseButton, PopoverArrow, SimpleGrid,
} from '@chakra-ui/react';
import {
  X, Scale, ArrowLeft, Lock, ShoppingCart, Package, SlidersHorizontal,
  Thermometer, Star, Leaf, Truck, Box as BoxIcon, FlaskConical,
  Building2, BarChart3, Check, RotateCcw,
} from 'lucide-react';
import { useComparator } from '../../contexts/ComparatorContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Product } from '../../types';

// ─── Définition de tous les critères disponibles ───────────────────────────────
interface CriteriaDef {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
}

const CRITERIA: CriteriaDef[] = [
  // Identité
  { id: 'supplier',       label: 'Fournisseur',         group: 'Identité',          icon: <Building2 size={12} /> },
  { id: 'brand',          label: 'Marque',               group: 'Identité',          icon: <Star size={12} /> },
  { id: 'manufacturer',   label: 'Fabricant',            group: 'Identité',          icon: <Building2 size={12} /> },
  { id: 'origin',         label: 'Pays d\'origine',      group: 'Identité',          icon: <BoxIcon size={12} /> },
  // Commercial
  { id: 'price',          label: 'Prix unitaire HT',     group: 'Commercial',        icon: <BarChart3 size={12} /> },
  { id: 'moq',            label: 'MOQ',                  group: 'Commercial',        icon: <Package size={12} /> },
  { id: 'pack_size',      label: 'Conditionnement',      group: 'Commercial',        icon: <Package size={12} /> },
  { id: 'lead_days',      label: 'Délai estimé',         group: 'Commercial',        icon: <Truck size={12} /> },
  { id: 'incoterms',      label: 'Incoterms',            group: 'Commercial',        icon: <Truck size={12} /> },
  // Qualité & Conformité
  { id: 'certifications', label: 'Certifications',       group: 'Qualité',           icon: <Check size={12} /> },
  { id: 'nutriscore',     label: 'Nutri-Score',          group: 'Qualité',           icon: <Leaf size={12} /> },
  { id: 'dlc',            label: 'DLC / DDM',            group: 'Qualité',           icon: <FlaskConical size={12} /> },
  { id: 'shelf_life',     label: 'Durée de vie (jours)', group: 'Qualité',           icon: <FlaskConical size={12} /> },
  { id: 'haccp',          label: 'Conformité HACCP',     group: 'Qualité',           icon: <Check size={12} /> },
  { id: 'rating',         label: 'Évaluation',           group: 'Qualité',           icon: <Star size={12} /> },
  // Physique
  { id: 'net_weight',     label: 'Poids net',            group: 'Physique',          icon: <BoxIcon size={12} /> },
  { id: 'physical_form',  label: 'Forme physique',       group: 'Physique',          icon: <FlaskConical size={12} /> },
  { id: 'packaging',      label: 'Type d\'emballage',    group: 'Physique',          icon: <Package size={12} /> },
  { id: 'recyclable',     label: 'Recyclable',           group: 'Physique',          icon: <Leaf size={12} /> },
  // Conservation
  { id: 'temperature',    label: 'Conservation',         group: 'Conservation',      icon: <Thermometer size={12} /> },
  { id: 'cold_chain',     label: 'Chaîne du froid',      group: 'Conservation',      icon: <Thermometer size={12} /> },
  { id: 'humidity',       label: 'Sensible humidité',    group: 'Conservation',      icon: <FlaskConical size={12} /> },
  { id: 'light',          label: 'Sensible lumière',     group: 'Conservation',      icon: <FlaskConical size={12} /> },
  // Logistique
  { id: 'fragility',      label: 'Fragilité',            group: 'Logistique',        icon: <Package size={12} /> },
  { id: 'pallet_weight',  label: 'Poids palette (kg)',   group: 'Logistique',        icon: <BoxIcon size={12} /> },
];

const DEFAULT_CRITERIA = [
  'supplier', 'brand', 'origin', 'price', 'moq', 'pack_size',
  'lead_days', 'temperature', 'certifications', 'nutriscore', 'rating',
];

const STORAGE_KEY = 's212_comparator_criteria';

const TEMP_LABELS: Record<string, string> = {
  ambient: 'Ambiant', refrigerated: 'Réfrigéré', fresh: 'Frais', frozen: 'Surgelé',
};
const TEMP_COLORS: Record<string, string> = {
  ambient: 'yellow', refrigerated: 'cyan', fresh: 'green', frozen: 'blue',
};
const NUTRISCORE_COLORS: Record<string, string> = {
  A: '#1a7c35', B: '#83b93d', C: '#f5c600', D: '#e27300', E: '#c0392b',
};
const PHYSICAL_FORM_LABELS: Record<string, string> = {
  liquid: 'Liquide', solid: 'Solide', powder: 'Poudre', gel: 'Gel',
  aerosol: 'Aérosol', cream: 'Crème', tablet: 'Comprimé', other: 'Autre',
};

// ─── Rendu d'une cellule selon le critère ─────────────────────────────────────
function CriteriaCell({ criteriaId, p, user, navigate }: {
  criteriaId: string;
  p: Product;
  user: unknown;
  navigate: (path: string) => void;
}) {
  const locked = (
    <HStack spacing={1}>
      <Lock size={10} color="var(--chakra-colors-gray-400)" />
      <Text fontSize="xs" color="blue.600" fontWeight="500" cursor="pointer" onClick={() => navigate('/auth')}>
        Accès membre
      </Text>
    </HStack>
  );

  switch (criteriaId) {
    case 'supplier':
      return <Text fontSize="sm" color="blue.700" fontWeight="600">{p.organisations?.name ?? '—'}</Text>;

    case 'brand':
      return <Text fontSize="sm" color="gray.700">{p.brands?.name ?? '—'}</Text>;

    case 'manufacturer':
      return <Text fontSize="sm" color="gray.700">{p.manufacturer_name ?? '—'}</Text>;

    case 'origin':
      return <Text fontSize="sm" color="gray.700">{p.origin_country ?? '—'}</Text>;

    case 'price': {
      const best = p.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0];
      if (!user) return locked;
      return best
        ? <Text fontSize="md" fontWeight="700" color="blue.800" fontFamily="mono">{best.unit_price.toFixed(2)} {p.currency}</Text>
        : <Text fontSize="xs" color="gray.400" fontStyle="italic">Sur devis</Text>;
    }

    case 'moq':
      return user
        ? <Text fontSize="sm" fontWeight="700" color="gray.800" fontFamily="mono">{p.moq} u.</Text>
        : locked;

    case 'pack_size':
      return <Text fontSize="sm" color="gray.700" fontFamily="mono">{p.pack_size} u./colis</Text>;

    case 'lead_days':
      return <Text fontSize="sm" color="gray.700" fontFamily="mono">{p.estimated_lead_days}j</Text>;

    case 'incoterms':
      return p.incoterms?.length
        ? <Wrap spacing={1}>{p.incoterms.map(i => <WrapItem key={i}><Tag size="sm" rounded="sm" colorScheme="purple"><TagLabel fontSize="10px">{i}</TagLabel></Tag></WrapItem>)}</Wrap>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'certifications':
      return p.certifications?.length
        ? <Wrap spacing={1}>{p.certifications.slice(0, 4).map(c => <WrapItem key={c}><Tag colorScheme="green" rounded="sm" size="sm"><TagLabel fontSize="10px">{c}</TagLabel></Tag></WrapItem>)}</Wrap>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'nutriscore':
      return p.nutri_score
        ? <Flex w="26px" h="26px" rounded="md" bg={NUTRISCORE_COLORS[p.nutri_score]} align="center" justify="center">
            <Text color="white" fontWeight="900" fontSize="sm">{p.nutri_score}</Text>
          </Flex>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'dlc':
      return <Text fontSize="sm" color="gray.700">{p.dlc_type ?? '—'}</Text>;

    case 'shelf_life':
      return p.shelf_life_days
        ? <Text fontSize="sm" fontFamily="mono" color="gray.700">{p.shelf_life_days}j</Text>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'haccp':
      return p.haccp_compliant != null
        ? <Tag colorScheme={p.haccp_compliant ? 'green' : 'red'} size="sm" rounded="sm">
            <TagLabel fontSize="10px">{p.haccp_compliant ? 'Conforme' : 'Non conforme'}</TagLabel>
          </Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'rating':
      return p.avg_rating > 0
        ? <HStack spacing={0.5}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Box key={i} color={i < Math.round(p.avg_rating) ? '#D97706' : 'gray.200'} fontSize="sm">★</Box>
            ))}
            <Text fontSize="xs" color="gray.500" ml={1}>({p.review_count})</Text>
          </HStack>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'net_weight':
      return p.net_weight
        ? <Text fontSize="sm" fontFamily="mono" color="gray.700">{p.net_weight} {p.weight_unit ?? 'g'}</Text>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'physical_form':
      return p.physical_form
        ? <Tag size="sm" rounded="sm" colorScheme="blue"><TagLabel fontSize="10px">{PHYSICAL_FORM_LABELS[p.physical_form] ?? p.physical_form}</TagLabel></Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'packaging':
      return <Text fontSize="sm" color="gray.700">{p.packaging_type ?? '—'}</Text>;

    case 'recyclable':
      return p.recyclable != null
        ? <Tag colorScheme={p.recyclable ? 'green' : 'gray'} size="sm" rounded="sm">
            <TagLabel fontSize="10px">{p.recyclable ? 'Recyclable' : 'Non recyclable'}</TagLabel>
          </Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'temperature':
      return <Tag colorScheme={TEMP_COLORS[p.temperature] ?? 'gray'} rounded="sm" size="sm">
        <TagLabel fontSize="xs">{TEMP_LABELS[p.temperature] ?? p.temperature}</TagLabel>
      </Tag>;

    case 'cold_chain':
      return p.cold_chain_required != null
        ? <Tag colorScheme={p.cold_chain_required ? 'cyan' : 'gray'} size="sm" rounded="sm">
            <TagLabel fontSize="10px">{p.cold_chain_required ? 'Requise' : 'Non requise'}</TagLabel>
          </Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'humidity':
      return p.humidity_sensitive != null
        ? <Tag colorScheme={p.humidity_sensitive ? 'orange' : 'gray'} size="sm" rounded="sm">
            <TagLabel fontSize="10px">{p.humidity_sensitive ? 'Sensible' : 'Non sensible'}</TagLabel>
          </Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'light':
      return p.light_sensitive != null
        ? <Tag colorScheme={p.light_sensitive ? 'yellow' : 'gray'} size="sm" rounded="sm">
            <TagLabel fontSize="10px">{p.light_sensitive ? 'Sensible' : 'Non sensible'}</TagLabel>
          </Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'fragility':
      return p.fragility_level
        ? <Tag colorScheme={{ low: 'green', medium: 'yellow', high: 'red' }[p.fragility_level] ?? 'gray'} size="sm" rounded="sm">
            <TagLabel fontSize="10px">{{ low: 'Faible', medium: 'Moyenne', high: 'Élevée' }[p.fragility_level]}</TagLabel>
          </Tag>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    case 'pallet_weight':
      return p.pallet_weight_kg
        ? <Text fontSize="sm" fontFamily="mono" color="gray.700">{p.pallet_weight_kg} kg</Text>
        : <Text fontSize="xs" color="gray.400">—</Text>;

    default:
      return <Text fontSize="xs" color="gray.400">—</Text>;
  }
}

// ─── Panel de sélection des critères ──────────────────────────────────────────
function CriteriaPanel({
  active, onChange,
}: {
  active: string[];
  onChange: (ids: string[]) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, CriteriaDef[]>();
    CRITERIA.forEach(c => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return map;
  }, []);

  const toggle = (id: string) => {
    onChange(active.includes(id) ? active.filter(x => x !== id) : [...active, id]);
  };

  return (
    <Box>
      <HStack justify="space-between" mb={3}>
        <Text fontSize="xs" color="gray.500">{active.length} critère{active.length > 1 ? 's' : ''} sélectionné{active.length > 1 ? 's' : ''}</Text>
        <HStack spacing={2}>
          <Button size="xs" variant="ghost" color="blue.600" fontWeight="600"
            leftIcon={<Check size={10} />}
            onClick={() => onChange(CRITERIA.map(c => c.id))}>
            Tout
          </Button>
          <Button size="xs" variant="ghost" color="gray.500"
            leftIcon={<RotateCcw size={10} />}
            onClick={() => onChange([...DEFAULT_CRITERIA])}>
            Défaut
          </Button>
          <Button size="xs" variant="ghost" color="red.400"
            leftIcon={<X size={10} />}
            onClick={() => onChange([])}>
            Aucun
          </Button>
        </HStack>
      </HStack>

      <VStack align="stretch" spacing={3} divider={<Divider />}>
        {Array.from(groups.entries()).map(([group, defs]) => (
          <Box key={group}>
            <Text fontSize="9px" fontWeight="700" color="gray.400" letterSpacing="0.08em"
              textTransform="uppercase" mb={2}>
              {group}
            </Text>
            <SimpleGrid columns={2} spacing={1.5}>
              {defs.map(c => (
                <Checkbox
                  key={c.id}
                  isChecked={active.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  colorScheme="blue"
                  size="sm"
                >
                  <Text fontSize="xs" color="gray.700">{c.label}</Text>
                </Checkbox>
              ))}
            </SimpleGrid>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function ComparatorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, removeItem, clearItems } = useComparator();

  const [activeCriteria, setActiveCriteria] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : [...DEFAULT_CRITERIA];
    } catch { return [...DEFAULT_CRITERIA]; }
  });

  const handleCriteriaChange = (ids: string[]) => {
    setActiveCriteria(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  };

  // Conserve l'ordre défini dans CRITERIA
  const orderedActive = CRITERIA.filter(c => activeCriteria.includes(c.id));

  if (items.length === 0) {
    return (
      <Flex direction="column" align="center" justify="center" minH="60vh" gap={5}>
        <Flex w={14} h={14} bg="gray.50" border="1px" borderColor="gray.200"
          rounded="md" align="center" justify="center">
          <Scale size={28} color="var(--chakra-colors-gray-400)" />
        </Flex>
        <Box textAlign="center">
          <Heading size="sm" color="gray.700" fontWeight="700" mb={1}>Aucun produit à comparer</Heading>
          <Text color="gray.400" fontSize="sm">Ajoutez jusqu'à 4 références depuis le catalogue.</Text>
        </Box>
        <Button leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/catalog')}
          colorScheme="blue" rounded="md" size="sm" bg="blue.800" _hover={{ bg: 'blue.700' }}
          fontSize="sm" fontWeight="600">
          Aller au catalogue
        </Button>
      </Flex>
    );
  }

  return (
    <VStack spacing={5} align="stretch">
      {/* En-tête */}
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <HStack spacing={3}>
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={13} />}
            onClick={() => navigate(-1)} color="gray.500" rounded="md" fontSize="sm">
            Retour
          </Button>
          <Heading size="sm" color="gray.800" fontWeight="700">Comparaison produits</Heading>
          <Badge colorScheme="blue" rounded="sm" px={2} fontSize="11px">{items.length}/4 références</Badge>
        </HStack>

        <HStack spacing={2}>
          {/* ─── Sélecteur de critères ─── */}
          <Popover placement="bottom-end" closeOnBlur>
            <PopoverTrigger>
              <Button
                size="sm" variant="outline" colorScheme="blue" rounded="md" fontSize="xs"
                leftIcon={<SlidersHorizontal size={12} />}
                rightIcon={
                  <Badge colorScheme="blue" rounded="full" fontSize="9px" ml={0.5}>
                    {activeCriteria.length}
                  </Badge>
                }
              >
                Critères
              </Button>
            </PopoverTrigger>
            <PopoverContent
              w="340px" shadow="2xl" rounded="xl" border="1px" borderColor="gray.200"
              _focus={{ outline: 'none' }}
            >
              <PopoverArrow />
              <PopoverCloseButton size="sm" top={2.5} right={2.5} />
              <PopoverHeader
                fontWeight="700" fontSize="sm" color="gray.800"
                borderBottom="1px" borderColor="gray.100" px={4} py={3}
              >
                <HStack spacing={2}>
                  <SlidersHorizontal size={14} />
                  <Text>Personnaliser les critères</Text>
                </HStack>
              </PopoverHeader>
              <PopoverBody px={4} py={4} maxH="420px" overflowY="auto"
                css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '4px' } }}>
                <CriteriaPanel active={activeCriteria} onChange={handleCriteriaChange} />
              </PopoverBody>
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="outline" colorScheme="red" leftIcon={<X size={12} />}
            onClick={clearItems} rounded="md" fontSize="xs">
            Vider
          </Button>
          <Button size="sm" colorScheme="blue" leftIcon={<Package size={12} />}
            onClick={() => navigate('/catalog')} rounded="md" bg="blue.800"
            _hover={{ bg: 'blue.700' }} fontSize="xs">
            Ajouter une référence
          </Button>
        </HStack>
      </Flex>

      {/* Tableau de comparaison */}
      <Box bg="white" rounded="xl" border="1px" borderColor="gray.200" overflow="hidden"
        boxShadow="0 1px 4px rgba(0,0,0,0.06)">
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr bg="gray.50">
                <Th
                  w="160px" minW="140px" color="gray.500" fontWeight="600"
                  fontSize="11px" py={4} borderBottom="2px" borderColor="gray.200"
                  textTransform="uppercase" letterSpacing="0.06em"
                  position="sticky" left={0} zIndex={1} bg="gray.50"
                >
                  Critère
                </Th>
                {items.map((p) => (
                  <Th key={p.id} py={4} borderBottom="2px" borderColor="gray.200" minW="200px">
                    <Flex justify="space-between" align="start" gap={2}>
                      <VStack align="start" spacing={1} minW={0}>
                        <Text fontWeight="700" color="gray.800" fontSize="sm" noOfLines={2} maxW="200px">
                          {p.name}
                        </Text>
                        {p.organisations?.name && (
                          <Text fontSize="10px" color="gray.400" noOfLines={1}>{p.organisations.name}</Text>
                        )}
                      </VStack>
                      <Tooltip label="Retirer" placement="top" hasArrow>
                        <IconButton
                          aria-label="Retirer du comparateur"
                          icon={<X size={11} />} size="xs"
                          variant="ghost" colorScheme="gray" rounded="md"
                          flexShrink={0}
                          onClick={() => removeItem(p.id)}
                        />
                      </Tooltip>
                    </Flex>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {/* Ligne image — toujours visible */}
              <Tr>
                <Td color="gray.400" fontSize="10px" fontWeight="600" textTransform="uppercase"
                  letterSpacing="0.05em" position="sticky" left={0} bg="white" zIndex={1}>
                  Image
                </Td>
                {items.map((p) => (
                  <Td key={p.id} py={3}>
                    <Box w="90px" h="70px" rounded="lg" overflow="hidden" bg="gray.50"
                      border="1px" borderColor="gray.200" cursor="pointer"
                      onClick={() => navigate(`/product/${p.id}`)}
                      _hover={{ borderColor: 'blue.400', boxShadow: 'sm' }}
                      transition="all 0.12s">
                      {p.images?.[0]
                        ? <Image src={p.images[0]} alt={p.name} w="full" h="full" objectFit="cover" />
                        : <Flex w="full" h="full" align="center" justify="center">
                            <Package size={22} color="var(--chakra-colors-gray-300)" />
                          </Flex>
                      }
                    </Box>
                  </Td>
                ))}
              </Tr>

              {/* Lignes dynamiques selon les critères sélectionnés */}
              {orderedActive.length === 0 ? (
                <Tr>
                  <Td colSpan={items.length + 1} textAlign="center" py={8}>
                    <VStack spacing={2}>
                      <SlidersHorizontal size={20} color="var(--chakra-colors-gray-300)" />
                      <Text fontSize="sm" color="gray.400">
                        Aucun critère sélectionné. Cliquez sur <strong>Critères</strong> pour en ajouter.
                      </Text>
                    </VStack>
                  </Td>
                </Tr>
              ) : (
                orderedActive.map((c, idx) => (
                  <Tr key={c.id} bg={idx % 2 === 0 ? 'white' : 'gray.50'}>
                    <Td
                      position="sticky" left={0} zIndex={1}
                      bg={idx % 2 === 0 ? 'white' : 'gray.50'}
                    >
                      <HStack spacing={1.5}>
                        <Box color="gray.400">{c.icon}</Box>
                        <Text color="gray.500" fontSize="10px" fontWeight="600"
                          textTransform="uppercase" letterSpacing="0.05em">
                          {c.label}
                        </Text>
                      </HStack>
                    </Td>
                    {items.map((p) => (
                      <Td key={p.id}>
                        <CriteriaCell criteriaId={c.id} p={p} user={user} navigate={navigate} />
                      </Td>
                    ))}
                  </Tr>
                ))
              )}

              {/* Ligne actions — toujours en bas */}
              <Tr bg="blue.50">
                <Td position="sticky" left={0} zIndex={1} bg="blue.50" />
                {items.map((p) => (
                  <Td key={p.id} py={4}>
                    <VStack spacing={2} align="stretch">
                      <Button size="xs" colorScheme="blue" rounded="md"
                        leftIcon={user ? <ShoppingCart size={12} /> : <Lock size={12} />}
                        isDisabled={!user} onClick={() => { if (!user) navigate('/auth'); }}
                        bg="blue.800" _hover={{ bg: 'blue.700' }} fontSize="xs" fontWeight="600">
                        Commander
                      </Button>
                      <Button size="xs" variant="outline" colorScheme="blue" rounded="md"
                        onClick={() => navigate(`/product/${p.id}`)} fontSize="xs">
                        Voir la fiche
                      </Button>
                    </VStack>
                  </Td>
                ))}
              </Tr>
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* Annonces sponsorisées */}
      <ComparatorAdsSection />

      {/* Bannière accès restreint */}
      {!user && (
        <Box bg="white" border="1px" borderColor="gray.200" rounded="xl" p={4} textAlign="center">
          <HStack justify="center" spacing={3} mb={2}>
            <Flex w={7} h={7} bg="blue.50" border="1px" borderColor="blue.200"
              rounded="sm" align="center" justify="center">
              <Lock size={14} color="var(--chakra-colors-blue-700)" />
            </Flex>
            <Text fontWeight="700" color="gray.800" fontSize="sm">
              Tarifs et MOQ réservés aux membres qualifiés
            </Text>
          </HStack>
          <Text color="gray.500" fontSize="sm" mb={4} lineHeight={1.6}>
            Déposez votre dossier professionnel pour accéder aux conditions tarifaires, au MOQ et passer commande.
          </Text>
          <HStack justify="center" spacing={3}>
            <Button colorScheme="blue" rounded="md" size="sm" onClick={() => navigate('/auth')}
              bg="blue.800" _hover={{ bg: 'blue.700' }} fontSize="xs" fontWeight="600">
              Déposer mon dossier
            </Button>
            <Button variant="outline" colorScheme="blue" rounded="md" size="sm"
              onClick={() => navigate('/auth')} fontSize="xs">
              Se connecter
            </Button>
          </HStack>
        </Box>
      )}
    </VStack>
  );
}
