-- Migration 025: enrichissement seller_profiles pour la vitrine boutique
-- Ajoute les champs publics que le vendeur contrôle depuis son espace

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS website            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS default_moq        INTEGER,
  ADD COLUMN IF NOT EXISTS default_franco_eur NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS default_delivery_methods TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_incoterms  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_export_countries TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.seller_profiles.description IS 'Présentation publique de la boutique (max 1000 chars)';
COMMENT ON COLUMN public.seller_profiles.website IS 'Site web de l''entreprise';
COMMENT ON COLUMN public.seller_profiles.default_moq IS 'Quantité minimale de commande par défaut';
COMMENT ON COLUMN public.seller_profiles.default_franco_eur IS 'Montant franco de port par défaut en EUR';
COMMENT ON COLUMN public.seller_profiles.default_delivery_methods IS 'Méthodes de livraison proposées par défaut';
COMMENT ON COLUMN public.seller_profiles.default_incoterms IS 'Incoterms acceptés par défaut';
COMMENT ON COLUMN public.seller_profiles.default_export_countries IS 'Pays d''export par défaut';
