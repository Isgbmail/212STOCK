import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, HStack, Button, Badge, VStack,
  Tooltip, useToast, Divider,
} from '@chakra-ui/react';
import { Tag, Copy, Check, Layers, Package, Zap } from 'lucide-react';
import type { ProductCampaigns } from '../../hooks/useMarketingStorefront';

const C = { navy: '#0d1f38', amber: '#c97d1a', amberLight: '#fef9ee', amberBorder: '#f5d78e', border: '#e2e8f0', red: '#dc2626', redLight: '#fef2f2' };

interface Props {
  productId: string;
  campaigns: ProductCampaigns;
}

export default function ProductCampaignPanel({ productId, campaigns }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const { volumeDeal, promoCode, hasSampling, hasFlashSale } = campaigns;
  if (!volumeDeal && !promoCode && !hasSampling && !hasFlashSale) return null;

  const copyCode = () => {
    const code = promoCode?.code ?? promoCode?.name ?? '';
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    toast({ title: `Code "${code}" copié !`, status: 'success', duration: 2000 });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Box rounded="xl" overflow="hidden" style={{ border: `1.5px solid ${C.amberBorder}`, background: C.amberLight }}>
      <Flex align="center" gap={2} px={4} py={2.5} style={{ background: C.amber }}>
        <Tag size={13} color="white" />
        <Text fontSize="11px" fontWeight="800" letterSpacing="1px" textTransform="uppercase" color="white">
          Offres disponibles sur ce produit
        </Text>
      </Flex>

      <VStack align="stretch" spacing={0} divider={<Divider borderColor={C.amberBorder} />}>
        {/* Flash sale */}
        {hasFlashSale && (
          <Flex align="center" gap={3} px={4} py={3}>
            <Box w={7} h={7} rounded="md" bg={C.red} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Zap size={13} color="white" fill="white" />
            </Box>
            <Box>
              <Text fontSize="12px" fontWeight="700" style={{ color: C.navy }}>Flash Sale active</Text>
              <Text fontSize="11px" color="gray.500">Prix réduit pour une durée limitée</Text>
            </Box>
            <Badge colorScheme="red" ml="auto" fontSize="9px" fontWeight="800">PROMO</Badge>
          </Flex>
        )}

        {/* Volume deal */}
        {volumeDeal && (
          <Flex align="center" gap={3} px={4} py={3}>
            <Box w={7} h={7} rounded="md" style={{ background: '#0891b2' }} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Layers size={13} color="white" />
            </Box>
            <Box>
              <Text fontSize="12px" fontWeight="700" style={{ color: C.navy }}>Offre volume</Text>
              <Text fontSize="11px" color="gray.500">
                {volumeDeal.min_quantity
                  ? `−${volumeDeal.discount_pct ?? '?'}% dès ${volumeDeal.min_quantity} unités`
                  : `−${volumeDeal.discount_pct ?? '?'}% sur grandes quantités`}
              </Text>
            </Box>
          </Flex>
        )}

        {/* Promo code */}
        {promoCode && (
          <Flex align="center" gap={3} px={4} py={3}>
            <Box w={7} h={7} rounded="md" style={{ background: C.amber }} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Tag size={13} color="white" />
            </Box>
            <Box flex={1}>
              <Text fontSize="12px" fontWeight="700" style={{ color: C.navy }}>Code promo</Text>
              <Flex align="center" gap={2} mt={0.5}>
                <Box
                  px={2} py={0.5} rounded="md" style={{ border: `1.5px dashed ${C.amberBorder}`, background: 'white' }}
                  cursor="pointer" onClick={copyCode}
                >
                  <Text fontSize="12px" fontWeight="900" letterSpacing="1.5px" fontFamily="mono" style={{ color: C.navy }}>
                    {promoCode.code ?? promoCode.name.toUpperCase().replace(/\s/g, '')}
                  </Text>
                </Box>
                {promoCode.discount_pct && (
                  <Badge colorScheme="orange" fontSize="9px" fontWeight="800">−{promoCode.discount_pct}%</Badge>
                )}
              </Flex>
            </Box>
            <Button size="xs" variant="ghost" color={C.amber} onClick={copyCode} p={1}>
              {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
            </Button>
          </Flex>
        )}

        {/* Sampling */}
        {hasSampling && (
          <Flex align="center" gap={3} px={4} py={3}>
            <Box w={7} h={7} rounded="md" style={{ background: '#059669' }} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Package size={13} color="white" />
            </Box>
            <Box flex={1}>
              <Text fontSize="12px" fontWeight="700" style={{ color: C.navy }}>Échantillon disponible</Text>
              <Text fontSize="11px" color="gray.500">Testez ce produit avant de commander</Text>
            </Box>
            <Button
              size="xs" colorScheme="green" fontWeight="700"
              onClick={() => navigate('/buyer/trade-requests')}
            >
              Demander
            </Button>
          </Flex>
        )}
      </VStack>
    </Box>
  );
}
