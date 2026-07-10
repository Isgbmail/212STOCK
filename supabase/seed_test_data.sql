-- =============================================================================
-- Stock212 — Seed de données de test
-- EXÉCUTER EN 2 PARTIES dans Supabase → SQL Editor
-- Mot de passe commun : Test1234!
-- =============================================================================


-- ███████████████████████████████████████████████████████████████████████████
-- PARTIE 1 — Comptes utilisateurs
-- Coller uniquement ce bloc, cliquer Run, attendre "Success", puis Partie 2.
-- ███████████████████████████████████████████████████████████████████████████

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Insertion des 4 utilisateurs (ignoré si email déjà existant) ─────────────

INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@stock212.test',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Platform"}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@stock212.test');

INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'vendeur@stock212.test',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Karim Benali"}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'vendeur@stock212.test');

INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'acheteur@stock212.test',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sophie Martin"}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'acheteur@stock212.test');

INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'livreur@stock212.test',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Mehdi Rousseau"}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'livreur@stock212.test');

-- ── Identités (nécessaires pour que la connexion email fonctionne) ────────────

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT
  u.email,
  u.id,
  json_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(), now()
FROM auth.users u
WHERE u.email IN (
  'admin@stock212.test',
  'vendeur@stock212.test',
  'acheteur@stock212.test',
  'livreur@stock212.test'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);


-- ███████████████████████████████████████████████████████████████████████████
-- PARTIE 2 — Organisations, profils et produits
-- Coller uniquement ce bloc après que la Partie 1 ait réussi.
-- ███████████████████████████████████████████████████████████████████████████

DO $$
DECLARE
  uid_admin    uuid;
  uid_seller   uuid;
  uid_buyer    uuid;
  uid_delivery uuid;

  org_seller   uuid;
  org_buyer    uuid;
  org_delivery uuid;

  cat_boissons  uuid;
  cat_epicerie  uuid;
  cat_laitiers  uuid;
  cat_bouche    uuid;
  cat_surgeles  uuid;
  cat_conserves uuid;
  cat_hygiene   uuid;

  brand_nestle    uuid;
  brand_danone    uuid;
  brand_cocacola  uuid;
  brand_bonduelle uuid;
  brand_mccain    uuid;
  brand_heinz     uuid;
  brand_president uuid;

  p uuid;

BEGIN

  -- ── Récupération des UIDs depuis auth.users ─────────────────────────────
  SELECT id INTO uid_admin    FROM auth.users WHERE email = 'admin@stock212.test'    LIMIT 1;
  SELECT id INTO uid_seller   FROM auth.users WHERE email = 'vendeur@stock212.test'  LIMIT 1;
  SELECT id INTO uid_buyer    FROM auth.users WHERE email = 'acheteur@stock212.test' LIMIT 1;
  SELECT id INTO uid_delivery FROM auth.users WHERE email = 'livreur@stock212.test'  LIMIT 1;

  IF uid_admin IS NULL OR uid_seller IS NULL OR uid_buyer IS NULL OR uid_delivery IS NULL THEN
    RAISE EXCEPTION 'Un ou plusieurs utilisateurs introuvables — exécutez la Partie 1 en premier.';
  END IF;

  -- ── Profils (onboarding marqué terminé) ────────────────────────────────
  INSERT INTO public.profiles (id, full_name, onboarding_done, is_admin)
  VALUES
    (uid_admin,    'Admin Platform',  true, true),
    (uid_seller,   'Karim Benali',    true, false),
    (uid_buyer,    'Sophie Martin',   true, false),
    (uid_delivery, 'Mehdi Rousseau',  true, false)
  ON CONFLICT (id) DO UPDATE
    SET full_name       = EXCLUDED.full_name,
        onboarding_done = true,
        is_admin        = EXCLUDED.is_admin;

  -- ── Organisations ───────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE name = 'MaghrebImport SARL') THEN
    INSERT INTO public.organisations (name, org_type, sub_type, country, city, postal_code, validation_status)
    VALUES ('MaghrebImport SARL', 'seller', 'Distributeur', 'FR', 'Paris', '75010', 'active');
  END IF;
  SELECT id INTO org_seller FROM public.organisations WHERE name = 'MaghrebImport SARL' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE name = 'Épicerie du Marché SARL') THEN
    INSERT INTO public.organisations (name, org_type, sub_type, country, city, postal_code, validation_status)
    VALUES ('Épicerie du Marché SARL', 'buyer', 'Épicerie', 'FR', 'Lyon', '69001', 'active');
  END IF;
  SELECT id INTO org_buyer FROM public.organisations WHERE name = 'Épicerie du Marché SARL' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE name = 'TransFresh Express') THEN
    INSERT INTO public.organisations (name, org_type, sub_type, country, city, postal_code, validation_status)
    VALUES ('TransFresh Express', 'delivery', 'Entreprise de logistique', 'FR', 'Marseille', '13001', 'active');
  END IF;
  SELECT id INTO org_delivery FROM public.organisations WHERE name = 'TransFresh Express' LIMIT 1;

  -- ── Profils métier ──────────────────────────────────────────────────────
  INSERT INTO public.seller_profiles (organisation_id, certifications, accepted_payment_terms, default_prep_days)
  VALUES (org_seller, ARRAY['ISO 22000','Bio AB'], ARRAY['prepayment','30_days'], 2)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.buyer_profiles (organisation_id, default_payment_terms, credit_limit)
  VALUES (org_buyer, '30_days', 15000.00)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.delivery_profiles (organisation_id, delivery_type, base_rate, validation_status)
  VALUES (org_delivery, 'logistics_company', 4.50, 'validated')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.delivery_capabilities (organisation_id, cold_chain, ambient, frozen, last_mile, max_weight_kg, max_volume_m3)
  VALUES (org_delivery, true, true, true, true, 2000.00, 40.000)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.delivery_zones (organisation_id, region, postal_codes, lead_days_min, lead_days_max)
  VALUES
    (org_delivery, 'Île-de-France',              ARRAY['75','92','93','94','95','77','78','91'], 1, 2),
    (org_delivery, 'Provence-Alpes-Côte d''Azur', ARRAY['13','83','84','06','04','05'],          2, 3)
  ON CONFLICT DO NOTHING;

  -- ── Membres ────────────────────────────────────────────────────────────
  INSERT INTO public.organisation_members (organisation_id, user_id, team_role)
  VALUES
    (org_seller,   uid_seller,   'owner'),
    (org_buyer,    uid_buyer,    'owner'),
    (org_delivery, uid_delivery, 'owner')
  ON CONFLICT DO NOTHING;

  -- ── Adresse par défaut acheteur ─────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.saved_addresses WHERE organisation_id = org_buyer AND alias = 'Siège') THEN
    INSERT INTO public.saved_addresses (organisation_id, alias, address_line1, city, postal_code, country, is_default_delivery, is_default_billing)
    VALUES (org_buyer, 'Siège', '12 rue du Marché', 'Lyon', '69001', 'FR', true, true);
  END IF;

  -- ── Lookup catégories ───────────────────────────────────────────────────
  SELECT id INTO cat_boissons  FROM public.categories WHERE name = 'Boissons'                LIMIT 1;
  SELECT id INTO cat_epicerie  FROM public.categories WHERE name = 'Épicerie sèche'          LIMIT 1;
  SELECT id INTO cat_laitiers  FROM public.categories WHERE name = 'Produits laitiers'       LIMIT 1;
  SELECT id INTO cat_bouche    FROM public.categories WHERE name = 'Boucherie & Charcuterie' LIMIT 1;
  SELECT id INTO cat_surgeles  FROM public.categories WHERE name = 'Surgelés'                LIMIT 1;
  SELECT id INTO cat_conserves FROM public.categories WHERE name = 'Conserves'               LIMIT 1;
  SELECT id INTO cat_hygiene   FROM public.categories WHERE name = 'Hygiène'                 LIMIT 1;

  -- ── Lookup marques ──────────────────────────────────────────────────────
  SELECT id INTO brand_nestle    FROM public.brands WHERE name = 'Nestlé'     LIMIT 1;
  SELECT id INTO brand_danone    FROM public.brands WHERE name = 'Danone'     LIMIT 1;
  SELECT id INTO brand_cocacola  FROM public.brands WHERE name = 'Coca-Cola'  LIMIT 1;
  SELECT id INTO brand_bonduelle FROM public.brands WHERE name = 'Bonduelle'  LIMIT 1;
  SELECT id INTO brand_mccain    FROM public.brands WHERE name = 'McCain'     LIMIT 1;
  SELECT id INTO brand_heinz     FROM public.brands WHERE name = 'Heinz'      LIMIT 1;
  SELECT id INTO brand_president FROM public.brands WHERE name = 'Président'  LIMIT 1;

  -- ════════════════════════════════════════════════════════════════════════
  -- PRODUITS
  -- ════════════════════════════════════════════════════════════════════════

  -- 1 · Eau minérale 1,5L x6
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Eau minérale naturelle plate 1,5L x6' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Eau minérale naturelle plate 1,5L x6',
      'Eau minérale naturelle de source — pack 6 bouteilles PET 1,5L',
      'Captée à la source de Vals-les-Bains (Ardèche), faible minéralisation (170 mg/L). Idéale restauration, hôtels et distribution alimentaire.',
      cat_boissons, '3760091725018', 'active', 6, 6, 'ambient',
      730, 'FR', 'EUR', 2400, 3,
      ARRAY['https://images.pexels.com/photos/1346155/pexels-photo-1346155.jpeg'],
      'A', 4.50, 12
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 2.40), (p, 50, 2.10), (p, 200, 1.90);
  END IF;

  -- 2 · Coca-Cola 33cl x24
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Coca-Cola Original 33cl x24' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, is_on_promotion, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Coca-Cola Original 33cl x24',
      'Boisson gazeuse sucrée — pack 24 canettes aluminium 33cl',
      'La référence des boissons gazeuses. Canette 33cl, pack carton filmé de 24 unités. Format CHR et GMS.',
      cat_boissons, brand_cocacola, '5449000000996', 'active', 24, 24, 'ambient',
      365, 'BE', 'EUR', 800, 2,
      ARRAY['https://images.pexels.com/photos/50593/coca-cola-cold-drink-soft-drink-coke-50593.jpeg'],
      true, 'E', 4.20, 35
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 12.90), (p, 10, 11.50), (p, 50, 10.80);
  END IF;

  -- 3 · Lait UHT demi-écrémé 1L x6
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Lait UHT demi-écrémé 1L x6' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, certifications, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Lait UHT demi-écrémé 1L x6',
      'Lait de vache demi-écrémé stérilisé UHT — pack 6 briques 1L',
      'Lait collecté en Hauts-de-France, traitement UHT. Brique carton recyclable. Conditionnement par 6.',
      cat_laitiers, brand_president, '3450630014346', 'active', 6, 6, 'ambient',
      90, 'FR', 'EUR', 1500, 2,
      ARRAY['https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'],
      ARRAY['Label Rouge'], 'B', 4.70, 28
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 5.40), (p, 20, 4.95), (p, 100, 4.60);
  END IF;

  -- 4 · Couscous moyen 1kg
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Couscous moyen semoule fine 1kg' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Couscous moyen semoule fine 1kg',
      'Semoule de blé dur précuite — grain moyen, prêt en 5 min',
      'Semoule de blé dur de qualité supérieure, précuite à la vapeur et séchée. Sachet sous vide 1kg, carton de 12 unités.',
      cat_epicerie, '3760012390271', 'active', 12, 12, 'ambient',
      540, 'DZ', 'EUR', 3600, 4,
      ARRAY['https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'],
      'B', 4.80, 41
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 1.95), (p, 60, 1.70), (p, 300, 1.50);
  END IF;

  -- 5 · Sardines à l'huile d'olive 125g
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Sardines entières à l''huile d''olive 125g' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, certifications, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Sardines entières à l''huile d''olive 125g',
      'Sardines de l''Atlantique à l''huile d''olive vierge extra — boîte 125g',
      'Sardines pêchées en Atlantique Nord-Est, certifiées MSC pêche durable. Boîte métal 125g, conserve 5 ans.',
      cat_conserves, '3419680020127', 'active', 24, 24, 'ambient',
      1825, 'MA', 'EUR', 2880, 5,
      ARRAY['https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'],
      ARRAY['MSC','Pêche Durable'], 'A', 4.60, 19
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 1.85), (p, 48, 1.60), (p, 240, 1.40);
  END IF;

  -- 6 · Tomates concassées BIO 400g
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Tomates concassées BIO 400g' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, certifications, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Tomates concassées BIO 400g',
      'Tomates pelées concassées agriculture biologique — boîte 400g',
      'Tomates Roma d''Italie du Sud sans pesticides. Certifiées Bio AB et Ecocert. Idéales pizzas, sauces et plats mijotés.',
      cat_conserves, brand_bonduelle, '3083680007756', 'active', 12, 12, 'ambient',
      1095, 'IT', 'EUR', 1440, 3,
      ARRAY['https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'],
      ARRAY['Bio AB','Ecocert'], 'A', 4.40, 22
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 0.95), (p, 60, 0.82), (p, 300, 0.75);
  END IF;

  -- 7 · Frites surgelées 2,5kg
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Frites classiques surgelées 2,5kg' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, certifications, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Frites classiques surgelées 2,5kg',
      'Frites allumettes surgelées 2,5kg — four ou friture, format restauration',
      'Pommes de terre Bintje belge, calibre 10/10mm, surgelées à -40°C. Sac 2,5kg, carton de 4. Idéal restauration rapide et collective.',
      cat_surgeles, brand_mccain, '5410228023050', 'active', 4, 4, 'frozen',
      540, 'BE', 'EUR', 400, 2,
      ARRAY['https://images.pexels.com/photos/3736173/pexels-photo-3736173.jpeg'],
      ARRAY['Qualité Restauration'], 4.30, 17
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 6.50), (p, 20, 5.90), (p, 80, 5.40);
  END IF;

  -- 8 · Yaourt nature brassé x4
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Yaourt nature brassé pot verre 125g x4' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Yaourt nature brassé pot verre 125g x4',
      'Yaourt brassé lait entier — pot verre consigné, barquette 4 x 125g',
      'Ferments vivants sélectionnés, lait entier français. Pot verre 125g consigné (0,05€/pot). DLC 21 jours.',
      cat_laitiers, brand_danone, '3033710065097', 'active', 12, 4, 'refrigerated',
      21, 'FR', 'EUR', 960, 1,
      ARRAY['https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'],
      'B', 4.55, 14
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 2.15), (p, 24, 1.95), (p, 96, 1.78);
  END IF;

  -- 9 · Ketchup Heinz 1kg
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Ketchup Heinz 1kg squeeze' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Ketchup Heinz 1kg squeeze',
      'Ketchup tomate classique flacon souple 1kg — format restauration',
      'Recette originale sans colorants ni conservateurs artificiels. Flacon squeeze 1kg bouchon auto-fermant. Format cafés, restaurants et cantines.',
      cat_epicerie, brand_heinz, '0013000004602', 'active', 6, 6, 'ambient',
      730, 'NL', 'EUR', 720, 3,
      ARRAY['https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'],
      'D', 4.25, 31
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 4.20), (p, 24, 3.80), (p, 120, 3.45);
  END IF;

  -- 10 · Filets de poulet fermier Label Rouge 1kg
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Filets de poulet fermier Label Rouge 1kg' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, certifications, nutri_score, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Filets de poulet fermier Label Rouge 1kg',
      'Filets poulet fermier français plein air — sous vide 1kg',
      'Élevage plein air 81 jours min, nourri céréales françaises. Filets parés sous vide. DLC 7 jours.',
      cat_bouche, '3250390027504', 'active', 5, 1, 'refrigerated',
      7, 'FR', 'EUR', 200, 1,
      ARRAY['https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg'],
      ARRAY['Label Rouge','Plein Air'], 'A', 4.75, 9
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 8.90), (p, 20, 7.95), (p, 50, 7.40);
  END IF;

  -- 11 · Savon liquide mains recharge 5L
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Savon liquide mains recharge 5L' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, avg_rating, review_count, is_new
    ) VALUES (
      org_seller,
      'Savon liquide mains recharge 5L',
      'Savon doux parfumé fleur de coton — bidon 5L recharge distributeur',
      'pH neutre, formule douce mains sensibles. Bidon 5L robinet verseur, compatible tous distributeurs. Biodégradable à 95%.',
      cat_hygiene, '3574660207361', 'active', 4, 1, 'ambient',
      1095, 'FR', 'EUR', 500, 3,
      ARRAY['https://images.pexels.com/photos/3952232/pexels-photo-3952232.jpeg'],
      4.35, 7, true
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 8.50), (p, 10, 7.80), (p, 40, 7.20);
  END IF;

  -- 12 · Kit Kat 4 doigts x24
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Kit Kat 4 doigts 41,5g x24' AND seller_org_id = org_seller) THEN
    INSERT INTO public.products (
      seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature,
      shelf_life_days, origin_country, currency, stock_qty,
      estimated_lead_days, images, nutri_score, is_new, avg_rating, review_count
    ) VALUES (
      org_seller,
      'Kit Kat 4 doigts 41,5g x24',
      'Barre chocolatée gaufrette chocolat lait — présentoir 24 barres',
      'Gaufrette croustillante enrobée chocolat au lait. Présentoir carton 24 barres 41,5g. Idéal caisse, kiosque et distributeurs automatiques.',
      cat_epicerie, brand_nestle, '7613034626561', 'active', 24, 24, 'ambient',
      365, 'CH', 'EUR', 1200, 3,
      ARRAY['https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'],
      'E', true, 4.60, 52
    ) RETURNING id INTO p;
    INSERT INTO public.price_tiers (product_id, qty_min, unit_price)
    VALUES (p, 1, 18.90), (p, 5, 17.50), (p, 20, 16.40);
  END IF;

  RAISE NOTICE '✅ Seed terminé avec succès';
  RAISE NOTICE '   admin@stock212.test    uid=%', uid_admin;
  RAISE NOTICE '   vendeur@stock212.test  uid=%', uid_seller;
  RAISE NOTICE '   acheteur@stock212.test uid=%', uid_buyer;
  RAISE NOTICE '   livreur@stock212.test  uid=%', uid_delivery;

END $$;
