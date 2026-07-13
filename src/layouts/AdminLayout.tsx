import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, Package, ShoppingCart, AlertTriangle,
  Truck, CreditCard, Tag, Bookmark, Building2, Barcode, Briefcase,
  Megaphone, Settings, FileText, ClipboardList, BarChart3,
  LogOut, Store, Bell, UserCircle, ChevronDown, ChevronRight,
  ClipboardCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: 'Supervision',
    items: [
      { label: 'Approbations dossiers', href: '/admin/approvals',           icon: <ClipboardCheck size={15} /> },
      { label: 'Organisations',         href: '/admin/organisations',       icon: <Users size={15} /> },
      { label: 'Commandes',             href: '/admin/orders',              icon: <ShoppingCart size={15} /> },
      { label: 'Litiges & SAV',         href: '/admin/disputes',            icon: <AlertTriangle size={15} /> },
      { label: 'Validation livreurs',   href: '/admin/delivery-validation', icon: <Truck size={15} /> },
      { label: 'Affectation livraisons',href: '/admin/delivery-assignment', icon: <Truck size={15} /> },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { label: 'Produits',         href: '/admin/products',           icon: <Package size={15} /> },
      { label: 'Catégories',       href: '/admin/categories',         icon: <Tag size={15} /> },
      { label: 'Marques',          href: '/admin/brands',             icon: <Bookmark size={15} /> },
      { label: 'Fournisseurs',     href: '/admin/suppliers',          icon: <Building2 size={15} /> },
      { label: 'Références EAN',   href: '/admin/ean-references',     icon: <Barcode size={15} /> },
      { label: "Types d'acteurs",  href: '/admin/business-categories',icon: <Briefcase size={15} /> },
    ],
  },
  {
    title: 'Finances',
    items: [
      { label: 'Finances plateforme', href: '/admin/finances', icon: <CreditCard size={15} /> },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Dashboard marketing', href: '/admin/marketing',               icon: <Megaphone size={15} /> },
      { label: 'Campagnes',           href: '/admin/marketing/campaigns',     icon: <BarChart3 size={15} /> },
      { label: 'Configuration',       href: '/admin/marketing/config',        icon: <Settings size={15} /> },
      { label: 'Notifications',       href: '/admin/marketing/notifications', icon: <Bell size={15} /> },
    ],
  },
  {
    title: 'Plateforme',
    items: [
      { label: "Équipe admin",         href: '/admin/team',       icon: <Users size={15} /> },
      { label: 'Paramètres globaux',   href: '/admin/settings',   icon: <Settings size={15} /> },
      { label: 'Contenus éditoriaux',  href: '/admin/content',    icon: <FileText size={15} /> },
      { label: "Journal d'audit",      href: '/admin/audit-logs', icon: <ClipboardList size={15} /> },
      { label: 'Statistiques',         href: '/admin/stats',      icon: <BarChart3 size={15} /> },
    ],
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { text: string; href: string }[];
}

export function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
  const navigate  = useNavigate();
  const { profile, signOut } = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside
        className="flex flex-col w-56 shrink-0 overflow-y-auto scrollbar-thin"
        style={{ background: '#0d1f38' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-white font-black text-xs shrink-0"
            style={{ background: '#c97d1a' }}
          >
            S
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm leading-none truncate">Stock212</div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Administration
            </div>
          </div>
        </div>

        {/* Dashboard shortcut */}
        <div className="px-2 pt-2">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'font-medium'
                  : 'hover:bg-white/5'
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? '#c97d1a' : 'rgba(255,255,255,0.65)',
              background: isActive ? 'rgba(201,125,26,0.12)' : undefined,
            })}
          >
            <LayoutDashboard size={15} />
            Tableau de bord
          </NavLink>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 px-2 pt-1 pb-3 space-y-3">
          {NAV.map((section) => (
            <div key={section.title}>
              <p
                className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                        isActive ? 'font-medium' : 'hover:bg-white/5'
                      }`
                    }
                    style={({ isActive }) => ({
                      color: isActive ? '#c97d1a' : 'rgba(255,255,255,0.55)',
                      background: isActive ? 'rgba(201,125,26,0.12)' : undefined,
                    })}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate leading-none">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 pb-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded text-sm transition-colors hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <Store size={14} />
            Voir le catalogue
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 h-12 bg-white border-b border-gray-200 shrink-0">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
            {(breadcrumbs ?? []).map((b, i) => (
              <span key={b.href} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={12} className="text-gray-400 shrink-0" />}
                {i === (breadcrumbs ?? []).length - 1 ? (
                  <span className="text-gray-800 font-medium truncate">{b.text}</span>
                ) : (
                  <button
                    onClick={() => navigate(b.href)}
                    className="text-gray-400 hover:text-gray-600 transition-colors truncate"
                  >
                    {b.text}
                  </button>
                )}
              </span>
            ))}
          </nav>

          {/* User dropdown */}
          <div className="relative shrink-0" ref={userRef}>
            <button
              onClick={() => setUserOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <UserCircle size={16} className="text-gray-400" />
              <span className="font-medium max-w-[110px] truncate">
                {profile?.full_name ?? 'Admin'}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => { navigate('/'); setUserOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Store size={13} />
                  Catalogue
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                 onClick={async () => { await signOut(); setUserOpen(false); navigate('/auth'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={13} />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
