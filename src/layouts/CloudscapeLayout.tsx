import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppLayout,
  SideNavigation,
  TopNavigation,
  BreadcrumbGroup,
  Flashbar,
} from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import { useAuth } from '../contexts/AuthContext';

interface CloudscapeLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { text: string; href: string }[];
  headerText?: string;
  navItems?: { type: string; text: string; href: string; icon?: string }[];
}

const VENDOR_NAV = [
  { type: 'link' as const, text: 'Tableau de bord', href: '/vendor' },
  { type: 'divider' as const },
  { type: 'section' as const, text: 'Commercial', items: [
    { type: 'link' as const, text: 'Commandes',   href: '/vendor/orders' },
    { type: 'link' as const, text: 'Devis',       href: '/vendor/quotes' },
    { type: 'link' as const, text: 'Lots & DLC',  href: '/vendor/lots' },
    { type: 'link' as const, text: 'Promotions',  href: '/vendor/promotions' },
  ]},
  { type: 'section' as const, text: 'Catalogue', items: [
    { type: 'link' as const, text: 'Mes produits', href: '/vendor/catalog' },
    { type: 'link' as const, text: 'Mes marques',  href: '/vendor/brands' },
    { type: 'link' as const, text: 'Ma boutique',  href: '/vendor/boutique' },
  ]},
  { type: 'section' as const, text: 'Logistique', items: [
    { type: 'link' as const, text: 'Expéditions', href: '/vendor/deliveries' },
  ]},
  { type: 'section' as const, text: 'Finance', items: [
    { type: 'link' as const, text: 'Facturation & Wallet', href: '/vendor/finances' },
  ]},
  { type: 'section' as const, text: 'Acheteurs', items: [
    { type: 'link' as const, text: 'Liste acheteurs', href: '/vendor/buyers' },
  ]},
  { type: 'section' as const, text: 'SAV & Litiges', items: [
    { type: 'link' as const, text: 'Retours & Réclamations', href: '/vendor/sav' },
  ]},
  { type: 'section' as const, text: 'Marketing', items: [
    { type: 'link' as const, text: 'Hub Marketing',          href: '/vendor/marketing' },
    { type: 'link' as const, text: 'Mes crédits',            href: '/vendor/marketing/credits' },
    { type: 'link' as const, text: 'Mes campagnes',          href: '/vendor/marketing/campaigns' },
    { type: 'link' as const, text: 'Liquidation',            href: '/vendor/marketing/liquidation' },
    { type: 'link' as const, text: 'Échantillons',           href: '/vendor/marketing/sampling' },
  ]},
  { type: 'section' as const, text: 'Paramètres', items: [
    { type: 'link' as const, text: 'Mon entreprise & Config', href: '/vendor/settings' },
    { type: 'link' as const, text: 'Équipe',                  href: '/vendor/team' },
  ]},
];

const DELIVERY_NAV = [
  { type: 'link' as const, text: 'Vue d\'ensemble', href: '/delivery' },
  { type: 'divider' as const },
  { type: 'link' as const, text: 'Évaluations', href: '/delivery/reviews' },
  { type: 'link' as const, text: 'Finances',     href: '/delivery/finances' },
  { type: 'divider' as const },
  { type: 'link' as const, text: 'Profil & Documents', href: '/delivery/profile' },
];

const ADMIN_NAV = [
  { type: 'link' as const, text: 'Tableau de bord', href: '/admin' },
  { type: 'divider' as const },
  { type: 'section' as const, text: 'Gestion plateforme', items: [
    { type: 'link' as const, text: '⏳ Approbations dossiers', href: '/admin/approvals'           },
    { type: 'link' as const, text: 'Utilisateurs & Orgs',    href: '/admin/organisations'       },
    { type: 'link' as const, text: 'Tous les produits',      href: '/admin/products'            },
    { type: 'link' as const, text: 'Toutes les commandes',   href: '/admin/orders'              },
    { type: 'link' as const, text: 'Litiges & SAV',          href: '/admin/disputes'            },
    { type: 'link' as const, text: 'Validation livreurs',    href: '/admin/delivery-validation' },
    { type: 'link' as const, text: 'Affectation livraisons', href: '/admin/delivery-assignment' },
  ]},
  { type: 'section' as const, text: 'Finances', items: [
    { type: 'link' as const, text: 'Finances plateforme', href: '/admin/finances' },
  ]},
  { type: 'section' as const, text: 'Catalogue', items: [
    { type: 'link' as const, text: 'Catégories',        href: '/admin/categories'          },
    { type: 'link' as const, text: 'Marques',           href: '/admin/brands'              },
    { type: 'link' as const, text: 'Fournisseurs',      href: '/admin/suppliers'           },
    { type: 'link' as const, text: 'Références EAN',    href: '/admin/ean-references'      },
    { type: 'link' as const, text: 'Types d\'acteurs',  href: '/admin/business-categories' },
  ]},
  { type: 'section' as const, text: 'Marketing', items: [
    { type: 'link' as const, text: 'Dashboard marketing',     href: '/admin/marketing' },
    { type: 'link' as const, text: 'Toutes les campagnes',    href: '/admin/marketing/campaigns' },
    { type: 'link' as const, text: 'Configuration',           href: '/admin/marketing/config' },
    { type: 'link' as const, text: 'Notifications',           href: '/admin/marketing/notifications' },
  ]},
  { type: 'section' as const, text: 'Équipe & Accès', items: [
    { type: 'link' as const, text: 'Équipe d\'administration', href: '/admin/team' },
  ]},
  { type: 'section' as const, text: 'Plateforme', items: [
    { type: 'link' as const, text: 'Paramètres globaux',    href: '/admin/settings'    },
    { type: 'link' as const, text: 'Contenus éditoriaux',   href: '/admin/content'     },
    { type: 'link' as const, text: 'Journal d\'audit',      href: '/admin/audit-logs'  },
    { type: 'link' as const, text: 'Statistiques',          href: '/admin/stats'       },
  ]},
];

export function VendorLayout({ children, breadcrumbs }: CloudscapeLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, activeOrg, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNavigation
        identity={{
          href: '/vendor',
          title: 'Stock212 — Vendeur',
          logo: { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="%230972d3"/></svg>', alt: 'Stock212' },
        }}
        utilities={[
          {
            type: 'menu-dropdown',
            text: profile?.full_name ?? 'Mon compte',
            description: activeOrg?.name ?? '',
            iconName: 'user-profile',
            items: [
              { id: 'storefront', text: 'Aller au catalogue', href: '/' },
              { id: 'divider', text: '-', itemType: 'divider' },
              { id: 'signout', text: 'Déconnexion' },
            ],
            onItemClick: ({ detail }) => {
              if (detail.id === 'signout') { signOut().then(() => navigate('/auth')); }
              else if (detail.id === 'storefront') navigate('/');
            },
          },
        ]}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AppLayout
          navigation={
            <SideNavigation
              header={{ href: '/vendor', text: activeOrg?.name ?? 'Vendeur' }}
              activeHref={location.pathname}
              items={VENDOR_NAV}
              onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
            />
          }
          breadcrumbs={
            breadcrumbs && (
              <BreadcrumbGroup
                items={breadcrumbs}
                onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
              />
            )
          }
          content={
            <>
              {activeOrg?.validation_status === 'pending' && (
                <Flashbar items={[{
                  type: 'info',
                  content: 'Votre dossier est en cours de validation. Un commercial Stock212 vous contactera sous 24–48h pour activer votre accès complet.',
                  id: 'pending-banner',
                }]} />
              )}
              {activeOrg?.validation_status === 'rejected' && (
                <Flashbar items={[{
                  type: 'error',
                  content: 'Votre dossier a été refusé. Contactez-nous à commercial@stock212.com pour plus d\'informations.',
                  id: 'rejected-banner',
                }]} />
              )}
              {children}
            </>
          }
          contentType="default"
          toolsHide
          navigationOpen={navOpen}
          onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        />
      </div>
    </div>
  );
}

export function DeliveryLayout({ children, breadcrumbs }: CloudscapeLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, activeOrg, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNavigation
        identity={{
          href: '/delivery',
          title: 'Stock212 — Livreur',
          logo: { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="%23037f0c"/></svg>', alt: 'Stock212' },
        }}
        utilities={[
          {
            type: 'menu-dropdown',
            text: profile?.full_name ?? 'Mon compte',
            description: activeOrg?.name ?? '',
            iconName: 'user-profile',
            items: [
              { id: 'storefront', text: 'Aller au catalogue', href: '/' },
              { id: 'divider', text: '-', itemType: 'divider' },
              { id: 'signout', text: 'Déconnexion' },
            ],
            onItemClick: ({ detail }) => {
              if (detail.id === 'signout') { signOut().then(() => navigate('/auth')); }
              else if (detail.id === 'storefront') navigate('/');
            },
          },
        ]}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AppLayout
          navigation={
            <SideNavigation
              header={{ href: '/delivery', text: activeOrg?.name ?? 'Livreur' }}
              activeHref={location.pathname}
              items={DELIVERY_NAV}
              onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
            />
          }
          breadcrumbs={
            breadcrumbs && (
              <BreadcrumbGroup
                items={breadcrumbs}
                onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
              />
            )
          }
          content={
            <>
              {activeOrg?.validation_status === 'pending' && (
                <Flashbar items={[{
                  type: 'info',
                  content: 'Votre dossier est en cours de validation. Un commercial Stock212 vous contactera sous 24–48h pour activer votre accès complet.',
                  id: 'pending-banner',
                }]} />
              )}
              {activeOrg?.validation_status === 'rejected' && (
                <Flashbar items={[{
                  type: 'error',
                  content: 'Votre dossier a été refusé. Contactez-nous à commercial@stock212.com pour plus d\'informations.',
                  id: 'rejected-banner',
                }]} />
              )}
              {children}
            </>
          }
          contentType="default"
          toolsHide
          navigationOpen={navOpen}
          onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        />
      </div>
    </div>
  );
}

export function AdminLayout({ children, breadcrumbs }: CloudscapeLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNavigation
        identity={{
          href: '/admin',
          title: 'Stock212 — Admin',
          logo: { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="%23d13212"/></svg>', alt: 'Stock212' },
        }}
        utilities={[
          {
            type: 'menu-dropdown',
            text: profile?.full_name ?? 'Admin',
            iconName: 'user-profile',
            items: [
              { id: 'storefront', text: 'Aller au catalogue' },
              { id: 'divider', text: '-', itemType: 'divider' },
              { id: 'signout', text: 'Déconnexion' },
            ],
            onItemClick: ({ detail }) => {
              if (detail.id === 'signout') { signOut().then(() => navigate('/auth')); }
              else if (detail.id === 'storefront') navigate('/');
            },
          },
        ]}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AppLayout
          navigation={
            <SideNavigation
              header={{ href: '/admin', text: 'Administration' }}
              activeHref={location.pathname}
              items={ADMIN_NAV}
              onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
            />
          }
          breadcrumbs={
            breadcrumbs && (
              <BreadcrumbGroup
                items={breadcrumbs}
                onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
              />
            )
          }
          content={children}
          contentType="default"
          toolsHide
          navigationOpen={navOpen}
          onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        />
      </div>
    </div>
  );
}
