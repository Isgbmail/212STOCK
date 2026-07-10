import { Component, ReactNode } from 'react';
import { Box, Button, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50" p={6}>
        <VStack spacing={6} textAlign="center" maxW="480px">
          <Flex
            w={20} h={20}
            bg="red.50"
            rounded="2xl"
            align="center"
            justify="center"
          >
            <AlertTriangle size={36} color="var(--chakra-colors-red-500)" />
          </Flex>

          <Box>
            <Heading size="lg" color="gray.800" mb={2}>
              Une erreur s'est produite
            </Heading>
            <Text color="gray.500" fontSize="sm" lineHeight={1.7}>
              Un problème inattendu est survenu. L'équipe technique a été notifiée.
            </Text>
          </Box>

          <Box
            bg="gray.100"
            rounded="xl"
            px={4}
            py={3}
            w="full"
            textAlign="left"
          >
            <Text fontSize="xs" color="gray.500" fontFamily="mono" noOfLines={3}>
              {this.state.error.message}
            </Text>
          </Box>

          <Flex gap={3} flexWrap="wrap" justify="center">
            <Button
              leftIcon={<RefreshCw size={14} />}
              colorScheme="blue"
              rounded="full"
              onClick={() => this.setState({ error: null })}
            >
              Réessayer
            </Button>
            <Button
              leftIcon={<Home size={14} />}
              variant="outline"
              rounded="full"
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
            >
              Accueil
            </Button>
          </Flex>
        </VStack>
      </Flex>
    );
  }
}
