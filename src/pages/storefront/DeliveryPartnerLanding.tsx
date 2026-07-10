import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  List,
  ListIcon,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  Tag,
  TagLabel,
  useBreakpointValue,
} from '@chakra-ui/react';
import {
  FaTruck,
  FaUserTie,
  FaCheckCircle,
  FaFileAlt,
  FaShieldAlt,
  FaMoneyBillWave,
  FaMapMarkedAlt,
  FaThermometerHalf,
  FaClipboardCheck,
  FaStar,
  FaArrowRight,
} from 'react-icons/fa';

// ── Sous-composants ────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <VStack spacing={0} align="center">
      <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="blue.600">
        {value}
      </Text>
      <Text fontSize="sm" color="gray.500" textAlign="center">
        {label}
      </Text>
    </VStack>
  );
}

function StepBadge({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <VStack align="start" spacing={2}>
      <Flex
        w={10} h={10}
        bg="blue.600" color="white"
        rounded="full" align="center" justify="center"
        fontWeight="800" fontSize="lg" flexShrink={0}
      >
        {n}
      </Flex>
      <Text fontWeight="700" fontSize="md">{title}</Text>
      <Text color="gray.500" fontSize="sm">{desc}</Text>
    </VStack>
  );
}

function RequirementList({ items }: { items: string[] }) {
  return (
    <List spacing={2}>
      {items.map((item) => (
        <ListItem key={item} display="flex" alignItems="flex-start" gap={2}>
          <ListIcon as={FaCheckCircle} color="blue.500" mt="3px" flexShrink={0} />
          <Text fontSize="sm" color="gray.700">{item}</Text>
        </ListItem>
      ))}
    </List>
  );
}

function BenefitCard({
  icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <VStack
      align="start"
      p={5}
      bg="white"
      border="1px solid"
      borderColor="gray.100"
      rounded="lg"
      spacing={3}
      h="full"
      _hover={{ borderColor: 'blue.200', shadow: 'sm' }}
      transition="all 0.15s"
    >
      <Flex w={10} h={10} bg="blue.50" rounded="md" align="center" justify="center">
        <Icon as={icon} color="blue.600" boxSize={5} />
      </Flex>
      <Text fontWeight="700" fontSize="sm">{title}</Text>
      <Text fontSize="sm" color="gray.500">{desc}</Text>
    </VStack>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function DeliveryPartnerLanding() {
  const navigate = useNavigate();
  const heroColumns = useBreakpointValue({ base: 1, lg: 2 });

  function goRegister(type?: 'logistics_company' | 'independent') {
    navigate('/auth', { state: { mode: 'signup', orgType: 'delivery', deliveryType: type } });
  }

  return (
    <Box bg="gray.50" minH="100vh">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <Box bg="white" borderBottom="1px solid" borderColor="gray.100" py={{ base: 12, md: 20 }}>
        <Container maxW="6xl">
          <Grid templateColumns={heroColumns === 2 ? '1fr 1fr' : '1fr'} gap={12} alignItems="center">
            <GridItem>
              <Stack spacing={6}>
                <Badge colorScheme="blue" w="fit-content" px={3} py={1} rounded="full" fontSize="xs" fontWeight="700" letterSpacing="wide">
                  RÉSEAU B2B FMCG — MAROC
                </Badge>
                <Heading as="h1" fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }} fontWeight="800" lineHeight={1.1} color="gray.900">
                  Rejoignez le réseau logistique
                  <Text as="span" color="blue.600"> Stock212</Text>
                </Heading>
                <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.500" maxW="480px">
                  Devenez partenaire de livraison FMCG B2B et accédez à un flux régulier de missions
                  sur l'ensemble du territoire marocain. Société logistique ou chauffeur indépendant —
                  nous avons un parcours pour vous.
                </Text>
                <HStack spacing={4} flexWrap="wrap">
                  <Button
                    size="lg"
                    colorScheme="blue"
                    rightIcon={<FaArrowRight />}
                    onClick={() => goRegister('logistics_company')}
                    px={8}
                  >
                    Société logistique
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    colorScheme="blue"
                    rightIcon={<FaArrowRight />}
                    onClick={() => goRegister('independent')}
                    px={8}
                  >
                    Chauffeur livreur
                  </Button>
                </HStack>
                <Text fontSize="xs" color="gray.400">
                  Inscription gratuite · Réponse sous 2 jours ouvrables · Aucun engagement initial
                </Text>
              </Stack>
            </GridItem>

            <GridItem display={{ base: 'none', lg: 'block' }}>
              {/* Stats panel */}
              <Box
                bg="blue.600"
                rounded="2xl"
                p={10}
                color="white"
              >
                <Text fontWeight="700" fontSize="lg" mb={8} opacity={0.9}>
                  Le réseau en chiffres
                </Text>
                <SimpleGrid columns={2} spacing={8}>
                  {[
                    { value: '12 régions', label: 'Couverture nationale' },
                    { value: '48h', label: 'Délai de validation dossier' },
                    { value: '100%', label: 'Missions traçables' },
                    { value: 'J+15', label: 'Délai de paiement' },
                  ].map((s) => (
                    <VStack key={s.value} align="start" spacing={0}>
                      <Text fontSize="2xl" fontWeight="800">{s.value}</Text>
                      <Text fontSize="sm" opacity={0.7}>{s.label}</Text>
                    </VStack>
                  ))}
                </SimpleGrid>
              </Box>
            </GridItem>
          </Grid>
        </Container>
      </Box>

      {/* ── DEUX PARCOURS ─────────────────────────────────────────────────── */}
      <Container maxW="6xl" py={{ base: 12, md: 16 }}>
        <VStack spacing={3} mb={10} textAlign="center">
          <Heading fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="gray.900">
            Choisissez votre parcours
          </Heading>
          <Text color="gray.500" maxW="480px">
            Deux profils, deux expériences adaptées à votre activité dans la logistique FMCG B2B.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>

          {/* Carte 3PL */}
          <Box
            bg="white"
            border="2px solid"
            borderColor="blue.100"
            rounded="xl"
            p={8}
            _hover={{ borderColor: 'blue.400', shadow: 'md' }}
            transition="all 0.2s"
            cursor="pointer"
            onClick={() => goRegister('logistics_company')}
          >
            <VStack align="start" spacing={5}>
              <Flex
                w={14} h={14}
                bg="blue.600"
                rounded="xl"
                align="center"
                justify="center"
              >
                <Icon as={FaTruck} color="white" boxSize={7} />
              </Flex>

              <Stack spacing={1}>
                <HStack>
                  <Heading fontSize="xl" fontWeight="800" color="gray.900">
                    Société logistique
                  </Heading>
                  <Tag colorScheme="blue" size="sm" rounded="full">
                    <TagLabel>3PL</TagLabel>
                  </Tag>
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  Transporteur agréé avec flotte propre, agissant pour plusieurs expéditeurs B2B.
                </Text>
              </Stack>

              <Divider />

              <Stack spacing={2} w="full">
                <Text fontWeight="700" fontSize="sm" color="gray.700">Ce que vous recevez :</Text>
                <RequirementList
                  items={[
                    'Tickets de livraison pré-assignés à votre société',
                    'Contrats de service avec niveaux de SLA',
                    'Facturation mensuelle consolidée',
                    'Accès aux outils de traçabilité FMCG (chaîne du froid)',
                    'Support dédié aux 3PL',
                  ]}
                />
              </Stack>

              <Divider />

              <Stack spacing={2} w="full">
                <Text fontWeight="700" fontSize="sm" color="gray.700">Documents requis :</Text>
                <RequirementList
                  items={[
                    'Registre de commerce + carte fiscale',
                    'Attestation assurance marchandises et RC',
                    'Liste de flotte avec immatriculations',
                    'Licence transport alimentaire (si FMCG réfrigéré)',
                  ]}
                />
              </Stack>

              <Button
                colorScheme="blue"
                size="md"
                w="full"
                rightIcon={<FaArrowRight />}
                onClick={(e) => { e.stopPropagation(); goRegister('logistics_company'); }}
              >
                Candidater en tant que société logistique
              </Button>
            </VStack>
          </Box>

          {/* Carte chauffeur indépendant */}
          <Box
            bg="white"
            border="2px solid"
            borderColor="gray.100"
            rounded="xl"
            p={8}
            _hover={{ borderColor: 'blue.300', shadow: 'md' }}
            transition="all 0.2s"
            cursor="pointer"
            onClick={() => goRegister('independent')}
          >
            <VStack align="start" spacing={5}>
              <Flex
                w={14} h={14}
                bg="gray.700"
                rounded="xl"
                align="center"
                justify="center"
              >
                <Icon as={FaUserTie} color="white" boxSize={6} />
              </Flex>

              <Stack spacing={1}>
                <HStack>
                  <Heading fontSize="xl" fontWeight="800" color="gray.900">
                    Chauffeur livreur
                  </Heading>
                  <Tag colorScheme="gray" size="sm" rounded="full">
                    <TagLabel>Indépendant</TagLabel>
                  </Tag>
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  Freelance ou auto-entrepreneur rejoignant le réseau de livraison interne Stock212.
                </Text>
              </Stack>

              <Divider />

              <Stack spacing={2} w="full">
                <Text fontWeight="700" fontSize="sm" color="gray.700">Ce que vous recevez :</Text>
                <RequirementList
                  items={[
                    'Accès au pool de tickets disponibles (acceptation libre)',
                    'Planification flexible selon vos disponibilités',
                    'Paiement à la mission + gestion des frais de déplacement',
                    'Application mobile de suivi des livraisons',
                    'Formation hygiène alimentaire prise en charge (si requise)',
                  ]}
                />
              </Stack>

              <Divider />

              <Stack spacing={2} w="full">
                <Text fontWeight="700" fontSize="sm" color="gray.700">Documents requis :</Text>
                <RequirementList
                  items={[
                    'Permis de conduire valide (catégorie B minimum)',
                    'Carte grise véhicule (si véhicule personnel)',
                    'Certificat médical d\'aptitude',
                    'Casier judiciaire (Bulletin n°3)',
                  ]}
                />
              </Stack>

              <Button
                variant="outline"
                colorScheme="blue"
                size="md"
                w="full"
                rightIcon={<FaArrowRight />}
                onClick={(e) => { e.stopPropagation(); goRegister('independent'); }}
              >
                Candidater en tant que chauffeur
              </Button>
            </VStack>
          </Box>
        </SimpleGrid>
      </Container>

      {/* ── COMMENT ÇA MARCHE ─────────────────────────────────────────────── */}
      <Box bg="white" borderTop="1px solid" borderBottom="1px solid" borderColor="gray.100" py={{ base: 12, md: 16 }}>
        <Container maxW="6xl">
          <VStack spacing={3} mb={12} textAlign="center">
            <Heading fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="gray.900">
              Comment ça marche ?
            </Heading>
            <Text color="gray.500" maxW="460px">
              De la candidature à la première mission, le processus prend en général 3 à 5 jours ouvrables.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={8}>
            <StepBadge
              n={1}
              title="Créez votre compte"
              desc="Renseignez vos informations de base et choisissez votre type de partenariat."
            />
            <StepBadge
              n={2}
              title="Complétez votre profil"
              desc="Zones de couverture, types de véhicules, capacités FMCG (chaîne du froid, congelé…)."
            />
            <StepBadge
              n={3}
              title="Téléversez vos documents"
              desc="Registre de commerce, assurances, permis, licences. Drag & drop sécurisé."
            />
            <StepBadge
              n={4}
              title="Validation admin"
              desc="Notre équipe examine votre dossier. Réponse sous 48h. Accès immédiat après approbation."
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── AVANTAGES ─────────────────────────────────────────────────────── */}
      <Container maxW="6xl" py={{ base: 12, md: 16 }}>
        <VStack spacing={3} mb={10} textAlign="center">
          <Heading fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="gray.900">
            Pourquoi rejoindre Stock212 ?
          </Heading>
          <Text color="gray.500" maxW="460px">
            Une plateforme conçue pour les professionnels de la logistique FMCG B2B.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
          <BenefitCard
            icon={FaMapMarkedAlt}
            title="Couverture nationale"
            desc="12 régions marocaines, des commandes récurrentes depuis les grandes zones industrielles et commerciales."
          />
          <BenefitCard
            icon={FaMoneyBillWave}
            title="Paiement fiable"
            desc="Règlement sous 15 jours après livraison confirmée. Historique et relevés accessibles en ligne."
          />
          <BenefitCard
            icon={FaThermometerHalf}
            title="Spécialisation FMCG"
            desc="Marchandises alimentaires, produits réfrigérés et congelés, hygiène. Tickets adaptés à vos capacités."
          />
          <BenefitCard
            icon={FaShieldAlt}
            title="Assurance et conformité"
            desc="Couverture des litiges gérée par Stock212. Conformité documentaire vérifiée à l'entrée."
          />
          <BenefitCard
            icon={FaClipboardCheck}
            title="Traçabilité complète"
            desc="Bons de livraison, ordres de mission, notes de frais — tout généré automatiquement en PDF."
          />
          <BenefitCard
            icon={FaStar}
            title="Notation et visibilité"
            desc="Plus votre note est haute, plus vous recevez de missions. Tableau de bord de performance en temps réel."
          />
        </SimpleGrid>
      </Container>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <Box bg="white" borderTop="1px solid" borderColor="gray.100" py={{ base: 12, md: 16 }}>
        <Container maxW="3xl">
          <VStack spacing={3} mb={10} textAlign="center">
            <Heading fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="gray.900">
              Questions fréquentes
            </Heading>
          </VStack>

          <Accordion allowToggle>
            {[
              {
                q: "Combien de temps prend la validation de mon dossier ?",
                a: "Notre équipe s'engage à examiner les dossiers complets dans les 2 jours ouvrables. Si des documents complémentaires sont nécessaires, vous recevrez une notification in-app et par email précisant exactement ce qui est attendu.",
              },
              {
                q: "Puis-je candidater si je n'ai pas encore de véhicule ?",
                a: "Les chauffeurs indépendants peuvent indiquer qu'ils utiliseraient un véhicule fourni par Stock212. Dans ce cas, la carte grise n'est pas requise, mais vous devez disposer d'un permis valide et d'un certificat médical d'aptitude à la conduite.",
              },
              {
                q: "La licence transport alimentaire est-elle obligatoire ?",
                a: "Elle est obligatoire uniquement pour les livraisons de produits FMCG réfrigérés (0–4°C) ou congelés (≤ −18°C). Pour les produits ambiants, cette licence n'est pas requise. Si vous ne l'avez pas encore, vous pouvez soumettre votre dossier et l'ajouter ultérieurement.",
              },
              {
                q: "Que se passe-t-il si mon dossier est refusé ?",
                a: "Vous recevrez un email détaillant le motif du refus. Dans la majorité des cas, il s'agit d'un document manquant ou d'une assurance insuffisante. Vous pouvez corriger et re-soumettre un nouveau dossier sans délai d'attente imposé.",
              },
              {
                q: "Comment sont attribués les tickets de livraison ?",
                a: "Les sociétés 3PL partenaires reçoivent des tickets pré-assignés choisis par l'acheteur lors de sa commande. Les chauffeurs indépendants accèdent à un pool de tickets disponibles et choisissent librement les missions qui correspondent à leurs zones et disponibilités.",
              },
              {
                q: "Mon compte peut-il être suspendu après validation ?",
                a: "Oui, en cas de non-conformité avérée (plainte fondée, document expiré, incident grave de livraison). La suspension est notifiée immédiatement et peut être levée après résolution du problème avec notre équipe support.",
              },
            ].map(({ q, a }) => (
              <AccordionItem key={q} border="none" mb={2}>
                <AccordionButton
                  bg="gray.50"
                  rounded="lg"
                  px={5}
                  py={4}
                  _hover={{ bg: 'gray.100' }}
                  _expanded={{ bg: 'blue.50', color: 'blue.700' }}
                >
                  <Box flex="1" textAlign="left" fontWeight="600" fontSize="sm">
                    {q}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={5} py={4} fontSize="sm" color="gray.600" bg="white" rounded="lg">
                  {a}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </Box>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <Box bg="blue.600" py={{ base: 14, md: 20 }}>
        <Container maxW="3xl" textAlign="center">
          <VStack spacing={6}>
            <Heading fontSize={{ base: '2xl', md: '4xl' }} fontWeight="800" color="white">
              Prêt à rejoindre le réseau ?
            </Heading>
            <Text color="blue.100" fontSize={{ base: 'md', md: 'lg' }} maxW="460px">
              Déposez votre candidature gratuitement. Notre équipe vous recontacte sous 48 heures.
            </Text>
            <HStack spacing={4} flexWrap="wrap" justify="center">
              <Button
                size="lg"
                bg="white"
                color="blue.700"
                fontWeight="700"
                px={8}
                _hover={{ bg: 'blue.50' }}
                rightIcon={<FaTruck />}
                onClick={() => goRegister('logistics_company')}
              >
                Je suis une société 3PL
              </Button>
              <Button
                size="lg"
                variant="outline"
                color="white"
                borderColor="whiteAlpha.600"
                fontWeight="700"
                px={8}
                _hover={{ bg: 'whiteAlpha.200' }}
                rightIcon={<FaUserTie />}
                onClick={() => goRegister('independent')}
              >
                Je suis chauffeur livreur
              </Button>
            </HStack>
            <Text color="blue.200" fontSize="xs">
              Déjà partenaire ?{' '}
              <Button
                variant="link"
                color="white"
                fontSize="xs"
                fontWeight="600"
                onClick={() => navigate('/auth')}
              >
                Se connecter
              </Button>
            </Text>
          </VStack>
        </Container>
      </Box>

    </Box>
  );
}
