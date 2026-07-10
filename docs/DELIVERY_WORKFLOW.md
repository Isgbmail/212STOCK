# Stock212 — Delivery Workflow

> **Version** : migration `027_delivery_routing`
> **Stack** : React 18 + TypeScript · Supabase (PostgreSQL + RLS) · Chakra UI (storefront) · Cloudscape (vendor/admin)
> **Principe fondamental** : tout acteur de livraison (transporteur 3PL, livreur indépendant, chauffeur de flotte interne) doit être **validé par l'admin Stock212** avant d'avoir accès à la moindre fonctionnalité opérationnelle.

---

## Table des matières

1. [Acteurs](#1-acteurs)
2. [Modèle de données](#2-modèle-de-données)
3. [Méthodes de livraison](#3-méthodes-de-livraison)
4. [Onboarding des acteurs de livraison](#4-onboarding-des-acteurs-de-livraison)
5. [Interface d'administration — Validation des dossiers](#5-interface-dadministration--validation-des-dossiers)
6. [Mécanismes de blocage (gating)](#6-mécanismes-de-blocage-gating)
7. [Flux opérationnel complet pas à pas](#7-flux-opérationnel-complet-pas-à-pas)
8. [États et transitions](#8-états-et-transitions)
9. [Routing automatique](#9-routing-automatique)
10. [Interface livreur (post-validation)](#10-interface-livreur-post-validation)
11. [Frais de mission](#11-frais-de-mission)
12. [Documents PDF](#12-documents-pdf)
13. [Retours et SAV](#13-retours-et-sav)
14. [Résumé des tables SQL](#14-résumé-des-tables-sql)

---

## 1. Acteurs

| Acteur | Rôle dans la livraison | Onboarding requis | Interface |
|--------|------------------------|-------------------|-----------|
| **Acheteur** (`buyer`) | Choisit la méthode de livraison au checkout, suit le colis, déclenche les retours | Non | Chakra UI storefront |
| **Vendeur** (`seller`) | Confirme la commande (déclenche le routing), peut activer sa flotte propre | Oui (compte standard) | Cloudscape vendor |
| **Transporteur partenaire 3PL** (`delivery — logistics_company`) | Entreprise logistique certifiée, reçoit des tickets pré-assignés | **Oui — validation admin obligatoire** | Cloudscape delivery |
| **Livreur indépendant Stock212** (`delivery — independent`) | Freelance, accepte librement les tickets ouverts du pool | **Oui — validation admin obligatoire** | Cloudscape delivery |
| **Chauffeur flotte interne vendeur** | Employé ou sous-traitant du vendeur, géré dans VendorDeliveries | **Oui — si inscrit sur la plateforme** | Cloudscape delivery (restreint) |
| **Admin Stock212** | Valide/refuse/suspend les profils livreurs, supervise les tickets | — | Cloudscape admin |

---

## 2. Modèle de données

### Table `orders` (colonnes livraison)

```
delivery_preference  text   — niveau de service : standard | express | cold_chain
delivery_method      text   — opérateur : partner_carrier | stock212 | seller_fleet | buyer_managed
carrier_org_id       uuid   — FK organisations (rempli seulement si delivery_method = partner_carrier)
delivery_address     jsonb  — { line1, city, postal_code, country }
billing_address      jsonb
```

### Table `delivery_tickets`

```
id                   uuid PK
ticket_number        text UNIQUE                   — ex : TKT-LB5K2M-ORD-1749385...
requester_org_id     uuid → organisations          — org vendeur qui crée le ticket
order_id             uuid → orders
assigned_delivery_id uuid → organisations (null)   — livreur assigné (null = pool ouvert)
pickup_address       jsonb                         — adresse d'enlèvement (entrepôt vendeur)
delivery_address     jsonb                         — adresse de livraison finale
parcel_details       jsonb                         — { delivery_method, delivery_preference, routed_at, ... }
priority             text  normal | express
status               text  open | assigned | picked_up | in_transit | delivered | cancelled
assigned_at          timestamptz
picked_up_at         timestamptz
delivered_at         timestamptz
proof_url            text                          — note ou URL photo de preuve de livraison
insured              boolean
insured_value        numeric
```

### Tables profil livreur

```
delivery_profiles       — validation_status (pending | validated | rejected | suspended)
                          delivery_type (logistics_company | independent | internal_fleet)
                          avg_rating, review_count, base_rate
delivery_zones          — regions, postal_codes, lead_days_min/max, surcharge
delivery_capabilities   — max_weight_kg, cold_chain, ambient, frozen, fragile, last_mile
mission_expenses        — frais rattachés à un ticket (carburant, péage, repas…)
```

---

## 3. Méthodes de livraison

Le champ `orders.delivery_method` détermine **qui** prend en charge l'expédition.

### 3.1 `partner_carrier` — Transporteur partenaire

L'acheteur sélectionne un prestataire 3PL validé par Stock212 parmi la liste disponible au checkout.

- `carrier_org_id` = UUID du transporteur choisi
- À la confirmation → ticket créé avec `assigned_delivery_id = carrier_org_id` et `status = assigned`
- Le transporteur voit le ticket immédiatement dans son dashboard (onglet "Mes tickets")
- Aucune action manuelle du vendeur pour le dispatch

### 3.2 `stock212` — Réseau Stock212 *(option recommandée)*

Stock212 coordonne la livraison via son réseau de livreurs indépendants validés.

- `carrier_org_id` = null
- À la confirmation → ticket créé avec `assigned_delivery_id = null` et `status = open`
- Le ticket apparaît dans le pool "Tickets disponibles" de tous les livreurs indépendants validés
- Le premier livreur à accepter devient `assigned_delivery_id`, status passe à `assigned`

### 3.3 `seller_fleet` — Flotte propre du vendeur

Le vendeur assure lui-même la livraison avec ses propres véhicules.

- Affiché au checkout seulement si `seller_profiles.has_own_fleet = true` **ET** la flotte est active
- À la confirmation → ticket créé avec `assigned_delivery_id = seller_org_id` et `status = assigned`
- Le vendeur voit le ticket dans **VendorDeliveries** et assigne un chauffeur via la modal dispatch

### 3.4 `buyer_managed` — Acheteur organise sa livraison

L'acheteur envoie son propre transporteur ou vient récupérer la marchandise.

- `carrier_org_id` = null
- **Aucun ticket de livraison créé**
- Le vendeur voit la bannière "L'acheteur gère sa livraison — préparez la marchandise"
- La commande passe en `shipped` manuellement quand le vendeur confirme l'enlèvement

---

## 4. Onboarding des acteurs de livraison

> L'onboarding s'applique aux **transporteurs 3PL** et aux **livreurs indépendants Stock212**.
> Pour les chauffeurs de flotte vendeur : le vendeur les inscrit lui-même ; l'admin peut valider leurs profils si la plateforme l'exige.

### 4.1 Page d'entrée (pré-connexion)

Page publique "Devenir partenaire de livraison Stock212" :

- Deux parcours distincts :
  - **"S'inscrire en tant que société logistique"** (entreprise 3PL)
  - **"S'inscrire en tant que chauffeur livreur"** (réseau indépendant Stock212)
- Chaque parcours lance un wizard multi-étapes.

### 4.2 Wizard d'inscription — Étapes communes

```
Étape 1 — Création du compte
  ├─ Email, mot de passe
  ├─ Nom de l'entreprise (3PL) OU nom complet (chauffeur)
  └─ Numéro de téléphone

Étape 2 — Détails du profil
  ├─ 3PL :  n° registre commerce, n° fiscal, adresse siège, taille flotte,
  │          types de véhicules (porteur frigo, fourgon frigorifique, camion porteur…),
  │          zones de couverture (wilayas / villes), capacité chaîne du froid
  └─ Chauffeur : CIN/passeport, catégorie permis, type de véhicule (propre ou Stock212),
                 années d'expérience, zones préférées, planning disponibilité

Étape 3 — Upload de documents (drag & drop, aperçu inline)
  ├─ 3PL :  extrait registre commerce, carte fiscale, attestation assurance
  │          (marchandises transportées + RC), liste flotte avec immatriculations,
  │          licence transport alimentaire (si FMCG réfrigéré/congelé)
  └─ Chauffeur : permis de conduire valide, carte grise (si véhicule propre),
                 certificat médical / casier judiciaire, attestation formation
                 hygiène alimentaire (si requis FMCG)

Étape 4 — Acceptation CGU
  └─ Contrat partenaire Stock212 : niveaux de service, modalités de paiement,
     responsabilité en cas de litige, conditions de suspension

Étape 5 — Soumission
  └─ Écran de confirmation : "Votre dossier est en cours d'examen.
     Vous serez notifié dans les 2 jours ouvrables."
  → INSERT delivery_profiles (validation_status = 'pending')
```

### 4.3 Dashboard pré-validation (compte en attente)

Lorsqu'un acteur se connecte **avant validation**, il accède à un dashboard **restreint** :

```
┌──────────────────────────────────────────────────────────────┐
│  Statut de votre dossier                                     │
│                                                              │
│  ● Inscription         ✓ Complétée                          │
│  ● Vérification docs   ⏳ En cours                          │
│  ● Décision admin      ○ En attente                         │
│                                                              │
│  Badge : "Dossier en cours d'examen"  (amber)                │
│                                                              │
│  Documents soumis :                                          │
│  ├─ Registre commerce .............. Soumis                  │
│  ├─ Attestation assurance .......... Soumis                  │
│  └─ Licence transport alimentaire .. En attente de révision  │
│                                                              │
│  [+ Ajouter un document manquant]                            │
│  [Contacter le support]                                      │
└──────────────────────────────────────────────────────────────┘
```

- **Aucun accès** aux onglets Missions, Tickets disponibles, Historique, Frais.
- Si l'admin a demandé un document supplémentaire, une **notification in-app + email** précise quel document est attendu.
- Le bouton "+ Ajouter un document manquant" permet d'uploader directement depuis ce dashboard.

---

## 5. Interface d'administration — Validation des dossiers

**Accès** : rôle admin · **Écran** : "Validation des partenaires livraison" (menu Opérations).  
**Fichier** : [`src/pages/admin/AdminDeliveryValidation.tsx`](../src/pages/admin/AdminDeliveryValidation.tsx)

### 5.1 File d'attente (Approval Queue)

Deux onglets :
- **"Sociétés logistiques"** (3PL)
- **"Chauffeurs livreurs"** (indépendants)

Chaque ligne affiche :

| Colonne | Contenu |
|---|---|
| Nom / Entreprise | Raison sociale ou nom complet |
| Date de soumission | Date de dépôt du dossier |
| Type de véhicule | Fourgon frigorifique, porteur, etc. |
| Zones de couverture | Wilayas / villes déclarées |
| Documents | Nombre soumis / nombre requis |
| Statut | `pending_review` · `pending_info` · `validated` · `rejected` · `suspended` |

Cliquer sur une ligne ouvre le **panneau de révision**.

### 5.2 Panneau de révision (Review Detail)

```
┌─ Informations générales ──────────────────────────────────────┐
│  Raison sociale, n° RC, n° fiscal, adresse, taille flotte,   │
│  capacités (poids max, chaîne du froid, dernier kilomètre)    │
│  Carte des zones de couverture                                │
└───────────────────────────────────────────────────────────────┘

┌─ Documents ───────────────────────────────────────────────────┐
│  Chaque document s'ouvre en inline (PDF/image)                │
│  L'admin peut marquer : ✓ Vérifié  |  ⚠ Problème détecté    │
└───────────────────────────────────────────────────────────────┘

┌─ Actions ─────────────────────────────────────────────────────┐
│  [Demander un document]  → modal : message + sélection doc    │
│                            → notification email + in-app      │
│                            → validation_status = pending_info │
│                                                               │
│  [Approuver]             → validation_status = validated      │
│                            → accès opérationnel débloqué      │
│                                                               │
│  [Refuser]               → modal : motif obligatoire          │
│                            → validation_status = rejected     │
│                            → notification email + in-app      │
│                            → option : re-candidature possible │
└───────────────────────────────────────────────────────────────┘

┌─ Journal d'audit ─────────────────────────────────────────────┐
│  Chaque décision enregistrée : qui · quand · motif            │
│  Visible dans le panneau de révision                          │
└───────────────────────────────────────────────────────────────┘
```

**Motifs de refus prédéfinis** (sélection + note libre) :
`Capacité véhicule insuffisante` · `Permis invalide ou expiré` · `Document manquant` · `Assurance insuffisante` · `Zone non couverte par Stock212` · `Autre`

### 5.3 Suspension d'un acteur validé

L'admin peut **suspendre** un livreur actif à tout moment (signalements, incidents, non-conformité) :

- `validation_status = suspended`
- L'acteur peut se connecter mais voit : *"Votre compte est temporairement suspendu. Contactez le support Stock212."*
- Aucun ticket ne peut être assigné ni accepté
- L'admin peut **réactiver** en repassant à `validated`

### 5.4 Dashboard post-validation (acteur approuvé)

Une fois validé, le badge passe au vert et l'interface opérationnelle complète se débloque :

```
Badge : "Partenaire certifié Stock212"  (green)

Documents approuvés :
├─ Registre commerce .............. ✓ Approuvé
├─ Attestation assurance .......... ✓ Approuvé
└─ Licence transport alimentaire .. ✓ Approuvé
```

Les onglets opérationnels deviennent accessibles (voir [Section 10](#10-interface-livreur-post-validation)).

---

## 6. Mécanismes de blocage (gating)

Les règles suivantes s'appliquent à **tous les niveaux** de la plateforme :

| Règle | Mécanisme |
|---|---|
| Seuls les acteurs `validated` apparaissent dans la liste "Transporteurs partenaires" au checkout | `fetchPartnerCarriers()` filtre `validation_status = 'validated'` |
| Seuls les acteurs `validated` voient le pool de tickets `open` (Stock212) | RLS + requête DeliveryOverview filtre `validation_status = 'validated'` |
| Un acteur `pending` / `rejected` / `suspended` ne peut accepter aucun ticket | Contrainte DB + interface restreinte |
| Un ticket `open` ne peut être accepté que par un acteur `validated` | Condition dans `acceptTicket()` : vérifie validation_status avant UPDATE |
| L'option "Flotte vendeur" n'est visible au checkout que si `has_own_fleet = true` ET flotte active | `fetchSellerFleetAvailability()` |
| La suspension est réversible ; le rejet peut autoriser une re-candidature | Décision admin dans le panneau de révision |

### Résumé du parcours acteur par statut

| Statut | Connexion | Dashboard | Tickets disponibles | Mes tickets | Suspension |
|---|---|---|---|---|---|
| `pending` | ✓ | Restreint (statut dossier) | ✗ | ✗ | — |
| `pending_info` | ✓ | Restreint + upload doc | ✗ | ✗ | — |
| `validated` | ✓ | Complet | ✓ (Stock212) | ✓ | Admin uniquement |
| `rejected` | ✓ | Message refus + motif | ✗ | ✗ | — |
| `suspended` | ✓ | Message suspension | ✗ | ✗ | Réversible |

---

## 7. Flux opérationnel complet pas à pas

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CHECKOUT (acheteur)                                                     │
│                                                                          │
│  1. Saisie adresse de livraison                                          │
│  2. Choix conditions de paiement (prepayment / net15 / net30 / net60)    │
│  3. Choix niveau de service (standard / express / cold_chain)            │
│  4. Choix opérateur de livraison :                                       │
│     ├─ Flotte vendeur    (si has_own_fleet = true)                       │
│     ├─ Transporteur partenaire + sélection du carrier dans la liste      │
│     │   (seuls les livreurs validated apparaissent)                      │
│     ├─ Livraison Stock212  [RECOMMANDÉ]                                  │
│     └─ J'organise ma livraison                                           │
│  5. Notes optionnelles                                                   │
│  6. "Confirmer la commande"                                              │
│     → INSERT orders (status = pending, delivery_method, carrier_org_id) │
│     → INSERT order_lines                                                 │
│     → UPDATE carts (status = converted)                                  │
└──────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ Notification temps réel (Supabase Realtime)
┌──────────────────────────────────────────────────────────────────────────┐
│  VENDEUR — VendorOrders                                                  │
│                                                                          │
│  7. Reçoit la commande dans l'onglet "En attente"                        │
│     Badge temps réel (supabase.channel postgres_changes INSERT orders)   │
│  8. Ouvre le détail → voit le delivery_method + niveau de service        │
│  9. Clique "Confirmer la commande" (pending → confirmed)                 │
│     → UPDATE orders.status = confirmed                                   │
│     → routeDelivery() appelé automatiquement selon delivery_method :     │
│        ┌─ partner_carrier → INSERT delivery_tickets (assigned, carrier)  │
│        ├─ stock212        → INSERT delivery_tickets (open, null)         │
│        ├─ seller_fleet    → INSERT delivery_tickets (assigned, seller)   │
│        └─ buyer_managed   → rien (pas de ticket)                        │
│     → Flash "Ticket de livraison créé (Livraison Stock212)"              │
│                                                                          │
│  10. Pour seller_fleet : bouton "Assigner un chauffeur"                  │
│      → Modal dispatch → sélection driver/3PL → INSERT delivery_tickets  │
│      → UPDATE orders.status = in_preparation                             │
└──────────────────────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────────────┐
           ▼              ▼                       ▼
     (stock212)   (partner_carrier)        (seller_fleet)
     Pool ouvert   Ticket pré-assigné    Vendeur assigne chauffeur
           │              │                       │
           └──────────────┴───────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LIVREUR VALIDÉ — DeliveryOverview                                       │
│                                                                          │
│  stock212 :                                                              │
│    11. Voit le ticket dans "Tickets disponibles" (status = open)         │
│    12. Clique "Accepter la mission"                                      │
│        → UPDATE delivery_tickets (assigned_delivery_id = livr_org_id,   │
│          status = assigned, assigned_at = now())                         │
│                                                                          │
│  partner_carrier + seller_fleet :                                        │
│    11. Voit le ticket dans "Mes tickets" (status = assigned)             │
│                                                                          │
│  Progression du ticket (tous les cas) :                                  │
│    13. "Marquer enlevé"  → status = picked_up, picked_up_at = now()     │
│                             orders.status = shipped                      │
│    14. "En transit"      → status = in_transit                           │
│    15. "Marquer livré"   → modal preuve de livraison                     │
│        → status = delivered, delivered_at = now(), proof_url             │
│        → orders.status = delivered                                       │
└──────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ACHETEUR — BuyerOrderDetail                                             │
│                                                                          │
│  16. Suit l'avancement en temps réel :                                   │
│      En attente → Confirmée → En préparation → Expédiée → Livrée        │
│  17. Voir le ticket associé (ticket_number, statut, adresses)            │
│  18. Télécharger bon de commande PDF                                     │
│  19. Déclencher une demande de retour (si statut delivered)              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. États et transitions

### Commande (`orders.status`)

```
pending
  └─[vendeur confirme]─→ confirmed
       └─[vendeur prépare / dispatch flotte]─→ in_preparation
            └─[livreur enlève le colis]─→ shipped
                 └─[livreur livre + confirme]─→ delivered

pending    ─→ cancelled  (vendeur ou acheteur)
*          ─→ dispute    (acheteur ouvre un litige)
```

### Ticket de livraison (`delivery_tickets.status`)

```
open
 └─[livreur validé accepte]─→ assigned
      └─[enlèvement effectué]─→ picked_up      (→ orders.status = shipped)
           └─[en route]─→ in_transit
                └─[livraison confirmée + preuve]─→ delivered  (→ orders.status = delivered)

tout état ─→ cancelled
```

### Profil livreur (`delivery_profiles.validation_status`)

```
pending
  └─[admin demande doc]─→ pending_info
       └─[acteur uploade]─→ pending
  └─[admin approuve]─→ validated
       └─[incident / non-conformité]─→ suspended
            └─[admin réactive]─→ validated
  └─[admin refuse]─→ rejected
       └─[re-candidature]─→ pending
```

### Mapping statut ticket → statut commande

| Événement ticket | Mise à jour commande |
|---|---|
| `picked_up` | `orders.status = shipped` |
| `delivered` | `orders.status = delivered` |

---

## 9. Routing automatique

**Fichier** : [`src/hooks/useDeliveryRouter.ts`](../src/hooks/useDeliveryRouter.ts)

La fonction `routeDelivery()` est appelée dans `VendorOrders.tsx` lors du `handleStatusUpdate` dès que `newStatus === 'confirmed'`.

```typescript
// Appelé automatiquement côté vendeur à la confirmation
await routeDelivery(
  {
    id, order_number, seller_org_id,
    delivery_method,   // 'partner_carrier' | 'stock212' | 'seller_fleet' | 'buyer_managed'
    carrier_org_id,    // UUID si partner_carrier, sinon null
    delivery_address,
    delivery_preference,
  },
  user.id
);
```

**Résultat par méthode** :

| `delivery_method` | `assigned_delivery_id` | `status` ticket |
|---|---|---|
| `partner_carrier` | `carrier_org_id` | `assigned` |
| `stock212` | `null` | `open` |
| `seller_fleet` | `seller_org_id` | `assigned` |
| `buyer_managed` | — | *pas de ticket* |

**Sélection des options au checkout** :

```typescript
// fetchPartnerCarriers()
//   → delivery_profiles WHERE validation_status = 'validated'
//   → joints delivery_capabilities (cold_chain) et organisations (name)

// fetchSellerFleetAvailability(sellerOrgIds)
//   → seller_profiles WHERE has_own_fleet = true
//   (affiché seulement si TOUS les vendeurs du panier ont has_own_fleet = true)
```

---

## 10. Interface livreur (post-validation)

**Fichier** : [`src/pages/delivery/DeliveryOverview.tsx`](../src/pages/delivery/DeliveryOverview.tsx)

> Accessible uniquement après `validation_status = 'validated'`.

### KPIs en tête de dashboard

- Note moyenne (`delivery_profiles.avg_rating`)
- Statut de validation — badge vert "Partenaire certifié Stock212"

### Onglet — Mes tickets (actifs)

Tickets avec `assigned_delivery_id = activeOrg.id` ET `status NOT IN (delivered, cancelled)`.

| Statut actuel | Bouton | Résultat |
|---|---|---|
| `assigned` | Marquer enlevé | `picked_up` → `orders.shipped` |
| `picked_up` | En transit | `in_transit` |
| `in_transit` | Marquer livré | modal preuve → `delivered` → `orders.delivered` |

PDF disponibles depuis chaque ticket : Ordre de livraison · Bon de livraison · Ordre de mission.

### Onglet — Tickets disponibles (pool Stock212)

- Tickets `status = open` ET `assigned_delivery_id IS NULL`
- Triés par priorité (`express` en tête) puis date de création
- "Accepter la mission" → `assigned_delivery_id = activeOrg.id`, `status = assigned`
- **Visible uniquement par les livreurs `validated`** (requête + RLS)

### Onglet — Complétés

- Tickets `status = delivered` assignés à ce livreur, 20 derniers
- PDF disponibles : Ordre de livraison · Bon de livraison · Ordre de mission · Note de frais

---

## 11. Frais de mission

**Table** : `mission_expenses` (migration `017_mission_expenses`)

Chaque ticket actif peut avoir des lignes de frais saisies par le livreur :

| Champ | Type | Valeurs |
|---|---|---|
| `expense_type` | text | `fuel` · `toll` · `parking` · `meal` · `lodging` · `other` |
| `amount_ht` | numeric | Montant HT |
| `tva_rate` | numeric | Taux TVA (défaut 20%) |
| `expense_date` | date | Date du frais |
| `receipt_ref` | text | N° reçu / justificatif |

Le livreur saisit ses frais dans la modal "Note de frais" et génère un PDF `generateNoteFraisPDF(ticketId)`.

---

## 12. Documents PDF

Tous les documents sont générés côté client avec `@react-pdf/renderer`.

| Document | Fonction | Déclenché par |
|---|---|---|
| **Bon de commande** | `generateBonCommandePDF(orderId)` | Vendeur (VendorOrders) · Acheteur (BuyerOrderDetail) |
| **Bon de livraison vendeur** | `generateBonLivraisonFromOrderPDF(orderId)` | Vendeur (si status ≥ in_preparation) |
| **Ordre de livraison** | `generateOrdreLivraisonPDF(ticketId)` | Livreur (DeliveryOverview) |
| **Bon de livraison livreur** | `generateBonLivraisonPDF(ticketId)` | Livreur (DeliveryOverview) |
| **Ordre de mission** | `generateOrdreMissionPDF(ticketId)` | Livreur (DeliveryOverview) |
| **Note de frais** | `generateNoteFraisPDF(ticketId)` | Livreur (modal frais de mission) |
| **Bon de retour (BRM)** | `generateBonRetourPDF(returnId)` | Vendeur (VendorOrders — onglet retours) |
| **PV de réception retour** | `generatePVReceptionPDF(returnId)` | Vendeur (si retour in_transit / received / completed) |
| **Facture** | `generateInvoicePDF(invoiceId)` | Vendeur (VendorFinances) |
| **Avoir** | `generateAvoirPDF(invoiceId)` | Vendeur (VendorFinances) |
| **Relevé de compte** | `generateReleveComptePDF(sellerOrgId, buyerOrgId)` | Vendeur (VendorFinances) |

---

## 13. Retours et SAV

**Table** : `order_returns` + `return_lines` (migration `016_order_returns`)

### Déclenchement

L'acheteur ouvre une demande depuis **BuyerOrderDetail** uniquement si la commande est `delivered`.  
Il sélectionne les lignes à retourner, les quantités, le motif et le type de traitement souhaité.

### Motifs (`reason`)

`damaged` · `wrong_product` · `quality_issue` · `expired` · `excess` · `other`

### Traitements (`refund_type`)

`avoir` · `exchange` · `refund`

### Cycle de vie

```
requested
  └─[vendeur approuve]─→ approved
       └─[acheteur expédie]─→ in_transit
            └─[vendeur réceptionne]─→ received
                 └─[traitement finalisé]─→ completed
  └─[vendeur refuse]─→ rejected
```

### Interface vendeur

- Onglet "Demandes de retour" dans la modal détail commande (VendorOrders)
- Documents disponibles : Bon de retour BRM · PV de réception (si `in_transit` / `received` / `completed`)

---

## 14. Résumé des tables SQL

| Table | Migration | Rôle |
|---|---|---|
| `orders` | `004_commerce` + `027_delivery_routing` | Commande principale avec delivery_method et carrier_org_id |
| `order_lines` | `004_commerce` | Lignes de commande |
| `delivery_tickets` | `005_finance_quotes_delivery` | Ticket de livraison par commande |
| `ticket_messages` | `005_finance_quotes_delivery` | Messagerie livreur ↔ vendeur |
| `delivery_profiles` | `002_profiles_extensions` | Profil, type, validation_status, note moyenne |
| `delivery_zones` | `002_profiles_extensions` | Zones géographiques couvertes |
| `delivery_capabilities` | `002_profiles_extensions` | Capacités (poids, froid, fragilité, etc.) |
| `mission_expenses` | `017_mission_expenses` | Frais de mission par ticket |
| `order_returns` | `016_order_returns` | Demandes de retour acheteur |
| `return_lines` | `016_order_returns` | Lignes de retour |
| `seller_profiles` | `002_profiles_extensions` | Inclut `has_own_fleet` pour flotte vendeur |

---

*Document maintenu manuellement — mettre à jour lors de toute évolution du routing, des statuts ou de la politique d'onboarding.*
