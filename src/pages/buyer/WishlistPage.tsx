import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, SimpleGrid,
  Image, Badge, useToast, Skeleton, Checkbox,
} from '@chakra-ui/react';
import {
  ArrowLeft, Heart, ShoppingCart, Trash2, Lock, Star, Package,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Product } from '../../types';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', amber: '#c97d1a', amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b', border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#1a5c35', greenLight: '#dcfce7', red: '#be1c1c', redLight: '#fff1f1',
};

// Clé localStorage pour la wishlist (ids de produits)
const WL_KEY = 's212_wishlist';

function getWishlistIds(): string[] {
  try { return JSON.parse(localStorage.getItem(WL_KEY) ?? '[]'); }
  catch { return []; }
}

// ── Card produit ──────────────────────────────────────────────────────────────
function WishCard({
  product, selected, onSelect, onRemove, onAddToCart,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onAddToCart: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tiers = product.price_tiers?.sort((a, b) => a.qty_min - b.qty_min) ?? [];
  const first = tiers[0];

  return (
    <Box bg="white" rounded="2xl" overflow="hidden" role="group"
      style={{ border: `1.5px solid ${selected ? C.amberBorder : C.border}` }}
      _hover={{ shadow: 'md', borderColor: C.amberBorder }} transition="all 0.2s">
      {/* Selection + remove */}
      <Flex position="relative">
        <Box position="absolute" top={3} left={3} zIndex={2}>
          <Checkbox isChecked={selected} onChange={onSelect}
            sx={{ '& .chakra-checkbox__control': { bg: selected ? C.amber : 'white', borderColor: selected ? C.amber : C.border, rounded: 'md' } }} />
        </Box>
        <Box position="absolute" top={3} right={3} zIndex={2}
          opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.18s">
          <Box w={7} h={7} rounded="full" cursor="pointer"
            display="flex" alignItems="center" justifyContent="center"
            style={{ background: C.redLight, border: `1px solid #fca5a5` }}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 size={12} color={C.red} />
          </Box>
        </Box>
      </Flex>

      {/* Image */}
      <Box h="160px" overflow="hidden" cursor="pointer"
        onClick={() => navigate(`/product/${product.id}`)}>
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} w="full" h="full" objectFit="cover"
            transition="transform 0.35s" _groupHover={{ transform: 'scale(1.06)' }} />
        ) : (
          <Flex w="full" h="full" align="center" justify="center" style={{ background: C.bgAlt }}>
            <Package size={36} color={C.border} />
          </Flex>
        )}
      </Box>

      {/* Info */}
      <Box p={4}>
        <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="0.6px"
          mb={0.5} style={{ color: C.amber }}>
          {product.organisations?.name ?? 'Vendeur'}
        </Text>
        <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }} noOfLines={2} mb={2} lineHeight={1.4}
          cursor="pointer" onClick={() => navigate(`/product/${product.id}`)}>
          {product.name}
        </Text>
        {product.avg_rating > 0 && (
          <HStack spacing={0.5} mb={2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={10} fill={i < Math.round(product.avg_rating) ? '#F59E0B' : 'none'} color="#F59E0B" />
            ))}
          </HStack>
        )}

        {/* Prix */}
        {user ? (
          first ? (
            <HStack spacing={1} align="baseline" mb={3}>
              <Text fontWeight="900" fontSize="lg" lineHeight={1} style={{ color: C.navy }}>
                {first.unit_price.toFixed(2)}
              </Text>
              <Text fontSize="10px" style={{ color: C.muted }}>{product.currency}/u</Text>
              {product.moq > 1 && (
                <Text fontSize="10px" style={{ color: C.muted }}>· MOQ {product.moq}</Text>
              )}
            </HStack>
          ) : <Text fontSize="xs" color="gray.400" fontStyle="italic" mb={3}>Sur devis</Text>
        ) : (
          <Box rounded="lg" px={2.5} py={1.5} mb={3} cursor="pointer"
            style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}
            onClick={() => navigate('/auth')}>
            <HStack spacing={1}>
              <Lock size={10} color={C.muted} />
              <Text fontSize="10px" fontWeight="700" style={{ color: C.slate }}>Voir le prix</Text>
            </HStack>
          </Box>
        )}

        <Button w="full" size="sm" fontWeight="700" rounded="xl"
          style={{ background: C.navy, color: 'white' }}
          leftIcon={<ShoppingCart size={13} />}
          _hover={{ opacity: 0.9 }} onClick={onAddToCart}>
          Ajouter au panier
        </Button>
      </Box>
    </Box>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function WishlistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<string[]>(getWishlistIds);

  useEffect(() => {
    if (wishlistIds.length === 0) { setLoading(false); return; }
    supabase.from('products')
      .select('*, organisations(name), price_tiers(*)')
      .in('id', wishlistIds).eq('status', 'active')
      .then(({ data }) => { setProducts((data as Product[]) ?? []); setLoading(false); });
  }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  }

  function removeItem(id: string) {
    const next = wishlistIds.filter((x) => x !== id);
    setWishlistIds(next);
    localStorage.setItem(WL_KEY, JSON.stringify(next));
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    toast({ title: 'Retiré des favoris', status: 'info', duration: 2000, position: 'top-right' });
  }

  function removeSelected() {
    const next = wishlistIds.filter((id) => !selected.has(id));
    setWishlistIds(next);
    localStorage.setItem(WL_KEY, JSON.stringify(next));
    setProducts((prev) => prev.filter((p) => !selected.has(p.id)));
    toast({
      title: `${selected.size} produit${selected.size > 1 ? 's' : ''} retiré${selected.size > 1 ? 's' : ''} des favoris`,
      status: 'info', duration: 2500, position: 'top-right',
    });
    setSelected(new Set());
  }

  function addToCart(product: Product) {
    if (!user) { navigate('/auth'); return; }
    toast({
      title: 'Ajouté au panier',
      description: product.name,
      status: 'success', duration: 2500, position: 'top-right',
    });
  }

  function addSelectedToCart() {
    const count = selected.size;
    if (!user) { navigate('/auth'); return; }
    toast({
      title: `${count} produit${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} au panier`,
      status: 'success', duration: 2500, position: 'top-right',
    });
  }

  return (
    <VStack spacing={6} align="stretch">

      {/* ── EN-TÊTE ──────────────────────────────────────────────────── */}
      <Flex align="flex-start" justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
            style={{ color: C.muted }} mb={1} onClick={() => navigate('/buyer')}>
            Tableau de bord
          </Button>
          <Flex align="center" gap={3}>
            <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>Mes favoris</Heading>
            {!loading && products.length > 0 && (
              <Badge rounded="full" px={2.5} fontSize="sm" fontWeight="700"
                style={{ background: C.amberLight, color: '#92400e' }}>
                {products.length}
              </Badge>
            )}
          </Flex>
          <Text fontSize="sm" style={{ color: C.muted }}>
            Produits sauvegardés pour commander plus tard
          </Text>
        </Box>
        {selected.size > 0 && (
          <HStack spacing={2}>
            <Button size="sm" variant="outline" fontWeight="600" rounded="full"
              style={{ borderColor: C.red, color: C.red }}
              leftIcon={<Trash2 size={13} />} onClick={removeSelected}>
              Retirer ({selected.size})
            </Button>
            <Button size="sm" fontWeight="700" rounded="full"
              style={{ background: C.navy, color: 'white' }}
              leftIcon={<ShoppingCart size={13} />} onClick={addSelectedToCart}>
              Ajouter au panier ({selected.size})
            </Button>
          </HStack>
        )}
      </Flex>

      {/* ── CONTENU ──────────────────────────────────────────────────── */}
      {loading ? (
        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Box key={i} rounded="2xl" overflow="hidden" style={{ border: `1px solid ${C.border}` }}>
              <Skeleton h="160px" /><Box p={4}><Skeleton noOfLines={4} spacing={2} /></Box>
            </Box>
          ))}
        </SimpleGrid>
      ) : products.length === 0 ? (
        <Flex direction="column" align="center" py={20} gap={4}
          bg="white" rounded="2xl" style={{ border: `1px solid ${C.border}` }}>
          <Box p={5} rounded="full" style={{ background: C.bgAlt }}>
            <Heart size={36} color={C.border} />
          </Box>
          <Box textAlign="center">
            <Text fontWeight="700" style={{ color: C.slate }}>Aucun favori</Text>
            <Text fontSize="sm" style={{ color: C.muted }} mt={1}>
              Ajoutez des produits à vos favoris depuis le catalogue
            </Text>
          </Box>
          <Button size="sm" fontWeight="700" rounded="full"
            style={{ background: C.navy, color: 'white' }} onClick={() => navigate('/catalog')}>
            Parcourir le catalogue
          </Button>
        </Flex>
      ) : (
        <>
          {/* Sélectionner tout */}
          <Flex align="center" gap={3}>
            <Checkbox isChecked={selected.size === products.length && products.length > 0}
              isIndeterminate={selected.size > 0 && selected.size < products.length}
              onChange={toggleSelectAll}
              sx={{ '& .chakra-checkbox__control': { rounded: 'md' } }}>
              <Text fontSize="sm" fontWeight="600" style={{ color: C.slate }}>
                Tout sélectionner ({products.length})
              </Text>
            </Checkbox>
          </Flex>

          <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
            {products.map((p) => (
              <WishCard key={p.id} product={p}
                selected={selected.has(p.id)}
                onSelect={() => toggleSelect(p.id)}
                onRemove={() => removeItem(p.id)}
                onAddToCart={() => addToCart(p)} />
            ))}
          </SimpleGrid>
        </>
      )}
    </VStack>
  );
}
