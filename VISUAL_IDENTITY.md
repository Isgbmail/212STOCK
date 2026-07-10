# Stock212 — Rapport d'Identité Visuelle

---

## 1. Positionnement de Marque

**Nom de la plateforme :** Stock212  
**Nature :** Marketplace B2B FMCG (Food, Hygiène, Entretien)  
**Marché cible :** Distributeurs, grossistes, CHR, grande distribution — Maroc  
**Langue principale :** Français (interface multilingue)  
**Ton :** Professionnel, sobre, orienté business — pas de fantaisie décorative

L'identité visuelle repose sur un contraste fort entre un **bleu marine profond** (sérieux, corporate) et un **ambre chaud** (dynamisme, appel à l'action). Ce duo crée une plateforme à la fois fiable et accessible.

---

## 2. Palette de Couleurs

### Couleurs principales

| Rôle | Nom | Valeur HEX | Usage |
|------|-----|------------|-------|
| **Primaire** | Navy | `#0d1f38` | En-têtes, dégradés navbar, texte principal |
| **Primaire clair** | Navy Mid | `#1a3558` | Dégradés secondaires, hover |
| **Accent** | Amber | `#c97d1a` | Boutons CTA, liens actifs, highlights |
| **Accent clair** | Amber Light | `#fef3c7` | Fonds de badges, zones d'alerte douce |
| **Accent bord** | Amber Border | `#fbbf24` | Bordures hover, soulignements actifs |

### Système de bleu (Chakra UI étendu)

| Token | HEX | Usage |
|-------|-----|-------|
| blue.50 | `#eef4ff` | Fonds de tableaux alternatifs |
| blue.100 | `#dce8ff` | Badge "confirmée", fonds légers |
| blue.200 | `#b9d0ff` | Icônes légères, états désactivés |
| blue.500 | `#2c5dee` | Boutons primaires bleus, liens, focus |
| blue.600 | `#1d4bca` | Hover sur boutons bleus |
| blue.700 | `#143899` | Onglet actif, texte sur fond clair |
| blue.900 | `#0a1a52` | Texte de très haute importance |

### Couleurs fonctionnelles (statuts)

| Statut | Texte | Fond |
|--------|-------|------|
| En attente | `#92400e` | `#fef3c7` |
| Confirmée | `#1e40af` | `#dbeafe` |
| En préparation | `#4a1d96` | `#ede9fe` |
| Expédiée | `#7c2d12` | `#ffedd5` |
| Livrée | `#14532d` | `#dcfce7` |
| Annulée / Litige | `#7f1d1d` | `#fee2e2` |
| Expirée | `#6b7280` | `#f3f4f6` |

### Couleurs neutres

| Rôle | HEX |
|------|-----|
| Fond global | `#f8fafc` |
| Fond carte | `#ffffff` |
| Bordure | `#e2e8f0` |
| Texte secondaire | `#334155` |
| Texte tertiaire | `#64748b` |
| Scrollbar piste | `#f1f5f9` |
| Scrollbar curseur | `#cbd5e1` |

---

## 3. Typographie

### Police principale

**Inter** (Google Fonts)  
`https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap`  
Fallback : `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

| Grammage | Valeur | Usage |
|----------|--------|-------|
| Light | 300 | Corps de texte léger, captions |
| Regular | 400 | Corps de texte courant |
| Medium | 500 | Labels, onglets, navigation secondaire |
| Semi-Bold | 600 | Boutons, valeurs chiffrées, badges |
| Bold | 700 | Titres de sections, nav principale |
| Extra-Bold | 800 | Grands titres, titres de pages |
| Black | 900 | Slogans marketing, hero sections |

### Police secondaire (monospace)

**JetBrains Mono** / Fira Code / Courier New  
Usage : codes EAN, références commandes, identifiants techniques

### Tailles de référence

| Contexte | Taille |
|----------|--------|
| Corps par défaut | 14px |
| Labels petits | 12px |
| Micro-texte | 10–11px |
| Titres de section | 18–24px |
| Titres de page | 28–36px |

---

## 4. Logo & Identité Graphique

**Nom affiché :** Stock212

Le logo est un **carré arrondi** (`border-radius: 6px`) décliné en couleur selon le rôle utilisateur :

| Rôle | Couleur logo |
|------|-------------|
| Storefront / Acheteur | `#0d1f38` (Navy) |
| Vendeur | `#0972d3` (Bleu Cloudscape) |
| Livreur | `#037f0c` (Vert) |
| Admin | `#d13212` (Rouge) |

Ce système de codage couleur par rôle s'étend à toute l'interface — chaque espace utilisateur a son identité chromatique propre.

---

## 5. Iconographie

### Bibliothèque principale

**Lucide React** (`v0.344.0`) — système d'icônes vectorielles lignes fines

**React Icons** (`v5.6.0`) — couverture complémentaire

### Icônes par domaine fonctionnel

| Domaine | Icônes |
|---------|--------|
| Navigation | ChevronDown, ChevronRight, Menu, Home |
| Commerce | ShoppingCart, ShoppingBag, Package, Truck |
| Documents | FileText, Download, Eye, Printer |
| Statuts | CheckCircle, AlertCircle, AlertTriangle, XCircle |
| Interface | Star, Heart, Bell, Settings, Lock |
| Social | Facebook, Twitter, Linkedin, Instagram |

### Icônes de catégories produits

Chaque catégorie possède une icône + fond coloré dédié :

| Catégorie | Icône | Fond | Couleur icône |
|-----------|-------|------|---------------|
| Boissons | Droplets | `#EBF8FF` | `#2B6CB0` |
| Épicerie sèche | Layers | `#FFFFF0` | `#744210` |
| Produits laitiers | ShoppingBag | `#FFF5F7` | `#97266D` |
| Boucherie & Charcuterie | Utensils | `#FFF5F5` | `#C53030` |
| Fruits & Légumes | Leaf | `#F0FFF4` | `#276749` |
| Surgelés | Snowflake | `#EBF8FF` | `#2C5282` |
| Conserves | Archive | `#FFFAF0` | `#744210` |
| Hygiène | Sparkles | `#FAF5FF` | `#553C9A` |
| Entretien | Wrench | `#F0FFF4` | `#22543D` |
| Emballages | Box | `#EDF2F7` | `#2D3748` |

---

## 6. Composants UI

### Cartes (Cards)

```
Background  : #ffffff
Border      : 1px solid #f1f5f9
Border-radius : 16px
Shadow      : 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
Shadow hover : 0 12px 32px rgba(37,99,235,0.12), 0 4px 8px rgba(0,0,0,0.04)
Transform hover : translateY(-4px)
Border hover : #bfdbfe
Transition  : 0.25s ease
```

### Boutons

```
Font-weight   : 600
Border-radius : 6px
Letter-spacing : 0.01em

Primaire Amber  : bg #c97d1a — border #b56b10 — text #fff
Primaire Bleu   : colorScheme="blue" (blue.500)
Ghost           : transparent bg — hover fond léger
Désactivé       : opacity 0.5
```

### Badges & Étiquettes

```
Border-radius        : 4px (standard) / 9999px (pill)
Font-weight          : 600
Letter-spacing       : 0.02em
Padding              : 2px 8px
```

### Champs de saisie

```
Border-radius : 4px
Border focus  : blue.500
Shadow focus  : 0 0 0 1px var(--chakra-colors-blue-500)
```

### Barre de recherche

```
Border-radius : 9999px (pleinement arrondie)
Fond         : gray.50 (repos) → white (focus)
Border focus : blue.400
Hauteur      : 36px (sm) / 44px (md) / 52px (lg)
```

### Modales

```
Border-radius : 8px
Overlay       : rgba(0,0,0,0.5)
Animation     : scale-in (0.4s cubic-bezier 0.34,1.56,0.64,1)
```

### Scrollbar personnalisée

```
Largeur  : 5px
Piste    : #f1f5f9
Curseur  : #cbd5e1  →  hover #94a3b8
Radius   : 4px
```

---

## 7. Layouts & Architecture Visuelle

### Navbar Storefront (3 niveaux)

```
Fond : linear-gradient(135deg, #0d1f38 0%, #1a3558 100%)

Niveau 1 — Logo + Barre de recherche + Actions (panier, compte)
Niveau 2 — Navigation catégories (soulignement amber sur actif)
Niveau 3 — Liens secondaires (Devis, Commandes, Contact)
```

Responsive : drawer/offcanvas mobile pour les menus

### Mega Menu

```
Ombre          : 2xl
Border-radius  : 2xl (16px)
Largeur min    : 680px
Structure      : panneau gauche 160px (onglets catégories)
                 panneau droit (grille 3 colonnes sous-catégories)
Bandeau image  : hauteur 90px avec gradient overlay navy
```

### Dashboards Vendeur / Admin / Livreur

Basé sur **AWS Cloudscape Design** :
- AppLayout avec SideNavigation latérale
- Breadcrumbs en haut de page
- Flashbar pour les notifications système
- Tables Cloudscape avec tri, filtres, pagination

### Espace Acheteur

Basé sur **Chakra UI** :
- KPI cards en grille (4 à 7 colonnes selon écran)
- Listes commandes/devis avec badges de statut
- Overlays modaux pour formulaires et actions

---

## 8. Animations & Transitions

### Animations CSS définies

| Nom | Description | Durée | Easing |
|-----|-------------|-------|--------|
| `fade-up` | Opacité 0→1 + translateY(28px→0) | 0.55s | cubic-bezier(0,0,0.2,1) |
| `fade-in` | Opacité 0→1 | 0.4s | ease |
| `scale-in` | Opacité 0→1 + scale(0.95→1) | 0.4s | cubic-bezier(0.34,1.56,0.64,1) |

### Transitions globales

| Élément | Durée |
|---------|-------|
| Cartes (hover) | 0.25s ease |
| Boutons | 0.15s ease |
| Navigation | 0.2s ease |
| Focus champs | immédiat |

**Bibliothèque motion :** Framer Motion (`v6.5.1`) pour les transitions de pages

---

## 9. Design System — Frameworks

| Framework | Version | Périmètre |
|-----------|---------|-----------|
| **Chakra UI** | 2.10.10 | Pages storefront, espace acheteur, pages marketing |
| **AWS Cloudscape** | 3.0.1307 | Dashboards vendeur, admin, livreur |
| **Tailwind CSS** | 3.4.1 | Classes utilitaires complémentaires |
| **Framer Motion** | 6.5.1 | Animations de transitions de pages |

---

## 10. Variables CSS — Tokens de marque

```css
:root {
  --s212-blue      : #0d1f38;   /* Navy primaire */
  --s212-blue-dark : #0a1628;   /* Navy profond */
  --s212-amber     : #c97d1a;   /* Amber CTA */
  --s212-amber-lt  : #fef3c7;   /* Amber fond */
}
```

---

## 11. Breakpoints Responsive

Basé sur Chakra UI (mobile-first) :

| Token | Taille |
|-------|--------|
| base | < 640px |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

Largeur max du conteneur : **1400px** avec padding latéral

---

## 12. Fichiers Sources de Référence

| Élément | Fichier |
|---------|---------|
| Variables CSS & animations | `src/index.css` |
| Thème Chakra UI étendu | `src/App.tsx` |
| Config Tailwind | `tailwind.config.js` |
| Icônes catégories | `src/lib/categoryIcons.ts` |
| Layout storefront | `src/layouts/StorefrontLayout.tsx` |
| Layout dashboards | `src/layouts/CloudscapeLayout.tsx` |
| Blocs marketing homepage | `src/components/marketing/HomepageBlocks.tsx` |

---

## Résumé

Stock212 adopte une identité **corporate B2B** construite sur deux piliers chromatiques — le **navy `#0d1f38`** pour l'autorité et la fiabilité, l'**amber `#c97d1a`** pour l'énergie et l'action. La typographie **Inter** renforce la lisibilité à toutes les tailles. Le système hybride Chakra UI (expérience acheteur fluide) + AWS Cloudscape (dashboards opérationnels robustes) reflète la double nature de la plateforme : une vitrine marchande d'un côté, un outil de gestion professionnel de l'autre.
