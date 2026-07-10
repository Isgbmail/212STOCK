# Stock212 — Fiches Entités

---

## Fiche Produit

### Identité
| Champ | Description |
|-------|-------------|
| **Nom** | Nom commercial du produit |
| **EAN** | Code-barres GS1 (13 chiffres) — identifiant universel |
| **Catégorie** | Classification produit (Food, Boissons, Épicerie sèche, Conserves, Surgelés, etc.) |
| **Marque** | Marque du fabricant |
| **Statut** | `active` / `inactive` / `draft` |

### Référence & Traçabilité
| Champ | Description |
|-------|-------------|
| **Fournisseur vendeur** | Organisation vendeuse (`seller_org_id`) |
| **Pays d'origine** | Code ISO pays (ex. `MA`, `ES`, `FR`) |
| **Numéro HS** | Code douanier pour l'export/import |
| **HACCP** | Conformité aux normes d'hygiène alimentaire |
| **Certifications** | Bio, Halal, ISO 22000, etc. |

### Caractéristiques Physiques
| Champ | Description |
|-------|-------------|
| **Poids net / brut** | En kg + unité (`kg`, `g`) |
| **Forme physique** | Liquide, solide, poudre, etc. |
| **Type d'emballage** | Bouteille, sachet, boîte, carton, etc. |
| **Matériau emballage** | Plastique, verre, aluminium, carton |
| **Unités par carton** | Nombre d'unités dans un inner pack |
| **Palettisation** | Configuration palette (ex. `8x12`) |
| **Volume CBM carton** | Volume en m³ |

### Conditions de Conservation
| Champ | Description |
|-------|-------------|
| **Température** | `ambient` / `chilled` / `frozen` |
| **Temp. min / max** | Plage de température de stockage (°C) |
| **DLC** | Type de date limite (DLC, DLUO) |
| **Durée de vie** | Shelf life en jours |
| **Après ouverture** | Durée de conservation après ouverture (jours) |
| **Chaîne du froid requise** | Oui / Non |
| **Sensible humidité** | Oui / Non |
| **Sensible lumière** | Oui / Non |
| **FIFO obligatoire** | Oui / Non |

### Prix & Conditions Commerciales
| Champ | Description |
|-------|-------------|
| **Devise** | `MAD`, `EUR`, `USD` |
| **Grille de prix** | Paliers de quantité (`qty_min` → `unit_price`) |
| **MOQ** | Quantité minimale de commande |
| **Pack size** | Conditionnement de vente (ex. 6, 12, 24) |
| **Incoterms** | EXW, FOB, DDP, etc. |
| **Délai d'approvisionnement** | En jours ouvrés |

### Marketing
| Champ | Description |
|-------|-------------|
| **Description courte** | Accroche produit (1-2 lignes) |
| **Description longue** | Fiche technique complète |
| **Images** | URLs des visuels produit |
| **Nutri-Score** | A / B / C / D / E |
| **Éco-Score** | Indice environnemental |
| **USP** | Argument de vente unique |
| **Segment cible** | GMS, CHR, Export, Épiceries, etc. |
| **Canal de distribution** | Wholesale, Direct, Export |

---

## Fiche Fournisseur

### Identité
| Champ | Description |
|-------|-------------|
| **Raison sociale** | Nom légal de l'entreprise |
| **Nom commercial** | Nom affiché sur la plateforme |
| **Forme juridique** | SARL, SA, Auto-entrepreneur, etc. |
| **ICE** | Identifiant Commun de l'Entreprise (Maroc) |
| **IF** | Identifiant Fiscal |
| **RC** | Registre de Commerce |
| **CNSS** | Numéro d'affiliation sociale |
| **Patente** | Numéro de patente |

### Contact & Localisation
| Champ | Description |
|-------|-------------|
| **Adresse** | Siège social complet |
| **Ville** | Ville d'implantation |
| **Région** | Région administrative |
| **Email** | Email de contact principal |
| **Téléphone** | Numéro principal |
| **Site web** | URL (optionnel) |
| **Contact référent** | Nom + poste du responsable commercial |

### Activité & Catalogue
| Champ | Description |
|-------|-------------|
| **Secteur** | Agroalimentaire, FMCG, Hygiène, etc. |
| **Catégories produits** | Familles gérées sur la plateforme |
| **Nombre de références** | Total SKUs actifs |
| **Marques représentées** | Liste des marques distribuées |
| **Zones de livraison** | Régions couvertes |
| **Mode de livraison** | Propre flotte / Transporteur / Retrait entrepôt |

### Conditions de Validation
| Champ | Description |
|-------|-------------|
| **Statut de validation** | `pending` / `active` / `suspended` / `rejected` |
| **Documents fournis** | RC, IF, ICE, RIB, certifications |
| **Date d'entrée** | Date de création du compte |
| **Vérifié par** | Admin ayant validé le compte |

### Performance
| Champ | Description |
|-------|-------------|
| **Note moyenne** | Sur 5 étoiles (avis acheteurs) |
| **Taux de remplissage** | % commandes livrées complètes |
| **Délai moyen** | Délai réel de livraison (jours) |
| **Volume mensuel** | CA mensuel généré sur la plateforme |

### Livraison & Tarification
| Champ | Description |
|-------|-------------|
| **Mode de frais de port** | `flat_rate` / `free_above_threshold` / `percentage` / `free_always` / `negotiated` |
| **Frais fixes** | Montant en MAD (si flat_rate) |
| **Seuil de gratuité** | Montant HT pour livraison offerte |
| **Taux pourcentage** | % du montant HT (si mode percentage) |
| **Charge min / max** | Plancher et plafond des frais de port |

---

## Fiche Acheteur

### Identité
| Champ | Description |
|-------|-------------|
| **Raison sociale** | Nom légal de l'entreprise |
| **Nom commercial** | Enseigne ou nom affiché |
| **Forme juridique** | SARL, SA, Auto-entrepreneur, etc. |
| **ICE** | Identifiant Commun de l'Entreprise |
| **IF** | Identifiant Fiscal |
| **RC** | Registre de Commerce |

### Contact & Localisation
| Champ | Description |
|-------|-------------|
| **Adresse principale** | Adresse de facturation |
| **Ville** | Ville principale |
| **Région** | Région administrative |
| **Email** | Email du responsable achats |
| **Téléphone** | Numéro principal |
| **Contact référent** | Nom + poste du responsable |

### Profil d'Achat
| Champ | Description |
|-------|-------------|
| **Secteur d'activité** | Restauration, Grande distribution, Épicerie, Hôtellerie, etc. |
| **Type d'établissement** | Restaurant, Supermarché, Hôtel, Grossiste, etc. |
| **Volume d'achat mensuel** | Estimation en MAD |
| **Fréquence de commande** | Hebdomadaire, bimensuelle, mensuelle |
| **Catégories achetées** | Familles de produits commandées |
| **Fournisseurs habituels** | Vendeurs avec qui l'acheteur travaille |

### Conditions Commerciales
| Champ | Description |
|-------|-------------|
| **Conditions de paiement** | 30j, 60j, 90j, comptant |
| **Plafond de crédit** | Montant maximum de crédit accordé |
| **Mode de paiement préféré** | Virement, chèque, traite, CB |
| **Devise** | MAD (par défaut) |

### Adresses de Livraison
| Champ | Description |
|-------|-------------|
| **Adresses enregistrées** | Liste des points de livraison |
| **Adresse par défaut** | Adresse principale de réception |
| **Instructions spéciales** | Accès, horaires, contacts sur site |

### Statut & Validation
| Champ | Description |
|-------|-------------|
| **Statut** | `pending` / `active` / `suspended` |
| **Date d'inscription** | Date de création du compte |
| **Validé par** | Admin ayant activé le compte |
| **Compte vérifié** | Documents ICE, RC confirmés |

### Historique & Finances
| Champ | Description |
|-------|-------------|
| **Total commandé** | Cumul des commandes en MAD |
| **Encours** | Montant dû non réglé |
| **Factures en attente** | Nombre de factures `pending` |
| **Note fournisseurs** | Note laissée sur les vendeurs |

---

## Fiche Livreur

### Identité
| Champ | Description |
|-------|-------------|
| **Raison sociale** | Nom de la société de transport |
| **Forme juridique** | SARL, SA, Indépendant |
| **ICE** | Identifiant Commun de l'Entreprise |
| **Numéro d'agrément** | Autorisation de transport de marchandises |
| **Statut** | `pending` / `active` / `suspended` |

### Contact
| Champ | Description |
|-------|-------------|
| **Responsable** | Nom du gérant ou dispatcher principal |
| **Email** | Email opérationnel |
| **Téléphone** | Numéro du dispatch |
| **Adresse dépôt** | Entrepôt ou base opérationnelle |

### Capacités Opérationnelles
| Champ | Description |
|-------|-------------|
| **Zones couvertes** | Régions et villes desservies |
| **Types de transport** | Température ambiante, réfrigéré, surgelé |
| **Flotte** | Nombre de véhicules + types (camion, fourgon, etc.) |
| **Capacité de charge** | Tonnage par tournée |
| **Certifications** | ATP (réfrigéré), ADR (dangereux), etc. |
| **Délai de collecte** | Délai après confirmation de commande |
| **Délai de livraison** | Délai moyen par zone (jours) |

### Méthodes & Tarification
| Champ | Description |
|-------|-------------|
| **Modes de livraison** | `seller_fleet` / `third_party` / `pickup` |
| **Grille tarifaire** | Prix par zone / poids / volume |
| **Enlèvement minimum** | Poids ou montant minimum par tournée |
| **Créneau de livraison** | Plages horaires disponibles |

### Performance
| Champ | Description |
|-------|-------------|
| **Taux de livraison réussie** | % livraisons effectuées sans incident |
| **Délai moyen réel** | Délai constaté vs délai annoncé |
| **Incidents signalés** | Casse, perte, retard, erreur |
| **Note acheteurs** | Évaluation des destinataires |
| **Livraisons du mois** | Volume de livraisons sur la période |

### Suivi des Tournées
| Champ | Description |
|-------|-------------|
| **Commandes assignées** | Bons de livraison en cours |
| **Statut tournée** | `assigned` / `picked_up` / `in_transit` / `delivered` / `failed` |
| **Preuve de livraison** | Photo / signature / horodatage |
| **Validation finale** | Confirmation de réception par l'acheteur |

---

## Fiche Commercial

### Identité
| Champ | Description |
|-------|-------------|
| **Prénom / Nom** | Identité complète |
| **Email professionnel** | Email de connexion à la plateforme |
| **Téléphone** | Mobile professionnel |
| **Rôle** | `commercial` / `account_manager` / `admin` |
| **Statut** | Actif / Inactif |

### Périmètre
| Champ | Description |
|-------|-------------|
| **Zone géographique** | Région(s) assignée(s) |
| **Portefeuille acheteurs** | Liste des comptes acheteurs gérés |
| **Portefeuille fournisseurs** | Vendeurs suivis |
| **Catégories produits** | Familles de produits en charge |

### Activité Commerciale
| Champ | Description |
|-------|-------------|
| **Nombre de devis émis** | Total du mois en cours |
| **Taux de conversion** | % devis → commandes confirmées |
| **Volume d'affaires** | CA généré sur la période |
| **Commandes suivies** | Commandes en cours dans son périmètre |
| **Visites client** | Nombre de RDV effectués |

### Objectifs & KPIs
| Champ | Description |
|-------|-------------|
| **Objectif CA mensuel** | Cible en MAD |
| **Réalisation** | CA réalisé vs objectif (%) |
| **Nouveaux comptes** | Clients activés dans le mois |
| **Réactivation** | Comptes dormants relancés |
| **NPS portefeuille** | Satisfaction moyenne des comptes gérés |

### Outils & Accès
| Champ | Description |
|-------|-------------|
| **Accès catalogue** | Consultation de tous les produits actifs |
| **Création de devis** | Génération de devis au nom d'un acheteur |
| **Suivi commandes** | Visibilité sur les commandes de son périmètre |
| **Accès finances** | Lecture des encours et factures |
| **Notifications** | Alertes sur statuts commandes et paiements |
| **Export données** | Export CSV / PDF de ses rapports |
