import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Heading, Text, VStack, HStack, SimpleGrid, Button,
  Accordion, AccordionItem, AccordionButton, AccordionPanel,
  AccordionIcon, Grid, GridItem, Textarea, Input, FormControl,
  FormLabel, useToast, Divider,
} from '@chakra-ui/react';
import {
  UserPlus, Search, ShoppingCart, Truck, ArrowRight, CheckCircle,
  Shield, Star, Globe, Zap, Package, FileText, MessageCircle,
  Building2, Mail, Phone,
} from 'lucide-react';

const STEPS_BUYER = [
  {
    step: '01',
    icon: UserPlus,
    color: 'blue',
    title: 'Déposez votre dossier professionnel',
    desc: 'Renseignez les informations légales de votre entreprise (SIRET, RC, type d\'établissement). Votre dossier est examiné sous 48h par notre équipe de qualification.',
    details: ['Vérification SIRET / RC', 'Qualification sous 48h ouvrées', 'Accès immédiat après validation'],
  },
  {
    step: '02',
    icon: Search,
    color: 'blue',
    title: 'Explorez et comparez les offres',
    desc: 'Parcourez plus de 10 000 références B2B. Filtrez par catégorie GS1, certifications, température de conservation, origine et disponibilité. Comparez jusqu\'à 4 produits côte à côte.',
    details: ['Filtres taxonomie GS1', 'Comparateur multi-vendeurs', 'Fiches produit détaillées'],
  },
  {
    step: '03',
    icon: FileText,
    color: 'blue',
    title: 'Commandez ou demandez un devis',
    desc: 'Passez commande avec les tarifs dégressifs appliqués automatiquement selon vos volumes. Pour des volumes importants ou conditions spécifiques, soumettez une demande de devis.',
    details: ['Paliers prix automatiques', 'Réponse devis sous 24h', 'Multi-vendeurs par panier'],
  },
  {
    step: '04',
    icon: Truck,
    color: 'blue',
    title: 'Réception et suivi de livraison',
    desc: 'Sélectionnez votre transporteur parmi notre réseau certifié. Suivi de commande en temps réel. En cas de litige, notre équipe intervient dans les 48h ouvrées.',
    details: ['Suivi temps réel', 'Transporteurs certifiés', 'Protection acheteur garantie'],
  },
];

const FAQS = [
  {
    q: 'Comment fonctionne la qualification du dossier ?',
    a: 'Vous déposez votre dossier (SIRET ou RC, type d\'activité, informations légales). Notre équipe vérifie votre dossier sous 48h ouvrées. Une fois approuvé, vous accédez aux tarifs et pouvez passer commande.',
  },
  {
    q: 'Quels types d\'entreprises peuvent s\'inscrire ?',
    a: 'Cafés, restaurants, hôtels, supermarchés, épiceries, traiteurs, distributeurs, grossistes — tout professionnel ayant un besoin structuré en approvisionnement FMCG peut déposer un dossier acheteur.',
  },
  {
    q: 'Les tarifs sont-ils visibles sans qualification ?',
    a: 'Non. Pour garantir la confidentialité des conditions commerciales B2B, les tarifs, paliers de prix et conditions (MOQ, délais) ne sont accessibles qu\'après validation de votre dossier professionnel.',
  },
  {
    q: 'Comment fonctionne la demande de devis ?',
    a: 'Depuis la fiche produit ou votre tableau de bord, soumettez une demande de devis en précisant volume souhaité, incoterm et délais. Le fournisseur vous soumet sa proposition sous 24h ouvrées.',
  },
  {
    q: 'Peut-on commander chez plusieurs fournisseurs simultanément ?',
    a: 'Oui. Votre panier peut contenir des articles de plusieurs fournisseurs. Chaque commande est traitée séparément mais vous gérez l\'ensemble depuis un seul tableau de bord acheteur.',
  },
  {
    q: 'Quelle est la procédure en cas de litige à la livraison ?',
    a: 'Ouvrez un ticket de litige directement depuis votre espace (casse, manquant, DLC, mauvais produit). Notre équipe intervient sous 48h ouvrées pour arbitrer avec le fournisseur et le transporteur.',
  },
  {
    q: 'Comment les fournisseurs sont-ils vérifiés ?',
    a: 'Chaque fournisseur passe par un processus de vérification complet : documents légaux (SIRET, Kbis ou équivalent), certifications produits (IFS, BRC, ISO 22000), et évaluation de capacité avant activation.',
  },
  {
    q: 'Dans quels pays la plateforme est-elle disponible ?',
    a: 'Stock212 couvre actuellement la France, le Maroc, l\'Algérie, la Tunisie, le Sénégal et plusieurs pays d\'Afrique francophone. Le réseau s\'étend régulièrement.',
  },
];

const VALUE_PROPS = [
  { icon: Shield, color: 'blue', title: 'Fournisseurs 100% vérifiés', desc: 'Documents légaux, certifications et capacité contrôlés avant activation sur la plateforme.' },
  { icon: Zap, color: 'blue', title: 'Paliers prix automatiques', desc: 'Les remises volume s\'appliquent automatiquement selon les quantités commandées.' },
  { icon: Globe, color: 'blue', title: 'Réseau international', desc: 'Transporteurs certifiés pour la France, le Maroc et l\'Afrique francophone.' },
  { icon: Star, color: 'blue', title: 'Évaluations vérifiées', desc: 'Toutes les évaluations proviennent d\'acheteurs ayant réellement réceptionné une commande.' },
  { icon: Package, color: 'blue', title: '10 000+ références actives', desc: 'Le plus grand catalogue B2B FMCG en ligne pour les professionnels de la région.' },
  { icon: MessageCircle, color: 'blue', title: 'Support dédié', desc: 'Équipe disponible pour vous accompagner à chaque étape, du dossier à la livraison.' },
];

export default function HowItWorksPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [role, setRole] = useState<'buyer' | 'seller' | 'delivery'>('buyer');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setContactForm({ name: '', email: '', message: '' });
      toast({
        title: 'Message transmis',
        description: 'Notre équipe vous répondra dans les 24h ouvrées.',
        status: 'success',
        duration: 4000,
      });
    }, 800);
  }

  return (
    <VStack spacing={14} align="stretch">

      {/* ── EN-TÊTE — remplace hero Pexels ── */}
      <Box
        bg="blue.900"
        rounded="md"
        overflow="hidden"
        position="relative"
        minH={{ base: '220px', md: '280px' }}
      >
        {/* Accents géométriques */}
        <Box
          position="absolute" top={0} right={0}
          w="0" h="0"
          style={{
            borderLeft: '400px solid transparent',
            borderTop: '400px solid rgba(255,255,255,0.025)',
          }}
        />
        <Box
          position="absolute" bottom="-50px" left="-50px"
          w="220px" h="220px"
          bg="blue.800"
          style={{ clipPath: 'circle()' }}
        />

        <Flex
          position="relative"
          align="center"
          justify="center"
          minH={{ base: '220px', md: '280px' }}
          p={{ base: 8, md: 14 }}
        >
          <VStack spacing={5} textAlign="center" maxW="580px">
            <Box>
              <Text fontSize="11px" color="blue.300" fontWeight="700" letterSpacing="0.12em"
                textTransform="uppercase" mb={3}>
                Guide de la plateforme
              </Text>
              <Heading
                size={{ base: 'xl', md: '2xl' }}
                color="white"
                lineHeight={1.1}
                fontWeight="800"
                letterSpacing="-0.02em"
              >
                Comment fonctionne Stock212 ?
              </Heading>
            </Box>
            <Text color="blue.200" fontSize={{ base: 'sm', md: 'md' }} lineHeight={1.8} maxW="460px">
              La marketplace B2B d'approvisionnement FMCG pour les professionnels de la France,
              du Maroc et de l'Afrique francophone.
            </Text>
            <HStack spacing={3} flexWrap="wrap" justify="center" pt={2}>
              <Button
                bg="white"
                color="blue.900"
                size="md"
                rounded="md"
                rightIcon={<ArrowRight size={14} />}
                onClick={() => navigate('/auth')}
                fontWeight="700"
                _hover={{ bg: 'blue.50' }}
                fontSize="sm"
              >
                Déposer mon dossier
              </Button>
              <Button
                variant="outline"
                color="white"
                borderColor="blue.700"
                size="md"
                rounded="md"
                onClick={() => navigate('/catalog')}
                _hover={{ bg: 'blue.800' }}
                fontSize="sm"
              >
                Explorer le catalogue
              </Button>
            </HStack>
          </VStack>
        </Flex>
      </Box>

      {/* ── SÉLECTEUR DE RÔLE ── */}
      <Box>
        <VStack spacing={2} mb={8} textAlign="center">
          <Heading size="lg" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Votre profil sur la plateforme
          </Heading>
          <Text color="gray.500" fontSize="sm">
            Stock212 s'adapte à votre rôle dans la chaîne d'approvisionnement FMCG.
          </Text>
        </VStack>
        <Flex justify="center" mb={10}>
          <HStack bg="gray.100" rounded="md" p={0.5} spacing={0.5}>
            {[
              { key: 'buyer', label: 'Acheteur', icon: ShoppingCart },
              { key: 'seller', label: 'Fournisseur', icon: Building2 },
              { key: 'delivery', label: 'Transporteur', icon: Truck },
            ].map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                size="sm"
                rounded="sm"
                bg={role === key ? 'white' : 'transparent'}
                shadow={role === key ? 'sm' : 'none'}
                color={role === key ? 'blue.800' : 'gray.500'}
                leftIcon={<Icon size={13} />}
                onClick={() => setRole(key as typeof role)}
                fontWeight={role === key ? '600' : '400'}
                fontSize="sm"
                _hover={{ bg: role === key ? 'white' : 'gray.200' }}
                transition="all 0.15s"
                px={5}
              >
                {label}
              </Button>
            ))}
          </HStack>
        </Flex>

        {/* Étapes du parcours */}
        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
          gap={4}
        >
          {STEPS_BUYER.map(({ step, icon: Icon, color, title, desc, details }) => (
            <Box
              key={step}
              bg="white"
              rounded="md"
              p={5}
              border="1px"
              borderColor="gray.200"
              _hover={{ borderColor: 'blue.200' }}
              transition="border-color 0.15s"
              position="relative"
            >
              <Text
                position="absolute" top={4} right={5}
                fontSize="4xl" fontWeight="800" color="gray.50"
                lineHeight={1} userSelect="none"
              >
                {step}
              </Text>
              <Flex
                w={10} h={10}
                bg={`${color}.50`}
                border="1px" borderColor={`${color}.200`}
                rounded="sm"
                align="center" justify="center"
                mb={4}
              >
                <Icon size={19} color={`var(--chakra-colors-${color}-700)`} />
              </Flex>
              <Text fontWeight="700" color="gray.900" mb={2} fontSize="sm" lineHeight={1.3}>
                {title}
              </Text>
              <Text fontSize="sm" color="gray.500" lineHeight={1.7} mb={4}>{desc}</Text>
              <VStack align="start" spacing={1.5}>
                {details.map((d) => (
                  <HStack key={d} spacing={2}>
                    <CheckCircle size={12} color="var(--chakra-colors-green-500)" />
                    <Text fontSize="xs" color="gray.600">{d}</Text>
                  </HStack>
                ))}
              </VStack>
            </Box>
          ))}
        </Grid>
      </Box>

      {/* ── CTA STRIP — remplace le gradient SaaS ── */}
      <Box
        bg="blue.900"
        border="1px"
        borderColor="blue.800"
        rounded="md"
        p={{ base: 8, md: 10 }}
        textAlign="center"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute" top={0} right={0}
          w="0" h="0"
          style={{
            borderLeft: '300px solid transparent',
            borderTop: '300px solid rgba(255,255,255,0.02)',
          }}
        />
        <VStack spacing={4} position="relative">
          <Heading size="md" color="white" fontWeight="700" letterSpacing="-0.01em">
            Prêt à rejoindre le réseau ?
          </Heading>
          <Text color="blue.200" maxW="460px" mx="auto" lineHeight={1.7} fontSize="sm">
            Déposez votre dossier professionnel et accédez à l'ensemble du catalogue
            avec conditions tarifaires et outils de gestion.
          </Text>
          <HStack justify="center" spacing={3} flexWrap="wrap" pt={2}>
            <Button
              bg="white"
              color="blue.900"
              size="md"
              rounded="md"
              rightIcon={<ArrowRight size={14} />}
              onClick={() => navigate('/auth')}
              fontWeight="700"
              _hover={{ bg: 'blue.50' }}
              fontSize="sm"
            >
              Déposer mon dossier
            </Button>
            <Button
              variant="outline"
              color="white"
              borderColor="blue.700"
              size="md"
              rounded="md"
              onClick={() => navigate('/catalog')}
              _hover={{ bg: 'blue.800' }}
              fontSize="sm"
            >
              Parcourir sans compte
            </Button>
          </HStack>
        </VStack>
      </Box>

      {/* ── POURQUOI STOCK212 ── */}
      <Box>
        <VStack spacing={2} mb={8} textAlign="center">
          <Heading size="md" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Pourquoi choisir Stock212 ?
          </Heading>
          <Text color="gray.500" fontSize="sm">
            Une infrastructure conçue pour les exigences des professionnels du FMCG.
          </Text>
        </VStack>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
          {VALUE_PROPS.map(({ icon: Icon, color, title, desc }) => (
            <HStack
              key={title}
              bg="white"
              rounded="md"
              p={4}
              border="1px"
              borderColor="gray.200"
              align="start"
              spacing={4}
            >
              <Flex
                w={9} h={9}
                bg={`${color}.50`}
                border="1px" borderColor={`${color}.200`}
                rounded="sm"
                align="center" justify="center"
                flexShrink={0}
              >
                <Icon size={17} color={`var(--chakra-colors-${color}-700)`} />
              </Flex>
              <Box>
                <Text fontWeight="700" color="gray.800" mb={1} fontSize="sm">{title}</Text>
                <Text fontSize="sm" color="gray.500" lineHeight={1.6}>{desc}</Text>
              </Box>
            </HStack>
          ))}
        </SimpleGrid>
      </Box>

      {/* ── FAQ ── */}
      <Box>
        <VStack spacing={2} mb={8} textAlign="center">
          <Heading size="md" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Questions fréquentes
          </Heading>
          <Text color="gray.500" fontSize="sm">
            Tout ce que vous devez savoir avant de déposer votre dossier.
          </Text>
        </VStack>
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={3}>
          {FAQS.map(({ q, a }) => (
            <Accordion key={q} allowToggle>
              <AccordionItem
                border="1px"
                borderColor="gray.200"
                rounded="md"
                overflow="hidden"
                bg="white"
                mb={0}
              >
                <AccordionButton
                  px={5} py={4}
                  _hover={{ bg: 'gray.50' }}
                  _expanded={{ bg: 'blue.50', color: 'blue.800' }}
                >
                  <Text flex={1} textAlign="left" fontWeight="600" fontSize="sm" lineHeight={1.4}>
                    {q}
                  </Text>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel px={5} pb={5} pt={3}>
                  <Text fontSize="sm" color="gray.600" lineHeight={1.7}>{a}</Text>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          ))}
        </Grid>
      </Box>

      {/* ── CONTACT ── */}
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
        <Box bg="white" rounded="md" p={6} border="1px" borderColor="gray.200">
          <Heading size="sm" color="gray.900" mb={1} fontWeight="700">Vous avez une autre question ?</Heading>
          <Text color="gray.500" fontSize="sm" mb={5} lineHeight={1.6}>
            Notre équipe répond sous 24h ouvrées, du lundi au vendredi.
          </Text>
          <form onSubmit={handleContact}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                  textTransform="uppercase" letterSpacing="0.05em">
                  Votre nom
                </FormLabel>
                <Input
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Prénom Nom" rounded="sm" fontSize="sm"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                  textTransform="uppercase" letterSpacing="0.05em">
                  E-mail professionnel
                </FormLabel>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="vous@entreprise.com" rounded="sm" fontSize="sm"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                  textTransform="uppercase" letterSpacing="0.05em">
                  Votre demande
                </FormLabel>
                <Textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Décrivez votre demande..." rounded="sm" fontSize="sm" rows={4}
                />
              </FormControl>
              <Button
                type="submit"
                colorScheme="blue"
                w="full"
                rounded="md"
                isLoading={sending}
                leftIcon={<Mail size={14} />}
                bg="blue.800"
                _hover={{ bg: 'blue.700' }}
                fontSize="sm"
                fontWeight="600"
              >
                Envoyer
              </Button>
            </VStack>
          </form>
        </Box>

        <VStack spacing={4} align="stretch">
          <Box bg="white" rounded="md" p={5} border="1px" borderColor="gray.200">
            <HStack spacing={3} mb={2}>
              <Flex
                w={8} h={8}
                bg="blue.50"
                border="1px" borderColor="blue.200"
                rounded="sm"
                align="center" justify="center"
              >
                <Mail size={15} color="var(--chakra-colors-blue-700)" />
              </Flex>
              <Box>
                <Text fontWeight="600" color="gray.800" fontSize="sm">E-mail</Text>
                <Text color="blue.700" fontSize="sm">contact@stock212.com</Text>
              </Box>
            </HStack>
            <Text color="gray.400" fontSize="xs">Réponse garantie sous 24h ouvrées</Text>
          </Box>

          <Box bg="white" rounded="md" p={5} border="1px" borderColor="gray.200">
            <HStack spacing={3} mb={2}>
              <Flex
                w={8} h={8}
                bg="green.50"
                border="1px" borderColor="green.200"
                rounded="sm"
                align="center" justify="center"
              >
                <Phone size={15} color="var(--chakra-colors-green-700)" />
              </Flex>
              <Box>
                <Text fontWeight="600" color="gray.800" fontSize="sm">Téléphone</Text>
                <Text color="green.700" fontSize="sm">+33 1 XX XX XX XX</Text>
              </Box>
            </HStack>
            <Text color="gray.400" fontSize="xs">Lun–Ven · 9h–18h (heure de Paris)</Text>
          </Box>

          <Box bg="blue.900" rounded="md" p={5} border="1px" borderColor="blue.800">
            <Text
              fontSize="10px" color="blue.300" fontWeight="700" letterSpacing="0.1em"
              textTransform="uppercase" mb={2}
            >
              Accès professionnel
            </Text>
            <Heading size="sm" color="white" mb={2} fontWeight="700">
              Démarrez maintenant
            </Heading>
            <Text color="blue.200" fontSize="sm" mb={4} lineHeight={1.6}>
              Déposez votre dossier d'entreprise et accédez au catalogue complet
              avec conditions tarifaires négociées.
            </Text>
            <Button
              colorScheme="blue"
              w="full"
              rounded="md"
              rightIcon={<ArrowRight size={13} />}
              onClick={() => navigate('/auth')}
              bg="blue.700"
              _hover={{ bg: 'blue.600' }}
              fontSize="sm"
              fontWeight="600"
            >
              Déposer mon dossier
            </Button>
          </Box>
        </VStack>
      </Grid>

    </VStack>
  );
}
