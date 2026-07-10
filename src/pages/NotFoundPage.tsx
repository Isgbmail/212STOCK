import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Flex, Heading, HStack, Text, VStack,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Search } from 'lucide-react';

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const QUICK_LINKS = [
  { label: 'Catalogue', href: '/catalog' },
  { label: 'Meilleures offres', href: '/best-deals' },
  { label: 'Nos marques', href: '/brands' },
  { label: 'Comment ça marche', href: '/how-it-works' },
];

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Flex minH="80vh" align="center" justify="center" p={6}>
      <VStack spacing={10} textAlign="center" maxW="560px">
        {/* Animated 404 */}
        <MotionBox
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Text
            fontSize={{ base: '7xl', md: '9xl' }}
            fontWeight="900"
            bgGradient="linear(135deg, blue.400, blue.600)"
            bgClip="text"
            lineHeight={1}
            letterSpacing="-4px"
          >
            404
          </Text>
        </MotionBox>

        {/* Message */}
        <MotionFlex
          direction="column"
          align="center"
          gap={3}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Heading size="lg" color="gray.800">
            Page introuvable
          </Heading>
          <Text color="gray.500" fontSize="md" lineHeight={1.7} maxW="400px">
            La page que vous cherchez n'existe pas ou a été déplacée.
            Vérifiez l'URL ou revenez à l'accueil.
          </Text>
        </MotionFlex>

        {/* CTA buttons */}
        <MotionFlex
          gap={3}
          flexWrap="wrap"
          justify="center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <Button
            leftIcon={<ArrowLeft size={16} />}
            variant="outline"
            rounded="full"
            onClick={() => navigate(-1)}
          >
            Retour
          </Button>
          <Button
            leftIcon={<Home size={16} />}
            colorScheme="blue"
            rounded="full"
            onClick={() => navigate('/')}
          >
            Accueil
          </Button>
          <Button
            leftIcon={<Search size={16} />}
            variant="ghost"
            colorScheme="blue"
            rounded="full"
            onClick={() => navigate('/catalog')}
          >
            Explorer le catalogue
          </Button>
        </MotionFlex>

        {/* Quick links */}
        <MotionBox
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          w="full"
        >
          <Text fontSize="xs" color="gray.400" mb={3} textTransform="uppercase" letterSpacing="1px" fontWeight="semibold">
            Liens rapides
          </Text>
          <HStack spacing={2} justify="center" flexWrap="wrap">
            {QUICK_LINKS.map((link) => (
              <Button
                key={link.href}
                size="sm"
                variant="ghost"
                colorScheme="gray"
                rounded="full"
                fontSize="xs"
                onClick={() => navigate(link.href)}
              >
                {link.label}
              </Button>
            ))}
          </HStack>
        </MotionBox>
      </VStack>
    </Flex>
  );
}
