# Stock212 — Guide de configuration Supabase

Ce guide explique comment créer et configurer la base de données Supabase pour le projet Stock212, de zéro.

---

## 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New project**
2. Choisir une organisation, un nom de projet (`stock212`), un mot de passe de base de données fort, et une région proche (ex: `eu-west-3` Paris)
3. Attendre ~2 minutes que le projet soit prêt

---

## 2. Récupérer les clés API

Dans le dashboard Supabase : **Project Settings → API**

| Variable | Où la trouver |
|---|---|
| `VITE_SUPABASE_URL` | "Project URL" (ex: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | "anon public" sous "Project API keys" |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" (garder secret — ne jamais exposer côté client) |

Copier ces valeurs dans le fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://VOTRE_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Mettre false en production
VITE_DEV_BYPASS_AUTH=false
```

---

## 3. Exécuter le schéma SQL

Aller dans **SQL Editor** du dashboard Supabase (menu de gauche).

### Étape 1 — Schéma complet (migrations 001 à 021)

Ouvrir le fichier [`supabase/stock212_full_schema.sql`](supabase/stock212_full_schema.sql), copier tout le contenu, le coller dans SQL Editor, cliquer **Run**.

Ce fichier crée d'un coup toutes les tables fondamentales :

| Migrations incluses | Tables créées |
|---|---|
| 001 — Identity & Organisations | `profiles`, `business_categories`, `organisations`, `organisation_members` |
| 002 — Role-Specific Profiles | `buyer_profiles`, `seller_profiles`, `delivery_profiles`, `delivery_zones` |
| 003 — Product Catalogue | `categories`, `brands`, `suppliers`, `products`, `product_variants`, `price_tiers`, `product_lots` |
| 004 — Commerce | `promotions`, `promo_codes`, `carts`, `cart_items`, `orders`, `order_lines` |
| 005 — Finance & Quotes | `invoices`, `payments`, `credit_notes`, `quotes`, `quote_lines`, `delivery_tickets` |
| 006 — Post-Sale & Config | `disputes`, `order_returns`, `reviews`, `platform_settings`, `notifications` |
| 007 — Security Hardening | Correctifs RLS, politiques de sécurité renforcées |
| 008 — Fix org_members recursion | Correction politique SELECT organisation_members |
| 009 — Fix org SELECT policy | Correction politique SELECT organisations |
| 010 — Categories image_url | Colonne `image_url` sur categories, accès anonyme produits |
| 011 — Brands & price_tiers anon | Accès anonyme brands et price_tiers |
| 012 — Admin flag | Colonne `is_admin` sur profiles |
| 013 — Product images storage | Bucket de stockage `product-images` |
| 014 — Product enhancements | Nutri-Score, valeurs nutritionnelles, DLC, fiches téléchargeables |
| 015 — Cart RLS fix | Correction politiques panier + UNIQUE constraint cart_items |
| 016 — Order returns | `order_returns`, `return_lines` — gestion des retours |
| 017 — Mission expenses | `mission_expenses` — frais de mission livreurs |
| 018 — Cart templates | Support templates de panier nommés |
| 019 — Product fiche fields | Champs FMCG complets : physique, logistique, sécurité, marché |
| 020 — Admin team | `admin_team` — rôles superadmin / modérateur / finance / support |
| 021 — Admin permissions | Colonne `permissions` JSONB pour surcharges par membre |

> **Important :** Si l'éditeur affiche une erreur "already exists", ce n'est pas bloquant — toutes les instructions utilisent `IF NOT EXISTS`. Vérifier que la dernière ligne indique `Success`.

---

### Étape 2 — Module Marketing (migration 022)

Ouvrir le fichier [`supabase/migrations/20260608000002_022_marketing_module.sql`](supabase/migrations/20260608000002_022_marketing_module.sql), copier, coller dans SQL Editor, **Run**.

Tables créées par cette migration :

| Table | Rôle |
|---|---|
| `seller_credit_transactions` | Historique des mouvements de crédits marketing vendeur |
| `campaigns` | Toutes les campagnes marketing (12 types) |
| `liquidation_lots` | Lots de déstockage / enchères |
| `liquidation_bids` | Enchères sur les lots |
| `sampling_requests` | Demandes d'échantillons acheteurs → vendeurs |
| `ad_inventory` | Inventaire des emplacements publicitaires (slots journaliers) |
| `ad_reservations` | Réservations d'emplacements par campagne |
| `buyer_subscriptions` | Tiers acheteurs avec compteurs d'utilisation mensuelle |
| `loyalty_transactions` | Points de fidélité acheteurs |
| `trade_requests` | Demandes de deals / réductions entre acheteurs et vendeurs |
| `admin_marketing_config` | Configuration du module marketing par les admins |
| `admin_notifications` | File de notifications internes pour l'équipe admin |

---

### Étape 3 — Paramètres plateforme v1 (migration 023)

Ouvrir le fichier [`supabase/migrations/20260608000003_023_platform_settings_extended.sql`](supabase/migrations/20260608000003_023_platform_settings_extended.sql), copier, coller, **Run**.

Ajoute ~35 colonnes à `platform_settings` pour la page AdminSettings :
commissions, règles vendeurs, règles acheteurs, livraison, sécurité, notifications.

---

### Étape 4 — Paramètres plateforme v2 (migration 024)

Ouvrir le fichier [`supabase/migrations/20260608000004_024_platform_settings_v2.sql`](supabase/migrations/20260608000004_024_platform_settings_v2.sql), copier, coller, **Run**.

Ajoute les colonnes manquantes post-refonte AdminSettings (modèle 3 niveaux) :
`available_languages`, `cart_ttl_days`, `intraeu_vat_enabled`, `vendor_invoice_day`,
`stripe_mode`, `invoice_prefix`, `invoice_footer`, `bank_iban`, `bank_bic`, `default_currency`.

---

## 4. Créer le bucket de stockage

La migration 013 crée les **politiques RLS** du bucket, mais le bucket lui-même doit être créé manuellement :

1. Dans le dashboard Supabase : **Storage → New bucket**
2. Nom : `product-images`
3. Cocher **Public bucket** → Create

---

## 5. Initialiser la ligne platform_settings

La table `platform_settings` doit contenir exactement **une ligne** (lue par AdminSettings). L'exécuter une seule fois :

```sql
INSERT INTO platform_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
```

Coller dans SQL Editor → Run.

---

## 6. Créer le premier compte administrateur

1. Dans le dashboard Supabase : **Authentication → Users → Add user**
   - Email : `admin@stock212.com`
   - Mot de passe : (choisir un mot de passe fort)
   - Cocher "Auto Confirm User"
2. Copier l'`id` UUID du compte créé
3. Promouvoir en admin (coller l'UUID) :

```sql
-- Remplacer <UUID_ADMIN> par l'id du compte
UPDATE profiles SET is_admin = true WHERE id = '<UUID_ADMIN>';

INSERT INTO admin_team (user_id, role, full_name, email)
VALUES ('<UUID_ADMIN>', 'superadmin', 'Admin Stock212', 'admin@stock212.com');
```

---

## 7. (Optionnel) Charger des données de test

Le fichier [`supabase/seed_test_data.sql`](supabase/seed_test_data.sql) crée des comptes de test (mot de passe commun : `Test1234!`) et des données d'exemple.

> **Ce fichier se déroule en 2 parties** — lire les instructions en commentaire en haut du fichier avant de l'exécuter.

Comptes créés par le seed :

| Rôle | Email |
|---|---|
| Vendeur | `vendeur@test.com` |
| Acheteur | `acheteur@test.com` |
| Livreur | `livreur@test.com` |

---

## Récapitulatif des fichiers à exécuter

| Ordre | Fichier | Contenu | Obligatoire |
|---|---|---|---|
| 1 | `supabase/stock212_full_schema.sql` | Schéma complet — migrations 001→021 | Oui |
| 2 | `supabase/migrations/20260608000002_022_marketing_module.sql` | Module marketing complet | Oui |
| 3 | `supabase/migrations/20260608000003_023_platform_settings_extended.sql` | Paramètres admin v1 | Oui |
| 4 | `supabase/migrations/20260608000004_024_platform_settings_v2.sql` | Paramètres admin v2 | Oui |
| 5 | `supabase/seed_test_data.sql` | Données de test | Non (dev uniquement) |

> Les fichiers dans `supabase/migrations/` numérotés 001 à 021 sont **déjà inclus** dans `stock212_full_schema.sql`. Ne pas les exécuter séparément, sauf pour relire leur contenu à des fins de documentation.

---

## Variables d'environnement — Récapitulatif

```env
# ─── Supabase ─────────────────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://VOTRE_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...anon...

# Clé service_role — serveur uniquement, NE PAS mettre dans le code client
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...

# ─── Dev ──────────────────────────────────────────────────────────────────────
# true = widget de changement de rôle sans authentification réelle (développement)
# false = authentification Supabase réelle (production)
VITE_DEV_BYPASS_AUTH=false
```

---

## Architecture des 3 niveaux — rappel

```
Stock212 (Admin/Plateforme)
  └── Vendeurs  ← clients payants de Stock212 (abonnements, commissions)
        └── Acheteurs  ← clients des vendeurs (achètent des produits)
```

- Les tables `admin_team` / `platform_settings` concernent Stock212 en tant qu'opérateur
- Les tables `organisations` + `seller_profiles` concernent les **vendeurs** (clients de Stock212)
- Les tables `buyer_profiles` + `orders` concernent les **acheteurs** (clients des vendeurs)
- Les politiques RLS séparent strictement ces trois niveaux
