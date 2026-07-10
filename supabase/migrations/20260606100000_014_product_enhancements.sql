/*
# Migration 14: Product Detail Enhancements

## Summary
Adds structured nutritional values, Nutri-Score, DLC/DDM type, and downloadable
document URLs to the products table, enabling a complete FMCG B2B product sheet.

## New columns
- `nutri_score`         — Nutri-Score label A–E (nullable)
- `dlc_type`            — Date type DLC or DDM (nullable)
- `nutritional_values`  — Structured JSONB nutritional table (per 100g)
- `document_urls`       — JSONB array of downloadable documents {name, url, type}
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS nutri_score        text CHECK (nutri_score IN ('A','B','C','D','E')),
  ADD COLUMN IF NOT EXISTS dlc_type           text CHECK (dlc_type IN ('DLC','DDM')),
  ADD COLUMN IF NOT EXISTS nutritional_values  jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_urls       jsonb DEFAULT '[]';

COMMENT ON COLUMN products.nutri_score        IS 'Nutri-Score A–E (food products)';
COMMENT ON COLUMN products.dlc_type           IS 'DLC = Date Limite de Consommation / DDM = Date de Durabilité Minimale';
COMMENT ON COLUMN products.nutritional_values  IS 'Structured nutrition per 100g: {energy_kcal, energy_kj, fat_g, saturated_fat_g, carbs_g, sugars_g, fiber_g, protein_g, salt_g, net_weight_g}';
COMMENT ON COLUMN products.document_urls       IS 'Array of {name, url, type} where type ∈ datasheet|certificate|logistics|fds|other';
