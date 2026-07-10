# Stock212 — Workflows Complets par Rôle

---

## Légende

```
[ Action ]        Étape réalisée par l'utilisateur
{ Décision }      Point de décision / condition
< Système >       Action automatique de la plateforme
( État )          Statut persisté en base
→                 Flux nominal
⇢                 Flux alternatif / exception
```

---

## 1. Workflow Acheteur

### 1.1 Onboarding

```
[ S'inscrire sur la plateforme ]
         |
         → < Création compte + organisation >
         |
         → ( statut : pending )
         |
         → < Email de confirmation envoyé >
         |
    { Admin valide ? }
    |              |
   Oui            Non
    |              ⇢ [ Resoumission documents ]
    ↓
( statut : active )
    |
    → [ Accès complet à la plateforme ]
```

---

### 1.2 Parcours Catalogue → Commande Standard

```
[ Se connecter ]
      |
      → [ Naviguer le catalogue ]
      |      |
      |      ├─ [ Rechercher par mot-clé / EAN ]
      |      ├─ [ Filtrer par catégorie / prix / vendeur ]
      |      └─ [ Consulter une fiche produit ]
      |
      → [ Ajouter au panier ]
      |      |
      |      └─ < Calcul automatique paliers de prix selon quantité >
      |
      → [ Lancer l'Optimiseur de Panier ]
      |      |
      |      ├─ < Compare les prix pour chaque EAN chez tous les vendeurs >
      |      ├─ < Calcule les frais de port par vendeur (flat / % / seuil) >
      |      ├─ < Propose consolidations pour économiser la livraison >
      |      └─ { Accepter suggestion optimiseur ? }
      |                |              |
      |               Oui            Non
      |                |              ⇢ [ Panier manuel conservé ]
      |                ↓
      |         [ Panier réoptimisé ]
      |
      → [ Valider le panier ]
      |
      → [ Saisir adresse de livraison ]
      |
      → [ Choisir conditions de paiement ]
      |       (30j / 60j / 90j / comptant)
      |
      → [ Confirmer la commande ]
      |
      → < Création commande en base >
      → < Notification email au(x) vendeur(s) >
      |
      → ( statut commande : pending )
```

---

### 1.3 Suivi de Commande

```
( pending ) → [ Vendeur confirme ]
                      ↓
              ( confirmed ) → [ Vendeur prépare ]
                                      ↓
                             ( in_preparation ) → [ Vendeur expédie / assigne livreur ]
                                                          ↓
                                                  ( shipped ) → [ Livreur livre ]
                                                                        ↓
                                                               ( delivered )
                                                                        |
                                                                        → [ Acheteur peut noter le vendeur ]
                                                                        → [ Facture disponible ]

    À tout moment :
    { Problème ? } ⇢ ( dispute ) → [ Ouverture ticket litige ]
    { Annulation ? } ⇢ ( cancelled ) — si avant in_preparation
```

---

### 1.4 Parcours Devis

```
[ Créer une demande de devis ]
      |
      → [ Saisir produits + quantités souhaitées ]
      |
      → [ Soumettre au vendeur ]
      |
      → ( statut devis : new )
      |
      → < Notification vendeur >
      |
      { Vendeur répond ? }
      |              |
     Oui            Non (délai expiré)
      |              ⇢ ( statut : expired )
      ↓
( statut : responded )
      |
      → [ Acheteur consulte la réponse ]
      |
      { Décision ? }
      |              |
   Accepter        Refuser
      |              ⇢ ( statut : refused )
      ↓
( statut : accepted )
      |
      → < Conversion automatique en commande >
      → ( statut : converted )
      → → → [ Retour workflow commande §1.2 ]
```

---

### 1.5 Finances

```
[ Accéder à Mes Finances ]
      |
      ├─ [ Voir tableau de bord encours / solde dû ]
      |
      ├─ [ Consulter liste des factures ]
      |       |
      |       ├─ ( pending )  → [ Télécharger PDF ] → [ Procéder au paiement hors-plateforme ]
      |       ├─ ( paid )     → [ Télécharger PDF à titre d'archive ]
      |       └─ ( overdue )  → < Alerte retard de paiement >
      |
      └─ [ Voir historique des transactions ]
                |
                ├─ Débits  (factures émises)
                └─ Crédits (paiements enregistrés)
```

---

### 1.6 Quick Order (EAN direct)

```
[ Aller sur Quick Order ]
      |
      → [ Saisir ou scanner EAN ]
      |
      → < Recherche produit par EAN >
      |
      { Produit trouvé ? }
      |              |
     Oui            Non ⇢ [ Message "EAN introuvable" ]
      ↓
[ Saisir quantité ]
      |
      → [ Ajouter à la commande rapide ]
      |
      → { Autre EAN ? }
      |      |
      |     Oui ⇢ [ Répéter ]
      |      |
      |     Non
      ↓
[ Valider la commande rapide ]
→ → → [ Retour workflow commande §1.2 ]
```

---

## 2. Workflow Fournisseur (Vendeur)

### 2.1 Onboarding

```
[ S'inscrire comme vendeur ]
      |
      → < Création compte organisation (type : seller) >
      |
      → [ Remplir profil vendeur ]
      |       (ICE, IF, RC, CNSS, coordonnées)
      |
      → [ Uploader documents légaux ]
      |       (RC, IF, ICE, RIB, certifications)
      |
      → ( statut : pending )
      |
      { Admin valide les documents ? }
      |              |
     Oui            Non ⇢ [ Demande de pièces complémentaires ]
      ↓
( statut : active )
      |
      → [ Configurer frais de livraison ]
      |       (flat_rate / free_above_threshold / percentage / free_always / negotiated)
      |
      → [ Commencer à publier des produits ]
```

---

### 2.2 Gestion du Catalogue

```
[ Accéder au Dashboard Vendeur ]
      |
      → [ Créer un nouveau produit ]
      |       |
      |       ├─ [ Renseigner EAN + infos générales ]
      |       ├─ [ Ajouter caractéristiques physiques ]
      |       ├─ [ Définir conditions de conservation ]
      |       ├─ [ Configurer grille de prix (paliers qty_min → unit_price) ]
      |       ├─ [ Uploader images ]
      |       └─ [ Publier → ( statut : active ) ]
      |
      → [ Gérer produits existants ]
      |       |
      |       ├─ [ Modifier prix / stock ]
      |       ├─ [ Désactiver → ( statut : inactive ) ]
      |       └─ [ Archiver → ( statut : draft ) ]
      |
      → [ Configurer frais de port ]
              |
              └─ [ Choisir mode + paramètres → < Sauvegarde vendor_delivery_config > ]
```

---

### 2.3 Gestion des Commandes Reçues

```
< Notification : nouvelle commande reçue >
      |
      → [ Consulter la commande ]
      |       (détail lignes, acheteur, adresse livraison)
      |
      { Commande acceptable ? }
      |              |
     Oui            Non ⇢ [ Contacter acheteur ] ⇢ ( annulation si accord )
      ↓
[ Confirmer la commande ]
      |
      → ( statut : confirmed )
      → < Notification acheteur >
      |
      → [ Préparer la commande ]
      |
      → ( statut : in_preparation )
      |
      { Mode de livraison ? }
      |              |
  Propre flotte    Transporteur tiers
      |              |
      ↓              ↓
[ Expédier ]    [ Assigner livreur partenaire ]
      |                    |
      └────────────────────┘
                   ↓
      [ Marquer comme expédiée ]
      |
      → ( statut : shipped )
      → < Notification acheteur >
      |
      → < Attente confirmation livraison >
      |
      → ( statut : delivered ) ← [ Livreur confirme livraison ]
      |
      → [ Émettre la facture ]
              → [ Retour workflow facture §2.4 ]
```

---

### 2.4 Émission de Factures

```
[ Ouvrir une commande confirmée ]
      |
      → [ Cliquer "Émettre la facture" ]
      |
      { Facture existante ? }
      |              |
     Oui            Non
      |              ↓
      |       < Génération numéro : FACT-YYYYMMDD-REF >
      |       < Calcul date d'échéance (J + payment_terms) >
      |       < Création enregistrement invoices >
      |       → ( statut facture : pending )
      ↓              ↓
      └──────────────┘
             ↓
      < Génération PDF facture >
      → [ Téléchargement automatique PDF ]
      → < Facture visible par l'acheteur dans Mes Finances >
```

---

### 2.5 Gestion des Devis

```
< Notification : nouvelle demande de devis >
      |
      → [ Consulter la demande ]
      |       (produits demandés, quantités, acheteur)
      |
      → ( statut : in_progress )
      |
      → [ Saisir la réponse ]
      |       (prix proposés, conditions, validité)
      |
      → [ Soumettre la réponse ]
      |
      → ( statut : responded )
      → < Notification acheteur >
      |
      { Acheteur répond ? }
      |              |
   Accepte        Refuse
      |              ⇢ ( statut : refused )
      ↓
( statut : accepted )
      → < Conversion en commande >
      → → → [ Retour workflow commandes §2.3 ]
```

---

## 3. Workflow Livreur

### 3.1 Onboarding

```
[ S'inscrire comme livreur ]
      |
      → [ Remplir profil société de transport ]
      |       (ICE, agrément, zones, types véhicules)
      |
      → [ Déclarer capacités ]
      |       (flotte, températures gérées, zones couvertes)
      |
      → ( statut : pending )
      |
      { Admin valide ? }
      |              |
     Oui            Non ⇢ [ Compléter dossier ]
      ↓
( statut : active )
      → [ Recevoir des bons de livraison ]
```

---

### 3.2 Gestion d'une Tournée

```
< Assignation d'un bon de livraison par vendeur / admin >
      |
      → ( statut tournée : assigned )
      → < Notification livreur >
      |
      → [ Consulter le bon de livraison ]
      |       (adresse collecte, adresse livraison, produits, instructions)
      |
      → [ Se rendre chez le vendeur ]
      |
      → [ Collecter la marchandise ]
      |
      → [ Marquer "Collecté" ]
      → ( statut : picked_up )
      |
      → [ Livrer chez l'acheteur ]
      |
      → ( statut : in_transit )
      |
      { Livraison réussie ? }
      |              |
     Oui            Non (absent, refus, adresse incorrecte)
      ↓              ⇢ ( statut : failed )
      |               ⇢ < Notification vendeur + acheteur >
      |               ⇢ [ Planification nouvelle tentative ]
      ↓
[ Enregistrer preuve de livraison ]
      |       (photo / signature / horodatage)
      |
→ ( statut : delivered )
→ < Notification acheteur + vendeur >
→ < Mise à jour statut commande → delivered >
```

---

### 3.3 Gestion des Incidents

```
{ Incident pendant la livraison ? }
      |
      ├─ Casse produit
      |       ⇢ [ Documenter (photo)] → [ Signaler incident ]
      |       ⇢ < Ouverture ticket litige >
      |
      ├─ Retard important
      |       ⇢ [ Notifier le dispatch ]
      |       ⇢ < Alerte automatique acheteur >
      |
      ├─ Destinataire absent
      |       ⇢ [ Avis de passage ] → ( statut : failed )
      |       ⇢ [ Planifier 2e tentative ]
      |
      └─ Adresse incorrecte
              ⇢ [ Contacter l'acheteur ] → [ Corriger + retenter ]
```

---

## 4. Workflow Commercial

### 4.1 Gestion du Portefeuille

```
[ Se connecter (rôle commercial) ]
      |
      → [ Dashboard commercial ]
      |       |
      |       ├─ KPIs : CA réalisé / objectif
      |       ├─ Taux conversion devis → commandes
      |       ├─ Nombre nouveaux comptes
      |       └─ Alertes : commandes en attente, devis expirés
      |
      → [ Gérer portefeuille acheteurs ]
      |       |
      |       ├─ [ Consulter fiche acheteur ]
      |       ├─ [ Voir historique commandes du compte ]
      |       ├─ [ Identifier comptes dormants ]
      |       └─ [ Planifier relance ]
      |
      → [ Gérer portefeuille fournisseurs ]
              |
              ├─ [ Vérifier disponibilité catalogue ]
              └─ [ Suivre performance vendeur ]
```

---

### 4.2 Création d'un Devis pour un Acheteur

```
[ Sélectionner un acheteur dans le portefeuille ]
      |
      → [ Créer un devis au nom de l'acheteur ]
      |
      → [ Rechercher produits dans le catalogue ]
      |
      → [ Ajouter lignes produits + quantités ]
      |
      → [ Vérifier grille de prix applicable ]
      |       (paliers qty_min → unit_price)
      |
      → [ Définir conditions commerciales ]
      |       (paiement, livraison, validité du devis)
      |
      → [ Soumettre le devis ]
      |
      → < Notification acheteur + vendeur concerné >
      |
      → ( statut : new ) → → → [ Retour workflow devis §2.5 ]
```

---

### 4.3 Suivi et Relance

```
[ Tableau de bord commercial — Vue Activité ]
      |
      ├─ { Devis sans réponse > 48h ? }
      |       ⇢ [ Relancer l'acheteur ]
      |
      ├─ { Commandes bloquées en pending > 24h ? }
      |       ⇢ [ Contacter le vendeur ]
      |
      ├─ { Compte sans commande depuis 30j ? }
      |       ⇢ [ Marquer "à relancer" ] → [ Prise de contact ]
      |
      └─ { Objectif CA mensuel atteint ? }
              |              |
             Oui            Non
              ↓              ⇢ [ Intensifier prospection nouveaux comptes ]
        [ Rapport mensuel ]
```

---

## 5. Workflow Admin

### 5.1 Validation des Comptes

```
< Nouvelle demande d'inscription >
      |
      { Type de compte ? }
      |         |          |
  Acheteur  Vendeur    Livreur
      |         |          |
      └────────────────────┘
                ↓
      [ Consulter le dossier ]
      |       (documents légaux : ICE, IF, RC, RIB, agréments)
      |
      { Documents complets et valides ? }
      |              |
     Oui            Non ⇢ [ Envoyer demande de compléments ]
      ↓               ⇢ ( statut : pending — en attente docs )
[ Valider le compte ]
      |
      → ( statut : active )
      → < Email de bienvenue >
      |
      { Suspicion fraude / non-conformité ultérieure ? }
              ⇢ [ Suspendre → ( statut : suspended ) ]
              ⇢ [ Rejeter → ( statut : rejected ) ]
```

---

### 5.2 Supervision des Commandes

```
[ Dashboard Admin — Vue Commandes Globales ]
      |
      ├─ [ Filtrer par statut / vendeur / acheteur / date ]
      |
      ├─ { Commande en litige ? }
      |       ⇢ [ Consulter ticket litige ]
      |       ⇢ [ Arbitrer : favor acheteur / vendeur ]
      |       ⇢ [ Clôturer litige ]
      |
      ├─ { Commande bloquée sans action vendeur ? }
      |       ⇢ [ Notifier le vendeur ]
      |       ⇢ [ Escalader si pas de réponse sous 24h ]
      |
      └─ [ Exporter rapport commandes (CSV / PDF) ]
```

---

### 5.3 Gestion du Catalogue Global

```
[ Dashboard Admin — Catalogue ]
      |
      ├─ [ Modérer les nouveaux produits soumis ]
      |       { Produit conforme ? }
      |       |              |
      |      Oui            Non ⇢ [ Rejeter avec motif ]
      |       ↓
      |  ( statut : active )
      |
      ├─ [ Gérer les catégories ]
      |       (créer / modifier / désactiver catégories)
      |
      ├─ [ Auditer les prix ]
      |       (détecter prix aberrants, doublons EAN)
      |
      └─ [ Gérer les marques et fournisseurs référencés ]
```

---

### 5.4 Supervision Financière

```
[ Dashboard Admin — Finances Globales ]
      |
      ├─ [ Vue encours acheteurs ]
      |       { Encours dépassé ? }
      |       ⇢ [ Bloquer nouvelles commandes ]
      |       ⇢ [ Notifier équipe recouvrement ]
      |
      ├─ [ Suivi factures en retard ]
      |       { Facture overdue > X jours ? }
      |       ⇢ [ Relance automatique ] → [ Escalade manuelle ]
      |
      ├─ [ Tableau de bord CA plateforme ]
      |       (par vendeur / acheteur / catégorie / période)
      |
      └─ [ Gestion des commissions et paramètres tarifaires ]
```

---

## 6. Vue Croisée — Flux d'une Commande de bout en bout

```
ACHETEUR              PLATEFORME              VENDEUR             LIVREUR
    |                     |                      |                    |
[ Commande ]             |                      |                    |
    |──────────────→ < Création >               |                    |
    |                < Notif. >─────────────→ [ Reçoit ]            |
    |                     |                  [ Confirme ]           |
    |              ( confirmed )←────────────   |                    |
    |                     |                  [ Prépare ]            |
    |              ( in_preparation )←───────   |                    |
    |                     |                  [ Expédie ]            |
    |                     |                  [ Assigne ]─────────→ [ Reçoit BL ]
    |              ( shipped )←──────────────   |                 [ Collecte ]
    |                < Notif. >                 |              ( picked_up )
    |                     |                      |              [ Livre ]
    |                     |                      |          ( in_transit )
    |                     |                      |          [ Preuve livraison ]
    |              ( delivered )←────────────────────────────   |
    |                < Notif. >                 |                    |
[ Reçoit ]               |                   [ Facture ]            |
[ Paie ]                 |               ( invoice: pending )       |
    |                     |                      |                    |
[ Finances ]             |                      |                    |
```

---

## 7. Matrice Droits & Actions par Rôle

| Action | Acheteur | Vendeur | Livreur | Commercial | Admin |
|--------|----------|---------|---------|------------|-------|
| Consulter catalogue | ✓ | ✓ (les siens) | — | ✓ | ✓ |
| Créer produit | — | ✓ | — | — | ✓ |
| Passer commande | ✓ | — | — | ✓ (pour acheteur) | ✓ |
| Confirmer commande | — | ✓ | — | — | ✓ |
| Émettre facture | — | ✓ | — | — | ✓ |
| Créer devis | ✓ | — | — | ✓ | ✓ |
| Répondre à un devis | — | ✓ | — | — | ✓ |
| Gérer tournées | — | — | ✓ | — | ✓ |
| Valider comptes | — | — | — | — | ✓ |
| Arbitrer litiges | — | — | — | — | ✓ |
| Voir finances globales | — | — | — | — | ✓ |
| Exporter rapports | ✓ (les siens) | ✓ (les siens) | ✓ (les siens) | ✓ (périmètre) | ✓ |
```
