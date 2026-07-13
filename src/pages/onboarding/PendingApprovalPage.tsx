import { Box, Flex, Heading, Text, VStack, HStack, Button } from '@chakra-ui/react';
import { Package, Clock, Phone, CheckCircle, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
export default function PendingApprovalPage() {
  const { profile, activeOrg, signOut } = useAuth();
  const navigate = useNavigate();

  const orgTypeLabel =
    activeOrg?.org_type === 'seller'   ? 'fournisseur' :
    activeOrg?.org_type === 'delivery' ? 'transporteur' :
    'acheteur';

  return (
    <Flex minH="100vh" bg="gray.50" align="center" justify="center" p={4}>
      <Box bg="white" border="1px" borderColor="gray.200" rounded="md" p={8} w="full" maxW="520px">

        {/* Logo */}
        <HStack spacing={2} mb={8}>
          <Flex w={7} h={7} bg="blue.900" rounded="sm" align="center" justify="center">
            <Package size={15} color="white" />
          </Flex>
          <Text fontWeight="800" fontSize="sm" color="gray.900" letterSpacing="-0.01em">
            Stock212
          </Text>
        </HStack>

        {/* Icône statut */}
        <Flex
          w={14} h={14} bg="amber.50" border="1px" borderColor="amber.200"
          rounded="full" align="center" justify="center" mb={5}
          style={{ background: '#fffbeb', borderColor: '#fde68a' }}
        >
          <Clock size={26} color="#d97706" />
        </Flex>

        <VStack spacing={2} align="start" mb={6}>
          <Heading size="sm" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
            Dossier reçu — validation en cours
          </Heading>
          <Text fontSize="sm" color="gray.500">
            Bonjour{profile?.full_name ? ` ${profile.full_name}` : ''}, votre dossier{' '}
            <Text as="span" fontWeight="600" color="gray.700">{orgTypeLabel}</Text>{' '}
            {activeOrg?.name ? `« ${activeOrg.name} »` : ''} a bien été soumis.
          </Text>
        </VStack>

        {/* Étapes de validation */}
        <VStack spacing={3} align="stretch" mb={7}>
          <HStack spacing={3} p={3} bg="green.50" rounded="md" border="1px" borderColor="green.100">
            <Flex w={7} h={7} bg="green.100" rounded="full" align="center" justify="center" flexShrink={0}>
              <CheckCircle size={15} color="#16a34a" />
            </Flex>
            <Box>
              <Text fontSize="xs" fontWeight="700" color="green.800">Dossier soumis</Text>
              <Text fontSize="11px" color="green.600">Vos informations ont bien été reçues</Text>
            </Box>
          </HStack>

          <HStack spacing={3} p={3} bg="blue.50" rounded="md" border="1px" borderColor="blue.100">
            <Flex w={7} h={7} bg="blue.100" rounded="full" align="center" justify="center" flexShrink={0}>
              <Phone size={15} color="#1d4ed8" />
            </Flex>
            <Box>
              <Text fontSize="xs" fontWeight="700" color="blue.800">Appel commercial</Text>
              <Text fontSize="11px" color="blue.600">
                Un de nos commerciaux va vous contacter sous 24–48h ouvrées pour valider votre profil
              </Text>
            </Box>
          </HStack>

          <HStack spacing={3} p={3} bg="gray.50" rounded="md" border="1px" borderColor="gray.200">
            <Flex w={7} h={7} bg="gray.100" rounded="full" align="center" justify="center" flexShrink={0}>
              <CheckCircle size={15} color="#9ca3af" />
            </Flex>
            <Box>
              <Text fontSize="xs" fontWeight="700" color="gray.500">Accès activé</Text>
              <Text fontSize="11px" color="gray.400">
                Une fois validé, vous aurez accès à toutes les fonctionnalités de la plateforme
              </Text>
            </Box>
          </HStack>
        </VStack>

        {/* Contact */}
        <Box p={4} bg="gray.50" rounded="md" border="1px" borderColor="gray.200" mb={6}>
          <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase"
            letterSpacing="0.06em" mb={2}>
            Une question ?
          </Text>
          <HStack spacing={2}>
            <Mail size={13} color="#6b7280" />
            <Text fontSize="sm" color="gray.600">
              Contactez-nous à{' '}
              <Text as="a" href="mailto:commercial@stock212.com" color="blue.600" fontWeight="600">
                commercial@stock212.com
              </Text>
            </Text>
          </HStack>
        </Box>

        <Button
          variant="ghost"
          size="sm"
          color="gray.400"
          fontSize="xs"
         onClick={async () => { await signOut(); navigate('/auth'); }}
          w="full"
        >
          Se déconnecter
        </Button>

      </Box>
    </Flex>
  );
}
