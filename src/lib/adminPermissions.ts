import type { AdminRole } from '../types';

// ── Permission definition ─────────────────────────────────────────────────────
export interface PermissionDef {
  key: string;
  label: string;
  desc: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

// ── All platform permissions, grouped by module ───────────────────────────────
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    permissions: [
      { key: 'dashboard.view', label: 'Voir le tableau de bord', desc: 'Accès à la vue d\'ensemble KPIs et alertes' },
    ],
  },
  {
    id: 'orgs',
    label: 'Utilisateurs & Organisations',
    permissions: [
      { key: 'orgs.view',     label: 'Voir les organisations',               desc: 'Lister et consulter toutes les orgs' },
      { key: 'orgs.edit',     label: 'Modifier une organisation',             desc: 'Mettre à jour les infos d\'une org' },
      { key: 'orgs.validate', label: 'Valider / rejeter une inscription',     desc: 'Approuver ou refuser les nouvelles orgs' },
      { key: 'orgs.delete',   label: 'Supprimer / désactiver une organisation', desc: 'Action irréversible — destructif' },
    ],
  },
  {
    id: 'products',
    label: 'Catalogue produits',
    permissions: [
      { key: 'products.view',     label: 'Voir tous les produits',             desc: 'Consulter le catalogue complet' },
      { key: 'products.edit',     label: 'Modifier une fiche produit',          desc: 'Éditer nom, description, catégorie…' },
      { key: 'products.moderate', label: 'Activer / désactiver un produit',     desc: 'Changer le statut visible sur la marketplace' },
      { key: 'products.delete',   label: 'Archiver / supprimer un produit',     desc: 'Action destructive — irréversible' },
    ],
  },
  {
    id: 'orders',
    label: 'Commandes',
    permissions: [
      { key: 'orders.view',   label: 'Voir toutes les commandes',          desc: 'Lister et consulter toutes les commandes plateforme' },
      { key: 'orders.status', label: 'Changer le statut d\'une commande', desc: 'Passer en confirmé, expédié, livré…' },
      { key: 'orders.cancel', label: 'Annuler une commande',              desc: 'Annulation — action sensible' },
      { key: 'orders.export', label: 'Exporter les commandes (CSV)',      desc: 'Télécharger les données de commandes' },
    ],
  },
  {
    id: 'disputes',
    label: 'Litiges & SAV',
    permissions: [
      { key: 'disputes.view',    label: 'Voir les litiges',              desc: 'Lister et consulter les litiges ouverts' },
      { key: 'disputes.resolve', label: 'Résoudre / clore un litige',    desc: 'Changer le statut et ajouter une résolution' },
    ],
  },
  {
    id: 'finances',
    label: 'Finances plateforme',
    permissions: [
      { key: 'finances.view',   label: 'Voir les finances',             desc: 'GMV, CA vendeurs, indicateurs financiers' },
      { key: 'finances.export', label: 'Exporter les données financières', desc: 'Télécharger les rapports financiers' },
    ],
  },
  {
    id: 'delivery',
    label: 'Livreurs',
    permissions: [
      { key: 'delivery.view',     label: 'Voir les demandes de livraison', desc: 'Consulter les tickets de livraison' },
      { key: 'delivery.validate', label: 'Valider les profils livreurs',    desc: 'Activer / rejeter des comptes livreurs' },
    ],
  },
  {
    id: 'categories',
    label: 'Catalogue & Référentiels',
    permissions: [
      { key: 'categories.view', label: 'Voir les catégories et référentiels', desc: 'Consulter catégories, marques, types' },
      { key: 'categories.edit', label: 'Créer / modifier les catégories',     desc: 'Gérer l\'arborescence du catalogue' },
    ],
  },
  {
    id: 'settings',
    label: 'Paramètres plateforme',
    permissions: [
      { key: 'settings.view', label: 'Voir les paramètres globaux', desc: 'Lire la configuration de la plateforme' },
      { key: 'settings.edit', label: 'Modifier les paramètres',     desc: 'Modifier les réglages — action critique' },
    ],
  },
  {
    id: 'audit',
    label: 'Journal d\'audit',
    permissions: [
      { key: 'audit.view', label: 'Lire le journal d\'audit', desc: 'Consulter l\'historique des actions plateforme' },
    ],
  },
  {
    id: 'team',
    label: 'Équipe d\'administration',
    permissions: [
      { key: 'team.view',   label: 'Voir l\'équipe admin',         desc: 'Consulter la liste des admins et leurs rôles' },
      { key: 'team.manage', label: 'Gérer l\'équipe (super-admin)', desc: 'Ajouter, modifier, révoquer des accès admin' },
    ],
  },
];

// ── All permission keys ───────────────────────────────────────────────────────
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

// ── Default permissions per role ──────────────────────────────────────────────
export const ROLE_DEFAULT_PERMS: Record<AdminRole, string[]> = {
  superadmin: ALL_PERMISSION_KEYS,

  moderator: [
    'dashboard.view',
    'orgs.view', 'orgs.edit', 'orgs.validate',
    'products.view', 'products.edit', 'products.moderate',
    'orders.view', 'orders.status',
    'disputes.view', 'disputes.resolve',
    'delivery.view', 'delivery.validate',
    'categories.view', 'categories.edit',
    'audit.view',
    'team.view',
  ],

  finance_admin: [
    'dashboard.view',
    'orders.view', 'orders.export',
    'finances.view', 'finances.export',
    'audit.view',
    'team.view',
  ],

  support: [
    'dashboard.view',
    'orgs.view',
    'orders.view', 'orders.status',
    'disputes.view', 'disputes.resolve',
    'delivery.view',
    'team.view',
  ],

  data_viewer: [
    'dashboard.view',
    'orgs.view',
    'products.view',
    'orders.view',
    'finances.view',
    'categories.view',
    'audit.view',
    'team.view',
  ],
};

// ── Effective permissions for a member ───────────────────────────────────────
// Combines role defaults with per-member overrides.
export function effectivePermissions(
  role: AdminRole,
  overrides: Record<string, boolean>,
): Set<string> {
  const base = new Set(ROLE_DEFAULT_PERMS[role] ?? []);
  for (const [key, granted] of Object.entries(overrides)) {
    if (granted) base.add(key);
    else         base.delete(key);
  }
  return base;
}

// ── Compute the override delta to save ───────────────────────────────────────
// Returns only the keys that differ from the role default.
// We don't store "role grants it AND user wants it" → that's noise.
export function computeOverrides(
  role: AdminRole,
  desiredEffective: Record<string, boolean>,
): Record<string, boolean> {
  const defaults = new Set(ROLE_DEFAULT_PERMS[role] ?? []);
  const result: Record<string, boolean> = {};
  for (const [key, granted] of Object.entries(desiredEffective)) {
    const inDefault = defaults.has(key);
    if (granted !== inDefault) result[key] = granted;
  }
  return result;
}
