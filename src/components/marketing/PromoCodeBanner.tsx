import { useState } from 'react';
import { Box, Flex, Text, HStack, Button, useToast, Tooltip } from '@chakra-ui/react';
import { Tag, Copy, Check } from 'lucide-react';
import type { PromoCampaign } from '../../hooks/useMarketingStorefront';

const C = { navy: '#0d1f38', amber: '#c97d1a', amberLight: '#fef9ee', amberBorder: '#f5d78e', border: '#e2e8f0' };

interface Props {
  promoCodes: PromoCampaign[];
}

function PromoCodeChip({ promo }: { promo: PromoCampaign }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const code = promo.code ?? promo.name.toUpperCase().replace(/\s/g, '');

  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    toast({ title: `Code "${code}" copié !`, description: promo.discount_pct ? `-${promo.discount_pct}%` : undefined, status: 'success', duration: 2000, isClosable: true });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Tooltip label={promo.discount_pct ? `−${promo.discount_pct}% sur commande` : promo.name} placement="top">
      <Flex
        align="center" gap={2.5} px={3} py={2} rounded="md" flexShrink={0} cursor="pointer"
        style={{ background: C.amberLight, border: `1.5px dashed ${C.amberBorder}` }}
        _hover={{ bg: '#fef3d1' }}
        onClick={copy}
        transition="all 0.15s"
      >
        <Tag size={13} color={C.amber} />
        <Box>
          {promo.discount_pct && (
            <Text fontSize="9px" fontWeight="800" letterSpacing="1px" textTransform="uppercase" style={{ color: C.amber }}>
              −{promo.discount_pct}%
            </Text>
          )}
          <Text fontSize="12px" fontWeight="900" letterSpacing="1.5px" fontFamily="mono" style={{ color: C.navy }}>
            {code}
          </Text>
        </Box>
        {copied
          ? <Check size={12} color="#16a34a" />
          : <Copy size={11} color={C.amber} />}
      </Flex>
    </Tooltip>
  );
}

export default function PromoCodeBanner({ promoCodes }: Props) {
  if (promoCodes.length === 0) return null;

  return (
    <Box bg="white" py={3} px={0} style={{ borderBottom: `1px solid ${C.border}` }}>
      <Box maxW="1400px" mx="auto" px={5}>
        <Flex align="center" gap={4} overflowX="auto"
          sx={{ '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
          <HStack spacing={1.5} flexShrink={0}>
            <Tag size={13} color={C.amber} />
            <Text fontSize="11px" fontWeight="700" color="gray.500" whiteSpace="nowrap" textTransform="uppercase" letterSpacing="0.08em">
              Codes promo actifs
            </Text>
          </HStack>
          <Box w="1px" h={6} bg="gray.200" flexShrink={0} />
          <Flex gap={2} align="center">
            {promoCodes.map(p => <PromoCodeChip key={p.id} promo={p} />)}
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
