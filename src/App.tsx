import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ChakraProvider, extendTheme, Spinner, Flex } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import '@cloudscape-design/global-styles/index.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ComparatorProvider } from './contexts/ComparatorContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageTransition } from './components/PageTransition';

// Layouts — loaded eagerly (always needed)
import StorefrontLayout from './layouts/StorefrontLayout';
import { VendorLayout, DeliveryLayout } from './layouts/CloudscapeLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Lazy pages — loaded only when the route is visited
const AuthPage             = lazy(() => import('./pages/auth/AuthPage'));
const OnboardingPage       = lazy(() => import('./pages/onboarding/OnboardingPage'));
const PendingApprovalPage  = lazy(() => import('./pages/onboarding/PendingApprovalPage'));
const HomePage             = lazy(() => import('./pages/storefront/HomePage'));
const CatalogPage          = lazy(() => import('./pages/storefront/CatalogPage'));
const BestDealsPage        = lazy(() => import('./pages/storefront/BestDealsPage'));
const DeliveryDirectoryPage    = lazy(() => import('./pages/storefront/DeliveryDirectoryPage'));
const DeliveryPartnerLanding   = lazy(() => import('./pages/storefront/DeliveryPartnerLanding'));
const ProductDetailPage    = lazy(() => import('./pages/storefront/ProductDetailPage'));
const HowItWorksPage       = lazy(() => import('./pages/storefront/HowItWorksPage'));
const ComparatorPage       = lazy(() => import('./pages/storefront/ComparatorPage'));
const BrandsPage           = lazy(() => import('./pages/storefront/BrandsPage'));
const BoutiquesPage        = lazy(() => import('./pages/storefront/BoutiquesPage'));
const BoutiquePage         = lazy(() => import('./pages/storefront/BoutiquePage'));
const BrandPage            = lazy(() => import('./pages/storefront/BrandPage'));
const BuyerDashboard       = lazy(() => import('./pages/buyer/BuyerDashboard'));
const MesCommandesPage     = lazy(() => import('./pages/buyer/MesCommandesPage'));
const BuyerOrderDetail     = lazy(() => import('./pages/buyer/BuyerOrderDetail'));
const MesPaniersPage       = lazy(() => import('./pages/buyer/MesPaniersPage'));
const InsightsPage         = lazy(() => import('./pages/buyer/InsightsPage'));
const WishlistPage         = lazy(() => import('./pages/buyer/WishlistPage'));
const MesFinancesPage      = lazy(() => import('./pages/buyer/MesFinancesPage'));
const BuyerQuotesPage      = lazy(() => import('./pages/buyer/BuyerQuotesPage'));
const MonComptePage        = lazy(() => import('./pages/buyer/MonComptePage'));
const CheckoutPage         = lazy(() => import('./pages/buyer/CheckoutPage'));
const QuickOrderPage       = lazy(() => import('./pages/buyer/QuickOrderPage'));
const EanReferencePage     = lazy(() => import('./pages/buyer/EanReferencePage'));
const BuyerCatalog         = lazy(() => import('./pages/buyer/BuyerCatalog'));
const BuyerDestockage      = lazy(() => import('./pages/buyer/BuyerDestockage'));
const BuyerComparateur     = lazy(() => import('./pages/buyer/BuyerComparateur'));
const BuyerOptimiseur      = lazy(() => import('./pages/buyer/BuyerOptimiseur'));
const VendorOverview       = lazy(() => import('./pages/vendor/VendorOverview'));
const VendorCatalog        = lazy(() => import('./pages/vendor/VendorCatalog'));
const VendorOrders         = lazy(() => import('./pages/vendor/VendorOrders'));
const VendorQuotes         = lazy(() => import('./pages/vendor/VendorQuotes'));
const VendorPromotions     = lazy(() => import('./pages/vendor/VendorPromotions'));
const VendorTeam           = lazy(() => import('./pages/vendor/VendorTeam'));
const VendorLots           = lazy(() => import('./pages/vendor/VendorLots'));
const VendorDeliveries     = lazy(() => import('./pages/vendor/VendorDeliveries'));
const VendorFinances       = lazy(() => import('./pages/vendor/VendorFinances'));
const VendorBuyers         = lazy(() => import('./pages/vendor/VendorBuyers'));
const VendorSAV            = lazy(() => import('./pages/vendor/VendorSAV'));
const VendorSettings       = lazy(() => import('./pages/vendor/VendorSettings'));
const VendorBrands         = lazy(() => import('./pages/vendor/VendorBrands'));
const VendorBoutique       = lazy(() => import('./pages/vendor/VendorBoutique'));
const FicheProduitEdit     = lazy(() => import('./pages/vendor/FicheProduitEdit'));
const DeliveryOverview     = lazy(() => import('./pages/delivery/DeliveryOverview'));
const DeliveryProfile      = lazy(() => import('./pages/delivery/DeliveryProfile'));
const DeliveryFinances     = lazy(() => import('./pages/delivery/DeliveryFinances'));
const DeliveryReviews      = lazy(() => import('./pages/delivery/DeliveryReviews'));
const DeliveryOnboarding   = lazy(() => import('./pages/delivery/DeliveryOnboarding'));
const AdminDashboard          = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminDeliveryValidation  = lazy(() => import('./pages/admin/AdminDeliveryValidation'));
const AdminDeliveryAssignment  = lazy(() => import('./pages/admin/AdminDeliveryAssignment'));
const AdminCategories         = lazy(() => import('./pages/admin/AdminCategories'));
const AdminBrands             = lazy(() => import('./pages/admin/AdminBrands'));
const AdminSuppliers          = lazy(() => import('./pages/admin/AdminSuppliers'));
const AdminBusinessCategories = lazy(() => import('./pages/admin/AdminBusinessCategories'));
const AdminContent            = lazy(() => import('./pages/admin/AdminContent'));
const AdminStats              = lazy(() => import('./pages/admin/AdminStats'));
const AdminOrganisations      = lazy(() => import('./pages/admin/AdminOrganisations'));
const AdminSettings           = lazy(() => import('./pages/admin/AdminSettings'));
const AdminTeam               = lazy(() => import('./pages/admin/AdminTeam'));
const AdminOrders             = lazy(() => import('./pages/admin/AdminOrders'));
const AdminDisputes           = lazy(() => import('./pages/admin/AdminDisputes'));
const AdminProducts           = lazy(() => import('./pages/admin/AdminProducts'));
const AdminEanReferences      = lazy(() => import('./pages/admin/AdminEanReferences'));
const AdminFinances           = lazy(() => import('./pages/admin/AdminFinances'));
const AdminAuditLogs          = lazy(() => import('./pages/admin/AdminAuditLogs'));
// Marketing module
const AdminApprovals              = lazy(() => import('./pages/admin/AdminApprovals'));
const AdminMarketing              = lazy(() => import('./pages/admin/AdminMarketing'));
const AdminMarketingConfig        = lazy(() => import('./pages/admin/AdminMarketingConfig'));
const AdminMarketingCampaigns     = lazy(() => import('./pages/admin/AdminMarketingCampaigns'));
const AdminMarketingNotifications = lazy(() => import('./pages/admin/AdminMarketingNotifications'));
const VendorMarketingHub          = lazy(() => import('./pages/vendor/marketing/VendorMarketingHub'));
const VendorCredits               = lazy(() => import('./pages/vendor/marketing/VendorCredits'));
const VendorCampaignCreate        = lazy(() => import('./pages/vendor/marketing/VendorCampaignCreate'));
const VendorCampaignList          = lazy(() => import('./pages/vendor/marketing/VendorCampaignList'));
const VendorLiquidation           = lazy(() => import('./pages/vendor/marketing/VendorLiquidation'));
const VendorSampling              = lazy(() => import('./pages/vendor/marketing/VendorSampling'));
const BuyerLiquidationMarket      = lazy(() => import('./pages/buyer/BuyerLiquidationMarket'));
const BuyerTierUpgrade            = lazy(() => import('./pages/buyer/BuyerTierUpgrade'));
const BuyerLoyalty                = lazy(() => import('./pages/buyer/BuyerLoyalty'));
const BuyerTradeRequests          = lazy(() => import('./pages/buyer/BuyerTradeRequests'));
const NotFoundPage         = lazy(() => import('./pages/NotFoundPage'));

const chakraTheme = extendTheme({
  fonts: {
    heading: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  },
  colors: {
    // Remplacement complet du bleu SaaS générique par un navy corporate
    blue: {
      50: '#eef4ff',
      100: '#dce8ff',
      200: '#b9d0ff',
      300: '#89adfd',
      400: '#5583f7',
      500: '#2c5dee',
      600: '#1d4bca',
      700: '#143899',
      800: '#0e2778',
      900: '#0a1a52',
    },
    brand: {
      50: '#eef4ff',
      100: '#dce8ff',
      200: '#b9d0ff',
      300: '#89adfd',
      400: '#5583f7',
      500: '#2c5dee',
      600: '#1d4bca',
      700: '#143899',
      800: '#0e2778',
      900: '#0a1a52',
    },
  },
  // Réduction globale des border-radius — élimine l'aspect consumer/SaaS
  radii: {
    none: '0',
    sm: '3px',
    base: '4px',
    md: '6px',
    lg: '8px',
    xl: '10px',
    '2xl': '12px',
    '3xl': '14px',
    '4xl': '16px',
    full: '9999px',
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'blue' },
      baseStyle: {
        fontWeight: '600',
        borderRadius: '6px',
        letterSpacing: '0.01em',
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'blue.500' },
      baseStyle: { field: { borderRadius: '4px' } },
      variants: {
        outline: {
          field: {
            borderRadius: '4px',
            _focus: { borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' },
          },
        },
      },
    },
    Select: {
      defaultProps: { focusBorderColor: 'blue.500' },
      baseStyle: { field: { borderRadius: '4px' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'blue.500' },
      baseStyle: { borderRadius: '4px' },
    },
    Badge: {
      baseStyle: { borderRadius: '4px', fontWeight: '600', letterSpacing: '0.02em' },
    },
    Tag: {
      baseStyle: { container: { borderRadius: '4px' } },
    },
    Modal: {
      baseStyle: {
        dialog: { borderRadius: '8px' },
      },
    },
    Menu: {
      baseStyle: {
        list: { borderRadius: '6px' },
        item: { _hover: { bg: 'gray.50' } },
      },
    },
    Tabs: {
      variants: {
        line: {
          tab: {
            fontWeight: '500',
            color: 'gray.500',
            _selected: { color: 'blue.700', borderColor: 'blue.600' },
          },
        },
        'enclosed-colored': {
          tab: {
            borderRadius: '6px 6px 0 0',
            fontWeight: '500',
          },
        },
      },
    },
    Alert: {
      baseStyle: { container: { borderRadius: '6px' } },
    },
  },
  styles: {
    global: {
      body: { bg: '#f8fafc', color: 'gray.900', fontSize: '14px' },
      '*': { borderColor: 'gray.100' },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function LoadingScreen() {
  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Spinner size="xl" color="blue.500" thickness="3px" />
    </Flex>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RedirectAuthenticated() {
  const { user, profile, activeOrg, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return null;
  if (profile === null) return <LoadingScreen />;
  if (!profile.onboarding_done) return <Navigate to="/onboarding" replace />;
  const from = (location.state as { from?: Location })?.from?.pathname;
  if (from && from !== '/auth') return <Navigate to={from} replace />;
  if (activeOrg?.org_type === 'seller') return <Navigate to="/vendor" replace />;
  if (activeOrg?.org_type === 'delivery') return <Navigate to="/delivery" replace />;
  return <Navigate to="/buyer" replace />;
}

// Accès limité : dashboard visible, onboarding obligatoire
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile === null) return <LoadingScreen />;
  if (!profile.onboarding_done) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

// Accès complet : onboarding + validation admin obligatoires
function RequireOnboardingDone({ children }: { children: React.ReactNode }) {
  const { user, profile, activeOrg, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile === null) return <LoadingScreen />;
  if (!profile.onboarding_done) return <Navigate to="/onboarding" replace />;
  if (activeOrg?.validation_status !== 'active') return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
}

function RequireBuyer({ children }: { children: React.ReactNode }) {
  const { activeOrg, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (activeOrg?.org_type === 'delivery') return <Navigate to="/delivery" replace />;
  if (activeOrg?.org_type === 'seller') return <Navigate to="/vendor" replace />;
  return <>{children}</>;
}

function RequireVendor({ children }: { children: React.ReactNode }) {
  const { activeOrg, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!activeOrg || activeOrg.org_type !== 'seller') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function RequireDelivery({ children }: { children: React.ReactNode }) {
  const { activeOrg, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!activeOrg || activeOrg.org_type !== 'delivery') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth — redirect away if already logged in */}
      <Route
        path="/auth"
        element={
          <>
            <RedirectAuthenticated />
            <AuthPage />
          </>
        }
      />

      {/* Onboarding */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />

      {/* Validation en attente */}
      <Route
        path="/pending-approval"
        element={
          <RequireAuth>
            <PendingApprovalPage />
          </RequireAuth>
        }
      />

      {/* Consumer storefront — Chakra */}
      <Route
        path="/"
        element={
          <StorefrontLayout>
            <HomePage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/catalog"
        element={
          <StorefrontLayout>
            <CatalogPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/best-deals"
        element={
          <StorefrontLayout>
            <BestDealsPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/delivery-directory"
        element={
          <StorefrontLayout>
            <DeliveryDirectoryPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/product/:id"
        element={
          <StorefrontLayout>
            <ProductDetailPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/devenir-livreur"
        element={
          <StorefrontLayout>
            <DeliveryPartnerLanding />
          </StorefrontLayout>
        }
      />
      <Route
        path="/how-it-works"
        element={
          <StorefrontLayout>
            <HowItWorksPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/compare"
        element={
          <StorefrontLayout>
            <ComparatorPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/brands"
        element={
          <StorefrontLayout>
            <BrandsPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/boutiques"
        element={
          <StorefrontLayout>
            <BoutiquesPage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/boutiques/:id"
        element={
          <StorefrontLayout>
            <BoutiquePage />
          </StorefrontLayout>
        }
      />
      <Route
        path="/brands/:id"
        element={
          <StorefrontLayout>
            <BrandPage />
          </StorefrontLayout>
        }
      />

      {/* Buyer dashboard — Chakra */}
      <Route
        path="/buyer"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <BuyerDashboard />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/orders"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <MesCommandesPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/orders/:id"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <BuyerOrderDetail />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/carts"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <MesPaniersPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/quotes"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <BuyerQuotesPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/quotes/:id"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <BuyerQuotesPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/insights"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <InsightsPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/wishlist"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <WishlistPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/finances"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <MesFinancesPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />
      <Route
        path="/buyer/account"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <MonComptePage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />

      {/* Quick Order EAN */}
      <Route
        path="/buyer/quick-order"
        element={
          <RequireOnboardingDone>
            <RequireBuyer>
              <StorefrontLayout>
                <QuickOrderPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboardingDone>
        }
      />

      {/* Catalogue exhaustif */}
      <Route path="/buyer/catalog" element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerCatalog /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />

      {/* Déstockage & DLC proches */}
      <Route path="/buyer/destockage" element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerDestockage /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />

      {/* Comparateur de prix multi-vendeurs */}
      <Route path="/buyer/compare" element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerComparateur /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />

      {/* Optimiseur prix + livraison */}
      <Route path="/buyer/optimizer" element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerOptimiseur /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />

      {/* EAN Reference catalogue */}
      <Route
        path="/buyer/ean-catalogue"
        element={
          <RequireOnboarding>
            <RequireBuyer>
              <StorefrontLayout>
                <EanReferencePage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboarding>
        }
      />

      {/* Checkout */}
      <Route
        path="/checkout"
        element={
          <RequireOnboardingDone>
            <RequireBuyer>
              <StorefrontLayout>
                <CheckoutPage />
              </StorefrontLayout>
            </RequireBuyer>
          </RequireOnboardingDone>
        }
      />

      {/* Vendor dashboard — Cloudscape */}
      <Route
        path="/vendor"
        element={
          <RequireOnboarding>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Vue d\'ensemble', href: '/vendor' }]}>
                <VendorOverview />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboarding>
        }
      />
      <Route
        path="/vendor/catalog"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Catalogue', href: '/vendor/catalog' }]}>
                <VendorCatalog />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/orders"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Commandes', href: '/vendor/orders' }]}>
                <VendorOrders />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/quotes"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Devis', href: '/vendor/quotes' }]}>
                <VendorQuotes />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/promotions"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Promotions', href: '/vendor/promotions' }]}>
                <VendorPromotions />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/team"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Équipe', href: '/vendor/team' }]}>
                <VendorTeam />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/lots"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Lots & DLC', href: '/vendor/lots' }]}>
                <VendorLots />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/deliveries"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Expéditions', href: '/vendor/deliveries' }]}>
                <VendorDeliveries />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/finances"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Finances', href: '/vendor/finances' }]}>
                <VendorFinances />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/buyers"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Acheteurs', href: '/vendor/buyers' }]}>
                <VendorBuyers />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/sav"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'SAV & Litiges', href: '/vendor/sav' }]}>
                <VendorSAV />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/settings"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Paramètres', href: '/vendor/settings' }]}>
                <VendorSettings />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/brands"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marques', href: '/vendor/brands' }]}>
                <VendorBrands />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/boutique"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Ma boutique', href: '/vendor/boutique' }]}>
                <VendorBoutique />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/vendor/catalog/:id"
        element={
          <RequireOnboardingDone>
            <RequireVendor>
              <VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Catalogue', href: '/vendor/catalog' }, { text: 'Modifier', href: '#' }]}>
                <FicheProduitEdit />
              </VendorLayout>
            </RequireVendor>
          </RequireOnboardingDone>
        }
      />

      {/* Delivery dashboard — Cloudscape */}
      <Route
        path="/delivery"
        element={
          <RequireOnboarding>
            <RequireDelivery>
              <DeliveryLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Vue d\'ensemble', href: '/delivery' }]}>
                <DeliveryOverview />
              </DeliveryLayout>
            </RequireDelivery>
          </RequireOnboarding>
        }
      />
      <Route
        path="/delivery/onboarding"
        element={
          <RequireOnboarding>
            <RequireDelivery>
              <DeliveryLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Tableau de bord', href: '/delivery' }, { text: 'Inscription partenaire', href: '/delivery/onboarding' }]}>
                <DeliveryOnboarding />
              </DeliveryLayout>
            </RequireDelivery>
          </RequireOnboarding>
        }
      />
      <Route
        path="/delivery/tickets"
        element={<Navigate to="/delivery" replace />}
      />
      <Route
        path="/delivery/profile"
        element={
          <RequireOnboardingDone>
            <RequireDelivery>
              <DeliveryLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Tableau de bord', href: '/delivery' }, { text: 'Profil & Documents', href: '/delivery/profile' }]}>
                <DeliveryProfile />
              </DeliveryLayout>
            </RequireDelivery>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/delivery/finances"
        element={
          <RequireOnboardingDone>
            <RequireDelivery>
              <DeliveryLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Tableau de bord', href: '/delivery' }, { text: 'Finances', href: '/delivery/finances' }]}>
                <DeliveryFinances />
              </DeliveryLayout>
            </RequireDelivery>
          </RequireOnboardingDone>
        }
      />
      <Route
        path="/delivery/zones"
        element={<Navigate to="/delivery/profile" replace />}
      />
      <Route
        path="/delivery/reviews"
        element={
          <RequireOnboardingDone>
            <RequireDelivery>
              <DeliveryLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Tableau de bord', href: '/delivery' }, { text: 'Évaluations', href: '/delivery/reviews' }]}>
                <DeliveryReviews />
              </DeliveryLayout>
            </RequireDelivery>
          </RequireOnboardingDone>
        }
      />

      {/* Admin — Cloudscape (requires is_admin = true on profile) */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }]}>
              <AdminDashboard />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/delivery-validation"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Validation livreurs', href: '/admin/delivery-validation' }]}>
              <AdminDeliveryValidation />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/delivery-assignment"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Affectation livraisons', href: '/admin/delivery-assignment' }]}>
              <AdminDeliveryAssignment />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Catégories', href: '/admin/categories' }]}>
              <AdminCategories />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/approvals"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Approbations', href: '/admin/approvals' }]}>
              <AdminApprovals />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/organisations"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Organisations', href: '/admin/organisations' }]}>
              <AdminOrganisations />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Paramètres', href: '/admin/settings' }]}>
              <AdminSettings />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/team"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Équipe', href: '/admin/team' }]}>
              <AdminTeam />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Commandes', href: '/admin/orders' }]}>
              <AdminOrders />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/disputes"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Litiges', href: '/admin/disputes' }]}>
              <AdminDisputes />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/ean-references"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Références EAN', href: '/admin/ean-references' }]}>
              <AdminEanReferences />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/products"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Produits', href: '/admin/products' }]}>
              <AdminProducts />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/finances"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Finances', href: '/admin/finances' }]}>
              <AdminFinances />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Journal d\'audit', href: '/admin/audit-logs' }]}>
              <AdminAuditLogs />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/brands"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Marques', href: '/admin/brands' }]}>
              <AdminBrands />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/suppliers"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Fournisseurs', href: '/admin/suppliers' }]}>
              <AdminSuppliers />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/business-categories"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Types d\'acteurs', href: '/admin/business-categories' }]}>
              <AdminBusinessCategories />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/content"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Contenus éditoriaux', href: '/admin/content' }]}>
              <AdminContent />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/stats"
        element={
          <RequireAdmin>
            <AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Statistiques', href: '/admin/stats' }]}>
              <AdminStats />
            </AdminLayout>
          </RequireAdmin>
        }
      />
      {/* Admin — Marketing */}
      <Route path="/admin/marketing" element={<RequireAdmin><AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Marketing', href: '/admin/marketing' }]}><AdminMarketing /></AdminLayout></RequireAdmin>} />
      <Route path="/admin/marketing/config" element={<RequireAdmin><AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Marketing', href: '/admin/marketing' }, { text: 'Configuration', href: '/admin/marketing/config' }]}><AdminMarketingConfig /></AdminLayout></RequireAdmin>} />
      <Route path="/admin/marketing/campaigns" element={<RequireAdmin><AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Marketing', href: '/admin/marketing' }, { text: 'Campagnes', href: '/admin/marketing/campaigns' }]}><AdminMarketingCampaigns /></AdminLayout></RequireAdmin>} />
      <Route path="/admin/marketing/notifications" element={<RequireAdmin><AdminLayout breadcrumbs={[{ text: 'Admin', href: '/admin' }, { text: 'Marketing', href: '/admin/marketing' }, { text: 'Notifications', href: '/admin/marketing/notifications' }]}><AdminMarketingNotifications /></AdminLayout></RequireAdmin>} />

      {/* Vendor — Marketing */}
      <Route path="/vendor/marketing" element={<RequireOnboardingDone><RequireVendor><VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marketing', href: '/vendor/marketing' }]}><VendorMarketingHub /></VendorLayout></RequireVendor></RequireOnboardingDone>} />
      <Route path="/vendor/marketing/credits" element={<RequireOnboardingDone><RequireVendor><VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marketing', href: '/vendor/marketing' }, { text: 'Crédits', href: '/vendor/marketing/credits' }]}><VendorCredits /></VendorLayout></RequireVendor></RequireOnboardingDone>} />
      <Route path="/vendor/marketing/campaigns" element={<RequireOnboardingDone><RequireVendor><VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marketing', href: '/vendor/marketing' }, { text: 'Campagnes', href: '/vendor/marketing/campaigns' }]}><VendorCampaignList /></VendorLayout></RequireVendor></RequireOnboardingDone>} />
      <Route path="/vendor/marketing/campaigns/create" element={<RequireOnboardingDone><RequireVendor><VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marketing', href: '/vendor/marketing' }, { text: 'Nouvelle campagne', href: '/vendor/marketing/campaigns/create' }]}><VendorCampaignCreate /></VendorLayout></RequireVendor></RequireOnboardingDone>} />
      <Route path="/vendor/marketing/liquidation" element={<RequireOnboardingDone><RequireVendor><VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marketing', href: '/vendor/marketing' }, { text: 'Liquidation', href: '/vendor/marketing/liquidation' }]}><VendorLiquidation /></VendorLayout></RequireVendor></RequireOnboardingDone>} />
      <Route path="/vendor/marketing/sampling" element={<RequireOnboardingDone><RequireVendor><VendorLayout breadcrumbs={[{ text: 'Stock212', href: '/' }, { text: 'Marketing', href: '/vendor/marketing' }, { text: 'Échantillons', href: '/vendor/marketing/sampling' }]}><VendorSampling /></VendorLayout></RequireVendor></RequireOnboardingDone>} />

      {/* Buyer — Marketing */}
      <Route path="/buyer/liquidation"    element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerLiquidationMarket /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />
      <Route path="/buyer/tier-upgrade"   element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerTierUpgrade /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />
      <Route path="/buyer/loyalty"        element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerLoyalty /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />
      <Route path="/buyer/trade-requests" element={<RequireOnboarding><RequireBuyer><StorefrontLayout><BuyerTradeRequests /></StorefrontLayout></RequireBuyer></RequireOnboarding>} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <StorefrontLayout>
            <NotFoundPage />
          </StorefrontLayout>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={chakraTheme}>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <ComparatorProvider>
                <PageTransition>
                  <Suspense fallback={<LoadingScreen />}>
                    <AppRoutes />
                  </Suspense>
                </PageTransition>
              </ComparatorProvider>
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </ChakraProvider>
    </QueryClientProvider>
  );
}
