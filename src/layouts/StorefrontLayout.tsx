import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Flex, HStack, Text, Input, InputGroup, InputLeftElement,
  InputRightElement, IconButton, Badge, Menu, MenuButton, MenuList,
  MenuItem, MenuDivider, Avatar, Button, Drawer, DrawerBody,
  DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton,
  VStack, useDisclosure, Divider, Image, Spinner, SimpleGrid,
  Tooltip, Accordion, AccordionItem, AccordionButton, AccordionPanel,
  AccordionIcon, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton, Breadcrumb, BreadcrumbItem,
  BreadcrumbLink, LinkBox, LinkOverlay,
} from '@chakra-ui/react';
import {
  Search, ShoppingCart, ChevronDown, Package, Menu as MenuIcon,
  LayoutDashboard, LogOut, Settings, Star, Truck, Phone, Mail,
  Facebook, Twitter, Linkedin, Instagram, Home, Globe,
  ChevronRight, Lock, Scale, X, Shield, FileText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useComparator } from '../contexts/ComparatorContext';
import { getCatStyle } from '../lib/categoryIcons';
import { useCart } from '../hooks/useCart';
import { CartDrawer } from '../components/CartDrawer';
import { NotificationBell } from '../components/NotificationBell';
import type { Product, Category } from '../types';

// ─── brand colour tokens (mirrors HomePage C tokens) ─────────────────────────
const N = {
  navy:   '#0d1f38',
  navyMid:'#1a3558',
  amber:  '#c97d1a',
  amber10:'#fef3c7',
  slate:  '#334155',
  muted:  '#64748b',
  border: '#e2e8f0',
  bgAlt:  '#f8fafc',
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function CatIcon({ name, size = 16 }: { name: string; size?: number }) {
  const { Icon, color } = getCatStyle(name);
  return <Icon size={size} color={color} />;
}

// ─── NavLink ──────────────────────────────────────────────────────────────────
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
  return (
    <Link to={to}>
      <Box
        as="span" display="inline-flex" alignItems="center" h="48px"
        fontWeight={active ? '700' : '500'} fontSize="sm"
        whiteSpace="nowrap" cursor="pointer"
        color={active ? 'white' : 'rgba(255,255,255,0.72)'}
        borderBottom="2px solid"
        borderColor={active ? N.amber : 'transparent'}
        sx={{ '&:hover': { color: 'white', borderBottomColor: N.amber } }}
        transition="all 0.15s"
      >
        {children}
      </Box>
    </Link>
  );
}

// ─── CategoryMegaMenu ─────────────────────────────────────────────────────────
function CategoryMegaMenu({ roots, children: subs }: { roots: Category[]; children: Category[] }) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = roots.find((r) => r.id === activeId) ?? roots[0];
  const activeSubs = subs.filter((s) => s.parent_id === active?.id);

  return (
    <Menu isLazy>
      <MenuButton as={Button} variant="ghost" size="sm" fontWeight="700"
        fontSize="sm" rightIcon={<ChevronDown size={13} color="white" />}
        color="white" _hover={{ bg: 'rgba(255,255,255,0.12)' }}>
        Produits
      </MenuButton>
      <MenuList p={0} shadow="2xl" rounded="2xl" border="1px" borderColor="gray.100"
        minW="680px" zIndex={300} overflow="hidden">
        <Flex>
          {/* Left: root tabs */}
          <VStack spacing={0} align="stretch" bg="gray.50" minW="160px" py={3}
            borderRight="1px" borderColor="gray.100">
            {roots.map((root) => {
              const { Icon } = getCatStyle(root.name);
              const isActive = active?.id === root.id;
              return (
                <Box key={root.id} px={4} py={3} cursor="pointer"
                  bg={isActive ? 'white' : 'transparent'}
                  style={{ borderLeft: `3px solid ${isActive ? N.navy : 'transparent'}` }}
                  onMouseEnter={() => setActiveId(root.id)}
                  onClick={() => navigate(`/catalog?category=${root.id}`)}
                  transition="all 0.15s" _hover={{ bg: 'white' }}>
                  <HStack spacing={2}>
                    <Icon size={16} color={isActive ? N.navy : '#9ca3af'} />
                    <Text fontSize="sm" fontWeight={isActive ? '700' : 'medium'}
                      style={{ color: isActive ? N.navy : '#374151' }}>{root.name}</Text>
                  </HStack>
                </Box>
              );
            })}
          </VStack>

          {/* Right: content */}
          <Box flex={1} p={5}>
            {active?.image_url && (
              <Box h="90px" rounded="xl" overflow="hidden" mb={4} position="relative">
                <Image src={active.image_url} alt={active.name} w="full" h="full"
                  objectFit="cover" loading="lazy" />
                <Box position="absolute" inset={0}
                  bg="linear-gradient(to right, rgba(0,0,0,0.55), transparent)" />
                <Text position="absolute" left={4} bottom={3} color="white"
                  fontWeight="bold" fontSize="sm">{active.name}</Text>
              </Box>
            )}
            <SimpleGrid columns={3} spacing={1.5}>
              {activeSubs.map((sub) => {
                const { Icon: SubIcon, bg: subBg, color: subColor } = getCatStyle(sub.name);
                return (
                  <Tooltip key={sub.id} label={sub.description ?? ''} isDisabled={!sub.description} placement="top">
                    <LinkBox>
                      <Flex gap={2} align="center" p={2.5} rounded="xl" cursor="pointer"
                        _hover={{ bg: N.bgAlt }} transition="bg 0.15s">
                        <Flex w={8} h={8} rounded="lg" align="center" justify="center" flexShrink={0}
                          style={{ background: subBg }}>
                          <SubIcon size={15} color={subColor} />
                        </Flex>
                        <LinkOverlay as="span" onClick={() => navigate(`/catalog?category=${sub.id}`)}>
                          <Text fontSize="xs" fontWeight="medium" color="gray.700" noOfLines={2} lineHeight={1.3}>
                            {sub.name}
                          </Text>
                        </LinkOverlay>
                      </Flex>
                    </LinkBox>
                  </Tooltip>
                );
              })}
            </SimpleGrid>
            {activeSubs.length === 0 && (
              <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>Aucune sous-catégorie</Text>
            )}
            <Flex justify="flex-end" mt={3}>
              <Button size="xs" variant="ghost"
                style={{ color: N.navy }}
                rightIcon={<ChevronRight size={11} color={N.navy} />}
                _hover={{ bg: N.bgAlt }}
                onClick={() => navigate(`/catalog?category=${active?.id}`)}>
                Tous les produits {active?.name}
              </Button>
            </Flex>
          </Box>
        </Flex>
      </MenuList>
    </Menu>
  );
}

// ─── SearchAutocomplete (self-contained, exportable) ─────────────────────────
export function SearchAutocomplete({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [matchedCats, setMatchedCats] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    supabase.from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true).order('display_order')
      .then(({ data }) => setAllCategories((data as Category[]) ?? []));
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setCatMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setProducts([]); setMatchedCats([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setOpen(true);
      let prodQ = supabase.from('products')
        .select('id, name, images, organisations(name), price_tiers(unit_price, qty_min), avg_rating, currency, moq')
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,ean.eq.${query}`)
        .limit(6);
      if (selectedCat) prodQ = prodQ.eq('category_id', selectedCat.id);

      const [prodRes, catRes] = await Promise.all([
        prodQ,
        supabase.from('categories').select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
          .eq('active', true).ilike('name', `%${query}%`).limit(4),
      ]);
      setProducts((prodRes.data as Product[]) ?? []);
      setMatchedCats((catRes.data as Category[]) ?? []);
      setLoading(false);
    }, 280);
  }, [query, selectedCat]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const p = new URLSearchParams({ q: query });
    if (selectedCat) p.set('category', selectedCat.id);
    navigate(`/catalog?${p.toString()}`);
    setOpen(false); setQuery('');
  }

  const roots = allCategories.filter((c) => !c.parent_id);
  const subs = allCategories.filter((c) => !!c.parent_id);
  const isEmpty = products.length === 0 && matchedCats.length === 0;
  const ph = selectedCat ? `Rechercher dans ${selectedCat.name}…` : 'Rechercher produits, marques, EAN...';

  const inputH = size === 'lg' ? '52px' : size === 'sm' ? '36px' : '44px';
  const plOffset = '96px';

  return (
    <Box ref={ref} position="relative" w="full">
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <InputLeftElement w="auto" pl={1} pointerEvents="all" h={inputH}>
            <Menu isOpen={catMenuOpen} onClose={() => setCatMenuOpen(false)}>
              <MenuButton as={Button} size="xs" variant="ghost"
                color={selectedCat ? 'blue.600' : 'gray.400'}
                rightIcon={<ChevronDown size={10} />}
                h="30px" minW="auto" px={2} ml={1} fontSize="xs" fontWeight="medium"
                onClick={() => setCatMenuOpen(!catMenuOpen)}
                aria-label="Sélectionner une catégorie">
                {selectedCat ? (
                  <HStack spacing={1}>
                    <CatIcon name={selectedCat.name} size={13} />
                    <Text display={{ base: 'none', md: 'block' }} noOfLines={1} maxW="80px">{selectedCat.name}</Text>
                  </HStack>
                ) : (
                  <HStack spacing={1}><Globe size={13} /><Text display={{ base: 'none', md: 'block' }}>Toutes</Text></HStack>
                )}
              </MenuButton>
              <MenuList minW="210px" shadow="xl" rounded="xl" zIndex={400} fontSize="sm">
                <MenuItem icon={<Globe size={14} />}
                  onClick={() => { setSelectedCat(null); setCatMenuOpen(false); }}
                  fontWeight={!selectedCat ? 'semibold' : 'normal'}
                  color={!selectedCat ? 'blue.600' : 'gray.700'}>
                  Toutes les catégories
                </MenuItem>
                <MenuDivider />
                {roots.map((root) => {
                  const { Icon } = getCatStyle(root.name);
                  return (
                    <Box key={root.id}>
                      <MenuItem icon={<Icon size={14} />} fontWeight="semibold" color="gray.700"
                        onClick={() => { setSelectedCat(root); setCatMenuOpen(false); }}
                        bg={selectedCat?.id === root.id ? 'blue.50' : undefined}>
                        {root.name}
                      </MenuItem>
                      {subs.filter((s) => s.parent_id === root.id).map((sub) => {
                        const { Icon: SubIcon } = getCatStyle(sub.name);
                        return (
                          <MenuItem key={sub.id} pl={8} fontSize="xs" color="gray.600"
                            icon={<SubIcon size={12} />}
                            onClick={() => { setSelectedCat(sub); setCatMenuOpen(false); }}
                            bg={selectedCat?.id === sub.id ? 'blue.50' : undefined}>
                            {sub.name}
                          </MenuItem>
                        );
                      })}
                    </Box>
                  );
                })}
              </MenuList>
            </Menu>
          </InputLeftElement>

          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder={ph} rounded="full" bg="gray.50" border="1px"
            borderColor={open ? 'blue.300' : 'gray.200'}
            _focus={{ bg: 'white', borderColor: 'blue.400', shadow: 'none', ring: 0 }}
            fontSize="sm" h={inputH} pl={plOffset} pr="40px" />

          <InputRightElement h={inputH} w="40px">
            {loading ? <Spinner size="xs" color="blue.400" /> :
              query ? (
                <IconButton aria-label="Effacer" icon={<X size={13} color="#9CA3AF" />}
                  size="xs" variant="ghost" rounded="full"
                  onClick={() => { setQuery(''); setOpen(false); }} />
              ) : <Search size={15} color="#9CA3AF" />}
          </InputRightElement>
        </InputGroup>
      </form>

      {open && (
        <Box position="absolute" top="calc(100% + 8px)" left={0} right={0} bg="white"
          rounded="2xl" shadow="2xl" border="1px" borderColor="gray.100" zIndex={300}
          overflow="hidden" maxH="420px" overflowY="auto">
          {loading && isEmpty && (
            <Flex align="center" justify="center" py={8} gap={3}>
              <Spinner size="sm" color="blue.400" />
              <Text fontSize="sm" color="gray.500">Recherche en cours...</Text>
            </Flex>
          )}
          {!loading && isEmpty && (
            <Box p={6} textAlign="center">
              <Text fontSize="sm" color="gray.500" mb={2}>Aucun résultat pour <strong>"{query}"</strong></Text>
              {!user && <Text fontSize="xs" color="blue.500">Inscrivez-vous pour l'offre complète.</Text>}
            </Box>
          )}

          {matchedCats.length > 0 && (
            <Box>
              <Text fontSize="10px" fontWeight="bold" color="gray.400" px={4} pt={3} pb={1} letterSpacing="wider">
                CATÉGORIES
              </Text>
              {matchedCats.map((cat) => {
                const { Icon: CI, bg: cBg, color: cColor } = getCatStyle(cat.name);
                return (
                  <Flex key={cat.id} px={4} py={2.5} gap={3} align="center" cursor="pointer"
                    _hover={{ bg: 'blue.50' }} transition="bg 0.1s"
                    onClick={() => { navigate(`/catalog?category=${cat.id}`); setOpen(false); setQuery(''); }}>
                    <Flex w={8} h={8} rounded="lg" align="center" justify="center" flexShrink={0}
                      style={{ background: cBg }}>
                      <CI size={14} color={cColor} />
                    </Flex>
                    <Box flex={1}>
                      <Text fontSize="sm" color="gray.700" fontWeight="medium">{cat.name}</Text>
                      {cat.description && <Text fontSize="10px" color="gray.400" noOfLines={1}>{cat.description}</Text>}
                    </Box>
                  </Flex>
                );
              })}
              {products.length > 0 && <Divider />}
            </Box>
          )}

          {products.length > 0 && (
            <Box>
              <Text fontSize="10px" fontWeight="bold" color="gray.400" px={4} pt={3} pb={1} letterSpacing="wider">
                PRODUITS
              </Text>
              {products.map((p) => {
                const tier = p.price_tiers?.slice().sort((a, b) => a.qty_min - b.qty_min)[0];
                return (
                  <Flex key={p.id} px={4} py={2.5} gap={3} align="center" cursor="pointer"
                    _hover={{ bg: 'gray.50' }} transition="bg 0.1s"
                    onClick={() => { navigate(`/product/${p.id}`); setOpen(false); setQuery(''); }}>
                    <Box w={10} h={10} rounded="lg" overflow="hidden" bg="gray.100" flexShrink={0}
                      border="1px" borderColor="gray.100">
                      {p.images?.[0] ? (
                        <Image src={p.images[0]} alt={p.name} w="full" h="full" objectFit="cover" />
                      ) : (
                        <Flex w="full" h="full" align="center" justify="center">
                          <Package size={18} color="#9CA3AF" />
                        </Flex>
                      )}
                    </Box>
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.800" noOfLines={1}>{p.name}</Text>
                      <HStack spacing={2}>
                        <Text fontSize="xs" color="gray.400" noOfLines={1}>{(p.organisations as any)?.name}</Text>
                        {p.avg_rating > 0 && (
                          <HStack spacing={0.5}>
                            <Star size={10} fill="gold" color="gold" />
                            <Text fontSize="10px" color="gray.500">{p.avg_rating.toFixed(1)}</Text>
                          </HStack>
                        )}
                      </HStack>
                    </Box>
                    <Box textAlign="right" flexShrink={0}>
                      {user && tier ? (
                        <Text fontSize="sm" fontWeight="bold" color="blue.600">
                          {tier.unit_price.toFixed(2)} {p.currency}
                        </Text>
                      ) : (
                        <HStack spacing={1}>
                          <Lock size={11} color="#9CA3AF" />
                          <Text fontSize="xs" color="gray.400">Prix</Text>
                        </HStack>
                      )}
                    </Box>
                  </Flex>
                );
              })}
            </Box>
          )}

          {!isEmpty && (
            <Box borderTop="1px" borderColor="gray.100" p={3}>
              <Button size="sm" w="full" variant="ghost" colorScheme="blue"
                rightIcon={<Search size={13} />}
                onClick={() => {
                  const p = new URLSearchParams({ q: query });
                  if (selectedCat) p.set('category', selectedCat.id);
                  navigate(`/catalog?${p.toString()}`);
                  setOpen(false); setQuery('');
                }}>
                Tous les résultats pour "{query}"
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── AllCategoriesModal ───────────────────────────────────────────────────────
export function AllCategoriesModal({ isOpen, onClose, roots, subCategories }: {
  isOpen: boolean; onClose: () => void; roots: Category[]; subCategories: Category[];
}) {
  const navigate = useNavigate();
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent rounded="2xl" mx={4}>
        <ModalHeader borderBottom="1px" borderColor="gray.100">Toutes les catégories</ModalHeader>
        <ModalCloseButton top={4} right={4} />
        <ModalBody py={6}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {roots.map((root) => {
              const { Icon: RI, bg, color } = getCatStyle(root.name);
              return (
                <Box key={root.id}>
                  <HStack mb={3} cursor="pointer" role="group"
                    onClick={() => { navigate(`/catalog?category=${root.id}`); onClose(); }}
                    _hover={{ color: 'blue.600' }}>
                    <Flex w={8} h={8} rounded="lg" align="center" justify="center" style={{ background: bg }}>
                      <RI size={16} color={color} />
                    </Flex>
                    <Text fontWeight="bold" color="gray.800" _groupHover={{ color: 'blue.600' }}
                      transition="color 0.15s">{root.name}</Text>
                  </HStack>
                  <VStack align="start" spacing={0} pl={2}>
                    {subCategories.filter((s) => s.parent_id === root.id).map((sub) => {
                      const { Icon: SI, color: sc } = getCatStyle(sub.name);
                      return (
                        <HStack key={sub.id} spacing={2} cursor="pointer" py={1.5} px={2} rounded="lg" w="full"
                          _hover={{ bg: 'blue.50', color: 'blue.600' }} transition="all 0.15s"
                          onClick={() => { navigate(`/catalog?category=${sub.id}`); onClose(); }}>
                          <SI size={13} color={sc} />
                          <Text fontSize="sm" color="gray.600">{sub.name}</Text>
                        </HStack>
                      );
                    })}
                  </VStack>
                </Box>
              );
            })}
          </SimpleGrid>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ─── CategoryBreadcrumb ───────────────────────────────────────────────────────
export function CategoryBreadcrumb({ category, roots, subCategories, productName, searchTerm }: {
  category?: Category | null; roots: Category[]; subCategories: Category[];
  productName?: string; searchTerm?: string;
}) {
  const allCats = [...roots, ...subCategories];
  const parentCat = category?.parent_id ? allCats.find((c) => c.id === category.parent_id) : null;

  return (
    <Breadcrumb spacing={1.5} separator={<ChevronRight size={12} color="#9CA3AF" />}
      fontSize="sm" mb={4}>
      <BreadcrumbItem>
        <BreadcrumbLink as={Link} to="/" color="gray.500" _hover={{ color: 'blue.600' }}>
          <HStack spacing={1}><Home size={13} /><Text>Accueil</Text></HStack>
        </BreadcrumbLink>
      </BreadcrumbItem>
      {searchTerm ? (
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink color="gray.800" fontWeight="medium">Recherche : "{searchTerm}"</BreadcrumbLink>
        </BreadcrumbItem>
      ) : (
        <>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/catalog" color="gray.500" _hover={{ color: 'blue.600' }}>
              Catalogue
            </BreadcrumbLink>
          </BreadcrumbItem>
          {parentCat && (
            <BreadcrumbItem display={{ base: 'none', md: 'flex' }}>
              <BreadcrumbLink as={Link} to={`/catalog?category=${parentCat.id}`}
                color="gray.500" _hover={{ color: 'blue.600' }}>
                <HStack spacing={1}>
                  <CatIcon name={parentCat.name} size={12} />
                  <Text>{parentCat.name}</Text>
                </HStack>
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}
          {category && (
            <BreadcrumbItem isCurrentPage={!productName}>
              <BreadcrumbLink as={productName ? Link : 'span'}
                to={productName ? `/catalog?category=${category.id}` : undefined}
                color={productName ? 'gray.500' : 'gray.800'} fontWeight={productName ? 'normal' : 'medium'}
                _hover={productName ? { color: 'blue.600' } : undefined}>
                <HStack spacing={1}>
                  <CatIcon name={category.name} size={12} />
                  <Text>{category.name}</Text>
                </HStack>
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}
          {productName && (
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink color="gray.800" fontWeight="semibold" noOfLines={1} maxW="200px">
                {productName}
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}
        </>
      )}
    </Breadcrumb>
  );
}

// ─── ComparatorFloat ──────────────────────────────────────────────────────────
function ComparatorFloat() {
  const { items } = useComparator();
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <Box position="fixed" bottom={6} right={6} zIndex={500}>
      <Button
        style={{ background: N.navy, color: 'white', boxShadow: '0 6px 24px rgba(13,31,56,0.4)' }}
        rounded="full" leftIcon={<Scale size={15} />}
        onClick={() => navigate('/compare')} size="md" fontWeight="700"
        _hover={{ opacity: 0.9, transform: 'translateY(-2px)' }} transition="all 0.18s">
        Comparer ({items.length}/4)
      </Button>
    </Box>
  );
}

// ─── StorefrontLayout ─────────────────────────────────────────────────────────
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, activeOrg, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isCartOpen, onOpen: onCartOpen, onClose: onCartClose } = useDisclosure();
  const { count: cartCount } = useCart();
  const { items: compItems } = useComparator();
  const [roots, setRoots] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Category[]>([]);

  useEffect(() => {
    supabase.from('categories')
      .select('id, name, name_i18n, icon, image_url, description, parent_id, display_order, active')
      .eq('active', true).order('display_order')
      .then(({ data }) => {
        const all = (data as Category[]) ?? [];
        setRoots(all.filter((c) => !c.parent_id));
        setSubs(all.filter((c) => !!c.parent_id));
      });
  }, []);

  function getDashPath() {
    if (!activeOrg) return '/';
    if (activeOrg.org_type === 'seller') return '/vendor';
    if (activeOrg.org_type === 'delivery') return '/delivery';
    return '/buyer';
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Announcement bar — trust signals */}
      <Box style={{ background: `linear-gradient(90deg, #0a1929 0%, ${N.navy} 50%, #0a1929 100%)` }} py={1.5} px={4}>
        <Flex maxW="1400px" mx="auto" justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <HStack spacing={6} display={{ base: 'none', md: 'flex' }}>
            <HStack spacing={1.5}>
              <Shield size={11} color="rgba(255,255,255,0.65)" />
              <Text color="blue.100" fontSize="xs" fontWeight="medium">Vendeurs vérifiés</Text>
            </HStack>
            <HStack spacing={1.5}>
              <Truck size={11} color="rgba(255,255,255,0.65)" />
              <Text color="blue.100" fontSize="xs" fontWeight="medium">Chaîne du froid ATP certifiée</Text>
            </HStack>
            <HStack spacing={1.5}>
              <Star size={11} color="rgba(255,255,255,0.65)" />
              <Text color="blue.100" fontSize="xs" fontWeight="medium">Prix dégressifs — MOQ transparent</Text>
            </HStack>
          </HStack>
          <HStack spacing={4} ml={{ base: 'auto', md: '0' }}>
            <HStack spacing={1} color="blue.200" fontSize="xs">
              <Phone size={10} />
              <Text>+33 1 XX XX XX XX</Text>
            </HStack>
            <HStack spacing={1} color="blue.200" fontSize="xs">
              <Mail size={10} />
              <Text>contact@stock212.com</Text>
            </HStack>
          </HStack>
        </Flex>
      </Box>

      {/* Primary header — sticky two-tier */}
      <Box bg="white" position="sticky" top={0} zIndex={200}
        borderBottom="1px solid" borderColor="gray.100"
        boxShadow="0 1px 0 0 #f1f5f9, 0 4px 20px -4px rgba(13,31,56,0.08)">

        {/* Tier 1 — Logo + Search + Actions */}
        <Flex maxW="1400px" mx="auto" px={{ base: 4, md: 6 }} h={{ base: '60px', md: '68px' }} align="center" gap={{ base: 3, md: 5 }}>

          {/* Logo + Brand */}
          <Link to="/">
            <HStack
              spacing={2.5} flexShrink={0}
              _hover={{ opacity: 0.85 }}
              transition="opacity 0.15s"
            >
              <Image
                src="/navlogo.png"
                alt="Stock212"
                h={{ base: '34px', md: '40px' }}
                w="auto"
                objectFit="contain"
              />
              <Box display={{ base: 'none', sm: 'block' }}>
                <Text
                  fontSize={{ base: 'lg', md: 'xl' }}
                  fontWeight="800"
                  letterSpacing="-0.5px"
                  bgGradient="linear(to-r, blue.700, blue.500)"
                  bgClip="text"
                  lineHeight="1"
                >
                  Stock212
                </Text>
                <Text fontSize="9px" color="gray.400" fontWeight="500" letterSpacing="0.5px" mt="1px">
                  B2B FMCG MARKETPLACE
                </Text>
              </Box>
            </HStack>
          </Link>

          {/* Separator */}
          <Box display={{ base: 'none', md: 'block' }} w="1px" h="28px" bg="gray.200" flexShrink={0} />

          {/* Search bar — desktop center */}
          <Box flex={1} maxW="580px" display={{ base: 'none', md: 'block' }}>
            <SearchAutocomplete size="md" />
          </Box>

          {/* Spacer on mobile */}
          <Box flex={1} display={{ base: 'block', md: 'none' }} />

          {/* Right actions */}
          <HStack spacing={1} flexShrink={0}>
            {user ? (
              <>
                <NotificationBell />

                {/* Cart — masqué pour les livreurs */}
                {activeOrg?.org_type !== 'delivery' && (
                  <Box position="relative" display="inline-flex">
                    <Tooltip label="Panier" placement="bottom" hasArrow openDelay={400}>
                      <IconButton
                        aria-label="Panier"
                        icon={<ShoppingCart size={17} />}
                        variant="ghost"
                        rounded="full"
                        size="sm"
                        color="gray.500"
                        _hover={{ bg: 'blue.50', color: 'blue.600' }}
                        onClick={onCartOpen}
                      />
                    </Tooltip>
                    {cartCount > 0 && (
                      <Badge
                        position="absolute" top="-3px" right="-3px"
                        bg="blue.600" color="white" rounded="full" fontSize="8px"
                        minW="15px" h="15px" lineHeight="15px" textAlign="center"
                        pointerEvents="none" fontWeight="700"
                      >
                        {cartCount}
                      </Badge>
                    )}
                  </Box>
                )}

                {/* User menu */}
                <Menu>
                  <MenuButton>
                    <HStack
                      spacing={2} cursor="pointer"
                      pl={2} pr={2.5} py={1.5}
                      rounded="xl"
                      border="1px solid transparent"
                      _hover={{ bg: 'gray.50', borderColor: 'gray.200' }}
                      transition="all 0.15s"
                    >
                      <Avatar
                        size="xs" name={profile?.full_name ?? user.email ?? ''}
                        bg="blue.600" color="white"
                        style={{ width: 28, height: 28, fontSize: '11px' }}
                      />
                      <Box display={{ base: 'none', lg: 'block' }} textAlign="left">
                        <Text fontSize="xs" fontWeight="600" color="gray.800" lineHeight={1.2} maxW="88px" noOfLines={1}>
                          {profile?.full_name ?? 'Mon compte'}
                        </Text>
                        <Text fontSize="9px" color="gray.400" noOfLines={1}>{activeOrg?.name ?? '—'}</Text>
                      </Box>
                      <ChevronDown size={11} color="#9CA3AF" />
                    </HStack>
                  </MenuButton>
                  <MenuList
                    shadow="2xl" rounded="2xl" fontSize="sm" zIndex={300}
                    border="1px" borderColor="gray.100" overflow="hidden" py={0}
                    minW="220px"
                  >
                    {/* Profile header */}
                    <Box px={4} py={4} bg="linear-gradient(135deg, #eff6ff, #dbeafe)" borderBottom="1px" borderColor="blue.100">
                      <HStack spacing={3}>
                        <Avatar
                          size="md" name={profile?.full_name ?? user.email ?? ''}
                          bg="blue.500" color="white"
                        />
                        <Box minW={0}>
                          <Text fontWeight="bold" color="gray.800" fontSize="sm" noOfLines={1}>
                            {profile?.full_name ?? '—'}
                          </Text>
                          <Text fontSize="xs" color="gray.500" noOfLines={1}>{user.email}</Text>
                          <Badge
                            mt={1} fontSize="9px" rounded="full" px={2}
                            colorScheme={
                              activeOrg?.org_type === 'seller' ? 'purple' :
                              activeOrg?.org_type === 'delivery' ? 'orange' : 'blue'
                            }
                          >
                            {activeOrg?.org_type === 'seller' ? 'Vendeur' :
                             activeOrg?.org_type === 'delivery' ? 'Livreur' : 'Acheteur'}
                          </Badge>
                        </Box>
                      </HStack>
                    </Box>
                    {/* Menu items — contenu selon le rôle */}
                    <Box py={1}>
                      <MenuItem
                        icon={<LayoutDashboard size={15} />}
                        onClick={() => navigate(getDashPath())}
                        color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                      >
                        Tableau de bord
                      </MenuItem>
                      {activeOrg?.org_type !== 'delivery' && (
                        <>
                          <MenuItem
                            icon={<Star size={15} />}
                            onClick={() => navigate('/buyer/orders')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            Mes commandes
                          </MenuItem>
                          <MenuItem
                            icon={<FileText size={15} />}
                            onClick={() => navigate('/buyer/quotes')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            Mes devis
                          </MenuItem>
                          <MenuItem
                            icon={<Truck size={15} />}
                            onClick={() => navigate('/buyer/orders')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            Suivi livraisons
                          </MenuItem>
                          <MenuItem
                            icon={<Settings size={15} />}
                            onClick={() => navigate('/buyer/account')}
                            color="gray.700" _hover={{ bg: 'blue.50', color: 'blue.700' }}
                          >
                            Paramètres
                          </MenuItem>
                        </>
                      )}
                    </Box>
                    <Divider />
                    <Box py={1}>
                      <MenuItem
                        icon={<LogOut size={15} />}
                        color="red.500" fontWeight="medium"
                        onClick={signOut}
                        _hover={{ bg: 'red.50' }}
                      >
                        Déconnexion
                      </MenuItem>
                    </Box>
                  </MenuList>
                </Menu>
              </>
            ) : (
              <HStack spacing={2}>
                <Button
                  size="sm" variant="ghost" color="gray.600" fontWeight="500"
                  display={{ base: 'none', sm: 'flex' }}
                  _hover={{ bg: 'gray.50', color: 'blue.600' }}
                  onClick={() => navigate('/auth')}
                >
                  Connexion
                </Button>
                <Button
                  size="sm" colorScheme="blue" rounded="full" fontWeight="600" px={4}
                  bgGradient="linear(to-r, blue.600, blue.500)"
                  _hover={{ bgGradient: 'linear(to-r, blue.700, blue.600)', transform: 'translateY(-1px)' }}
                  boxShadow="0 2px 8px rgba(37,99,235,0.30)"
                  transition="all 0.15s"
                  onClick={() => navigate('/auth')}
                >
                  S'inscrire
                </Button>
              </HStack>
            )}
            <Box w="1px" h="20px" bg="gray.200" display={{ base: 'none', md: 'block' }} mx={1} />
            <IconButton
              aria-label="Menu"
              icon={<MenuIcon size={17} />}
              variant="ghost"
              display={{ base: 'flex', lg: 'none' }}
              onClick={onOpen}
              color="gray.600"
              rounded="lg"
              size="sm"
              _hover={{ bg: 'gray.100' }}
            />
          </HStack>
        </Flex>

        {/* Tier 2 — Navigation secondaire (desktop uniquement) */}
        <Box display={{ base: 'none', lg: 'block' }}
          bg={N.navy}
          borderTop="1px solid rgba(255,255,255,0.06)">
          <Flex maxW="1400px" mx="auto" px={6} align="center" h="44px" justify="space-between">

            {/* Gauche : mega menu + liens principaux */}
            <HStack spacing={0} h="full" align="center">
              {roots.length > 0 && <CategoryMegaMenu roots={roots} children={subs} />}
              <Box w="1px" h="16px" bg="rgba(255,255,255,0.15)" mx={3} flexShrink={0} />
              <HStack spacing={0} h="full">
                {[
                  { to: '/catalog',    label: 'Catalogue' },
                  { to: '/best-deals', label: 'Best Deals' },
                  { to: '/brands',     label: 'Marques' },
                  { to: '/boutiques',  label: 'Boutiques' },
                ].map(({ to, label }) => (
                  <Box key={to} px={3.5} h="full" display="flex" alignItems="center">
                    <NavLink to={to}>{label}</NavLink>
                  </Box>
                ))}
              </HStack>
            </HStack>

            {/* Droite : badges accès rapide */}
            <HStack spacing={1.5}>
              <Link to="/best-deals">
                <HStack
                  px={3} py="4px" rounded="md" spacing={1.5} cursor="pointer"
                  bg="rgba(234,153,20,0.18)" border="1px solid rgba(234,153,20,0.40)"
                  _hover={{ bg: 'rgba(234,153,20,0.28)' }} transition="background 0.13s"
                >
                  <Text fontSize="11px" fontWeight="700" color="#FCD34D">Promotions</Text>
                </HStack>
              </Link>
              <Link to="/catalog?sort=new">
                <HStack
                  px={3} py="4px" rounded="md" spacing={1.5} cursor="pointer"
                  bg="rgba(255,255,255,0.08)" border="1px solid rgba(255,255,255,0.15)"
                  _hover={{ bg: 'rgba(255,255,255,0.14)' }} transition="background 0.13s"
                >
                  <Text fontSize="11px" fontWeight="600" color="rgba(255,255,255,0.80)">Nouveautés</Text>
                </HStack>
              </Link>
              <Link to="/how-it-works">
                <HStack
                  px={3} py="4px" rounded="md" spacing={1.5} cursor="pointer"
                  bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.10)"
                  _hover={{ bg: 'rgba(255,255,255,0.11)' }} transition="background 0.13s"
                >
                  <Text fontSize="11px" fontWeight="600" color="rgba(255,255,255,0.60)">Comment ça marche</Text>
                </HStack>
              </Link>
              {compItems.length > 0 && (
                <Link to="/compare">
                  <HStack
                    px={3} py="4px" rounded="md" spacing={1.5} cursor="pointer"
                    bg="rgba(234,153,20,0.18)" border="1px solid rgba(234,153,20,0.40)"
                    _hover={{ bg: 'rgba(234,153,20,0.28)' }} transition="background 0.13s"
                  >
                    <Scale size={10} color="#FCD34D" />
                    <Text fontSize="11px" fontWeight="700" color="#FCD34D">
                      Comparer ({compItems.length})
                    </Text>
                  </HStack>
                </Link>
              )}
            </HStack>
          </Flex>
        </Box>
      </Box>

      {/* Sous-nav acheteur — visible uniquement sur /buyer/* */}
      {user && loc.pathname.startsWith('/buyer') && (
        <Box
          bg="white"
          style={{ borderBottom: `1px solid ${N.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          position="sticky"
          top="0"
          zIndex={200}
        >
          <Flex
            maxW="1400px" mx="auto" px={6}
            align="center" h="40px"
            overflowX="auto"
            gap={0}
            css={{ '&::-webkit-scrollbar': { display: 'none' } }}
          >
            {([
              { to: '/buyer',               label: 'Accueil',       exact: true  },
              { to: '/buyer/orders',        label: 'Commandes',     exact: false },
              { to: '/buyer/quotes',        label: 'Devis',         exact: false },
              { to: '/buyer/carts',         label: 'Paniers',       exact: false },
              { to: '/buyer/ean-catalogue', label: 'Réf. EAN',      exact: false },
              { to: '/buyer/wishlist',      label: 'Favoris',       exact: false },
              { to: '/buyer/insights',      label: 'Insights',      exact: false },
              { to: '/buyer/finances',      label: 'Finances',      exact: false },
              { to: '/buyer/account',       label: 'Compte',        exact: false },
            ] as { to: string; label: string; exact: boolean }[]).map(({ to, label, exact }) => {
              const active = exact
                ? loc.pathname === to
                : loc.pathname.startsWith(to);
              return (
                <Link key={to} to={to}>
                  <Box
                    px={4} h="40px"
                    display="flex" alignItems="center"
                    whiteSpace="nowrap"
                    borderBottom="2px solid"
                    borderColor={active ? N.amber : 'transparent'}
                    style={{ color: active ? N.navy : N.muted }}
                    fontWeight={active ? '700' : '500'}
                    fontSize="12px"
                    _hover={{ color: N.navy, borderBottomColor: N.amber }}
                    transition="all 0.15s"
                  >
                    {label}
                  </Box>
                </Link>
              );
            })}
          </Flex>
        </Box>
      )}

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" py={3} px={4}>
            <HStack spacing={2.5}>
              <Image
                src="/navlogo.png"
                alt="Stock212"
                h="36px"
                w="auto"
                objectFit="contain"
              />
              <Box>
                <Text fontSize="lg" fontWeight="800" letterSpacing="-0.5px"
                  bgGradient="linear(to-r, blue.700, blue.500)" bgClip="text" lineHeight="1">
                  Stock212
                </Text>
                <Text fontSize="8px" color="gray.400" fontWeight="500" letterSpacing="0.5px">
                  B2B FMCG MARKETPLACE
                </Text>
              </Box>
            </HStack>
          </DrawerHeader>
          <DrawerBody px={0}>
            <VStack align="stretch" spacing={0}>
              {/* Search bar mobile */}
              <Box px={4} py={3} borderBottom="1px" borderColor="gray.100">
                <SearchAutocomplete size="sm" />
              </Box>

              {[
                { to: '/',           label: 'Accueil' },
                { to: '/catalog',    label: 'Catalogue' },
                { to: '/brands',     label: 'Marques' },
                { to: '/boutiques',  label: 'Boutiques' },
                { to: '/best-deals', label: 'Best Deals' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} onClick={onClose}>
                  <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700">{label}</Text>
                  </Box>
                </Link>
              ))}

              {roots.length > 0 && (
                <>
                  <Divider />
                  <Box px={5} pt={3} pb={1}>
                    <Text fontSize="10px" fontWeight="bold" color="gray.400" letterSpacing="wider">
                      CATÉGORIES
                    </Text>
                  </Box>
                  <Accordion allowMultiple>
                    {roots.map((root) => {
                      const { Icon: RI, color: rc } = getCatStyle(root.name);
                      return (
                        <AccordionItem key={root.id} border="none">
                          <AccordionButton px={5} py={2.5} _hover={{ bg: 'gray.50' }}>
                            <HStack flex={1} spacing={2}>
                              <RI size={15} color={rc} />
                              <Text fontSize="sm" fontWeight="semibold" color="gray.700">{root.name}</Text>
                            </HStack>
                            <AccordionIcon color="gray.400" />
                          </AccordionButton>
                          <AccordionPanel px={5} pb={2}>
                            <VStack align="start" spacing={0}>
                              {subs.filter((s) => s.parent_id === root.id).map((sub) => {
                                const { Icon: SI, color: sc } = getCatStyle(sub.name);
                                return (
                                  <HStack key={sub.id} spacing={2} w="full" py={2} px={2} rounded="lg"
                                    cursor="pointer" _hover={{ bg: 'blue.50' }}
                                    onClick={() => { navigate(`/catalog?category=${sub.id}`); onClose(); }}>
                                    <SI size={13} color={sc} />
                                    <Text fontSize="sm" color="gray.600">{sub.name}</Text>
                                  </HStack>
                                );
                              })}
                            </VStack>
                          </AccordionPanel>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </>
              )}

              <Divider />
              {user ? (
                <VStack align="stretch" spacing={0}>
                  <Box px={5} pt={3} pb={1}>
                    <Text fontSize="10px" fontWeight="bold" color="gray.400" letterSpacing="wider">
                      MON ESPACE
                    </Text>
                  </Box>
                  <Link to={getDashPath()} onClick={onClose}>
                    <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">Tableau de bord</Text>
                    </Box>
                  </Link>
                  {activeOrg?.org_type !== 'delivery' && (
                    <>
                      <Link to="/buyer/orders" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">Mes commandes</Text>
                        </Box>
                      </Link>
                      <Link to="/buyer/quotes" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">Mes devis</Text>
                        </Box>
                      </Link>
                      <Link to="/buyer/carts" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">Mes paniers</Text>
                        </Box>
                      </Link>
                      <Link to="/buyer/ean-catalogue" onClick={onClose}>
                        <Box py={3} px={5} _hover={{ bg: 'gray.50' }}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">Référence EAN</Text>
                        </Box>
                      </Link>
                    </>
                  )}
                  <Divider my={1} />
                  <Box py={3} px={5} cursor="pointer" _hover={{ bg: 'red.50' }}
                    onClick={() => { signOut(); onClose(); }}>
                    <Text fontSize="sm" fontWeight="medium" color="red.500">Déconnexion</Text>
                  </Box>
                </VStack>
              ) : (
                <VStack spacing={3} px={5} pt={4} pb={2}>
                  <Button w="full" rounded="full" size="sm" fontWeight="700"
                    style={{ background: N.navy, color: 'white' }}
                    _hover={{ opacity: 0.9 }}
                    onClick={() => { navigate('/auth'); onClose(); }}>S'inscrire gratuitement</Button>
                  <Button w="full" variant="outline" rounded="full" size="sm"
                    onClick={() => { navigate('/auth'); onClose(); }}>Se connecter</Button>
                </VStack>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={onCartClose} />

      {/* Bannière validation en attente */}
      {activeOrg?.validation_status === 'pending' && (
        <Box bg="blue.700" px={4} py={2.5}>
          <Flex maxW="1400px" mx="auto" align="center" gap={2}>
            <Text fontSize="sm" color="white" fontWeight="500">
              ⏳ Votre dossier est en cours de validation — un commercial vous contactera sous 24–48h pour activer votre accès complet.
            </Text>
          </Flex>
        </Box>
      )}
      {activeOrg?.validation_status === 'rejected' && (
        <Box bg="red.600" px={4} py={2.5}>
          <Flex maxW="1400px" mx="auto" align="center" gap={2}>
            <Text fontSize="sm" color="white" fontWeight="500">
              ❌ Votre dossier a été refusé. Contactez-nous à{' '}
              <Text as="a" href="mailto:commercial@stock212.com" textDecoration="underline" display="inline">
                commercial@stock212.com
              </Text>
            </Text>
          </Flex>
        </Box>
      )}

      {/* Page content — homepage gets full-bleed (no maxW / px) */}
      {loc.pathname === '/'
        ? <Box bg="white">{children}</Box>
        : <Box maxW="1400px" mx="auto" px={4} py={6}>{children}</Box>
      }

      {/* Comparator floating button */}
      <ComparatorFloat />

      {/* Footer */}
      <Box bg="gray.900" mt={16}>
        <Box maxW="1400px" mx="auto" px={4} pt={12} pb={8}>
          <Flex direction={{ base: 'column', md: 'row' }} gap={10} justify="space-between">
            <VStack align="start" spacing={4} maxW="260px">
              <Box bg="white" rounded="xl" p={2.5} display="inline-flex"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                <Image
                  src="/logos.png"
                  alt="Stock212"
                  h="168px"
                  w="auto"
                  objectFit="contain"
                />
              </Box>
              <Text color="gray.400" fontSize="sm" lineHeight={1.7}>
                La marketplace B2B de référence pour les professionnels FMCG en Europe et en Afrique.
              </Text>
              <HStack spacing={3}>
                {[Facebook, Twitter, Linkedin, Instagram].map((Icon, i) => (
                  <Flex key={i} w={8} h={8} bg="gray.800" rounded="lg" align="center" justify="center"
                    cursor="pointer" _hover={{ bg: N.amber }} transition="background 0.2s">
                    <Icon size={15} color="#9CA3AF" />
                  </Flex>
                ))}
              </HStack>
            </VStack>

            <Flex gap={10} flexWrap="wrap">
              <VStack align="start" spacing={3}>
                <Text color="white" fontWeight="semibold" fontSize="sm">Plateforme</Text>
                {[
                  { to: '/catalog', label: 'Catalogue produits' },
                  { to: '/best-deals', label: 'Meilleures offres' },
                  { to: '/brands', label: 'Nos marques' },
                  { to: '/how-it-works', label: 'Comment ça marche' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to}>
                    <Text color="gray.400" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.15s">{label}</Text>
                  </Link>
                ))}
              </VStack>

              <VStack align="start" spacing={3}>
                <Text color="white" fontWeight="semibold" fontSize="sm">Compte</Text>
                {[
                  { to: '/auth', label: 'Se connecter' },
                  { to: '/auth', label: "S'inscrire gratuitement" },
                  { to: '/buyer', label: 'Espace acheteur' },
                  { to: '/vendor', label: 'Espace vendeur' },
                ].map(({ to, label }) => (
                  <Link key={label} to={to}>
                    <Text color="gray.400" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.15s">{label}</Text>
                  </Link>
                ))}
              </VStack>

              <VStack align="start" spacing={3}>
                <Text color="white" fontWeight="semibold" fontSize="sm">Contact</Text>
                <HStack spacing={2}><Mail size={13} color="#6B7280" /><Text color="gray.400" fontSize="sm">contact@stock212.com</Text></HStack>
                <HStack spacing={2}><Phone size={13} color="#6B7280" /><Text color="gray.400" fontSize="sm">+33 1 XX XX XX XX</Text></HStack>
              </VStack>
            </Flex>
          </Flex>
        </Box>
        <Box borderTop="1px" borderColor="gray.800">
          <Flex maxW="1400px" mx="auto" px={4} py={5} justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Text color="gray.500" fontSize="xs">© {new Date().getFullYear()} Stock212. Tous droits réservés.</Text>
            <HStack spacing={5} fontSize="xs">
              {[{ to: '/legal/cgv', label: 'CGV' }, { to: '/legal/privacy', label: 'Confidentialité' }, { to: '/legal/mentions', label: 'Mentions légales' }].map(({ to, label }) => (
                <Link key={to} to={to}>
                  <Text color="gray.500" _hover={{ color: 'gray.200' }} transition="color 0.15s">{label}</Text>
                </Link>
              ))}
            </HStack>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
