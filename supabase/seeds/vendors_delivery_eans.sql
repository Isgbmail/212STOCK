-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed : Vendeurs, Livreurs, Références EAN — Stock212
-- UUIDs vendeurs : 100000000030–034 / orgs 200000000030–034 / membres 300000000030–034
-- UUIDs livreurs : 100000000040–043 / orgs 200000000040–043 / membres 300000000040–043
-- Mot de passe : Test1234!
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOC 1 : auth.users + auth.identities
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_sso_user, deleted_at)
VALUES
  ('00000000-0000-0000-0000-100000000030','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vendeur1@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Omar Kabbaj"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000031','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vendeur2@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Salma Benali"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000032','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vendeur3@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Rachid Filali"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000033','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vendeur4@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Houda Chraibi"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000034','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vendeur5@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Youssef Amrani"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000040','00000000-0000-0000-0000-000000000000','authenticated','authenticated','livreur1@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Aziz El Fassi"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000041','00000000-0000-0000-0000-000000000000','authenticated','authenticated','livreur2@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Karim Senhaji"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000042','00000000-0000-0000-0000-000000000000','authenticated','authenticated','livreur3@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Hassan Tazi"}'::jsonb,false,false,null),
  ('00000000-0000-0000-0000-100000000043','00000000-0000-0000-0000-000000000000','authenticated','authenticated','livreur4@stock212.test',crypt('Test1234!',gen_salt('bf',10)),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Nadia Berrada"}'::jsonb,false,false,null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT u.email, u.id,
  json_build_object('sub', u.id::text, 'email', u.email)::jsonb,
  'email', now(), now()
FROM auth.users u
WHERE u.email IN (
  'vendeur1@stock212.test','vendeur2@stock212.test','vendeur3@stock212.test',
  'vendeur4@stock212.test','vendeur5@stock212.test',
  'livreur1@stock212.test','livreur2@stock212.test','livreur3@stock212.test','livreur4@stock212.test'
)
AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOC 2 : profiles, orgs, membres, profils vendeurs et livreurs
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO profiles (id, full_name, preferred_lang, preferred_currency, gdpr_consent, onboarding_done, is_admin, created_at)
VALUES
  ('00000000-0000-0000-0000-100000000030','Omar Kabbaj',    'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000031','Salma Benali',   'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000032','Rachid Filali',  'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000033','Houda Chraibi',  'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000034','Youssef Amrani', 'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000040','Aziz El Fassi',  'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000041','Karim Senhaji',  'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000042','Hassan Tazi',    'fr','MAD',true,true,false,now()),
  ('00000000-0000-0000-0000-100000000043','Nadia Berrada',  'fr','MAD',true,true,false,now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organisations (id, name, org_type, sub_type, country, address_line1, city, postal_code, region, validation_status, created_at)
VALUES
  ('00000000-0000-0000-0000-200000000030','Copag Distribution MA',    'seller','Fabricant',           'MA','12 Route de Nouaceur',              'Casablanca','20000','Casablanca-Settat',  'active',now()),
  ('00000000-0000-0000-0000-200000000031','Aïcha International SARL', 'seller','Fabricant',           'MA','35 Zone Industrielle Sidi Maarouf', 'Casablanca','20100','Casablanca-Settat',  'active',now()),
  ('00000000-0000-0000-0000-200000000032','AtlasEpice SARL',          'seller','Grossiste',           'MA','7 Avenue Mohammed V',               'Rabat',     '10000','Rabat-Salé-Kénitra', 'active',now()),
  ('00000000-0000-0000-0000-200000000033','SurgelCasablanca SARL',    'seller','Fabricant',           'MA','Zone Industrielle Ain Sebaa',        'Casablanca','20250','Casablanca-Settat',  'active',now()),
  ('00000000-0000-0000-0000-200000000034','BioProduits MA',           'seller','Coopérative',         'MA','Douar Ait Ourir',                    'Marrakech', '40000','Marrakech-Safi',     'active',now()),
  ('00000000-0000-0000-0000-200000000040','Atlas Logistique SA',      'delivery','Entreprise de logistique','MA','Parc Logistique Zenata',       'Casablanca','20220','Casablanca-Settat',  'active',now()),
  ('00000000-0000-0000-0000-200000000041','Aziz El Fassi Transport',  'delivery','Indépendant',        'MA','Hay Mohammadi Rue 12',               'Casablanca','20200','Casablanca-Settat',  'active',now()),
  ('00000000-0000-0000-0000-200000000042','FreshDeliv Maroc SARL',    'delivery','Spécialiste chaîne du froid','MA','Km 7 Route Ain Sebaa',       'Casablanca','20400','Casablanca-Settat',  'active',now()),
  ('00000000-0000-0000-0000-200000000043','SudDeliv Agadir',          'delivery','Dernier kilomètre',  'MA','Cité Founti Bloc B',                 'Agadir',    '80000','Souss-Massa',        'active',now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organisation_members (id, organisation_id, user_id, team_role, active, joined_at)
VALUES
  ('00000000-0000-0000-0000-300000000030','00000000-0000-0000-0000-200000000030','00000000-0000-0000-0000-100000000030','owner',true,now()),
  ('00000000-0000-0000-0000-300000000031','00000000-0000-0000-0000-200000000031','00000000-0000-0000-0000-100000000031','owner',true,now()),
  ('00000000-0000-0000-0000-300000000032','00000000-0000-0000-0000-200000000032','00000000-0000-0000-0000-100000000032','owner',true,now()),
  ('00000000-0000-0000-0000-300000000033','00000000-0000-0000-0000-200000000033','00000000-0000-0000-0000-100000000033','owner',true,now()),
  ('00000000-0000-0000-0000-300000000034','00000000-0000-0000-0000-200000000034','00000000-0000-0000-0000-100000000034','owner',true,now()),
  ('00000000-0000-0000-0000-300000000040','00000000-0000-0000-0000-200000000040','00000000-0000-0000-0000-100000000040','owner',true,now()),
  ('00000000-0000-0000-0000-300000000041','00000000-0000-0000-0000-200000000041','00000000-0000-0000-0000-100000000041','owner',true,now()),
  ('00000000-0000-0000-0000-300000000042','00000000-0000-0000-0000-200000000042','00000000-0000-0000-0000-100000000042','owner',true,now()),
  ('00000000-0000-0000-0000-300000000043','00000000-0000-0000-0000-200000000043','00000000-0000-0000-0000-100000000043','owner',true,now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO seller_profiles (organisation_id, certifications, accepted_payment_terms, default_prep_days, avg_rating, review_count)
VALUES
  ('00000000-0000-0000-0000-200000000030',ARRAY['ONSSA','HACCP','ISO 22000'],ARRAY['prepayment','30_days'],           2, 4.8, 42),
  ('00000000-0000-0000-0000-200000000031',ARRAY['ONSSA','Halal'],             ARRAY['prepayment','15_days'],           3, 4.6, 28),
  ('00000000-0000-0000-0000-200000000032',ARRAY['ONSSA','Bio AB'],            ARRAY['prepayment','30_days','60_days'], 4, 4.5, 19),
  ('00000000-0000-0000-0000-200000000033',ARRAY['ONSSA','Halal','HACCP'],     ARRAY['prepayment','30_days'],           2, 4.3, 11),
  ('00000000-0000-0000-0000-200000000034',ARRAY['ONSSA','Ecocert','Bio AB'],  ARRAY['prepayment'],                     5, 4.9,  7)
ON CONFLICT (organisation_id) DO NOTHING;

INSERT INTO delivery_profiles (organisation_id, delivery_type, base_rate, validation_status, avg_rating, review_count)
VALUES
  ('00000000-0000-0000-0000-200000000040','logistics_company',  8.00,'validated',4.7,156),
  ('00000000-0000-0000-0000-200000000041','independent',       12.00,'validated',4.9, 34),
  ('00000000-0000-0000-0000-200000000042','logistics_company', 10.00,'validated',4.8, 67),
  ('00000000-0000-0000-0000-200000000043','independent',        9.00,'validated',4.5, 22)
ON CONFLICT (organisation_id) DO NOTHING;

INSERT INTO delivery_capabilities (organisation_id, cold_chain, ambient, frozen, fragile, last_mile, max_weight_kg, max_volume_m3)
VALUES
  ('00000000-0000-0000-0000-200000000040',true, true, true, true, true, 5000.00,80.000),
  ('00000000-0000-0000-0000-200000000041',false,true, false,false,true,  500.00, 8.000),
  ('00000000-0000-0000-0000-200000000042',true, true, true, true, true, 2000.00,35.000),
  ('00000000-0000-0000-0000-200000000043',false,true, false,false,true,  800.00,12.000)
ON CONFLICT (organisation_id) DO NOTHING;

INSERT INTO delivery_zones (organisation_id, region, postal_codes, surcharge, lead_days_min, lead_days_max)
VALUES
  ('00000000-0000-0000-0000-200000000040','Casablanca-Settat',  ARRAY['20','21','22','26'], 0.00,1,2),
  ('00000000-0000-0000-0000-200000000040','Rabat-Salé-Kénitra', ARRAY['10','11','12','13'], 5.00,1,2),
  ('00000000-0000-0000-0000-200000000040','Marrakech-Safi',     ARRAY['40','41','46'],      8.00,2,3),
  ('00000000-0000-0000-0000-200000000040','Fès-Meknès',         ARRAY['30','31','32'],      8.00,2,3),
  ('00000000-0000-0000-0000-200000000040','Tanger-Tétouan',     ARRAY['90','91','93'],     10.00,2,4),
  ('00000000-0000-0000-0000-200000000040','Souss-Massa',        ARRAY['80','81'],          10.00,2,4),
  ('00000000-0000-0000-0000-200000000041','Casablanca-Settat',  ARRAY['20','21'],           0.00,1,1),
  ('00000000-0000-0000-0000-200000000042','Casablanca-Settat',  ARRAY['20','21','22'],      0.00,1,2),
  ('00000000-0000-0000-0000-200000000042','Rabat-Salé-Kénitra', ARRAY['10','11','12'],      5.00,1,2),
  ('00000000-0000-0000-0000-200000000043','Souss-Massa',        ARRAY['80','81'],           0.00,1,2),
  ('00000000-0000-0000-0000-200000000043','Marrakech-Safi',     ARRAY['40','41'],           5.00,2,3);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOC 3 : produits + paliers de prix (5 vendeurs)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org_v1 uuid := '00000000-0000-0000-0000-200000000030';
  org_v2 uuid := '00000000-0000-0000-0000-200000000031';
  org_v3 uuid := '00000000-0000-0000-0000-200000000032';
  org_v4 uuid := '00000000-0000-0000-0000-200000000033';
  org_v5 uuid := '00000000-0000-0000-0000-200000000034';
  cat_laitiers  uuid;
  cat_conserves uuid;
  cat_epicerie  uuid;
  cat_bouche    uuid;
  brand_copag   uuid;
  brand_aicha   uuid;
  brand_kout    uuid;
  p             uuid;
BEGIN
  SELECT id INTO cat_laitiers  FROM categories WHERE name = 'Produits laitiers'       LIMIT 1;
  SELECT id INTO cat_conserves FROM categories WHERE name = 'Conserves'               LIMIT 1;
  SELECT id INTO cat_epicerie  FROM categories WHERE name = 'Épicerie sèche'          LIMIT 1;
  SELECT id INTO cat_bouche    FROM categories WHERE name = 'Boucherie & Charcuterie' LIMIT 1;
  SELECT id INTO brand_copag   FROM brands WHERE name = 'Copag'                       LIMIT 1;
  SELECT id INTO brand_aicha   FROM brands WHERE name = 'Aïcha'                       LIMIT 1;
  SELECT id INTO brand_kout    FROM brands WHERE name = 'Koutoubia'                   LIMIT 1;

  -- ── Vendeur 1 : Copag Distribution MA — laitiers (6 produits) ────────────

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v1 AND ean='6111100010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v1,'Lait UHT entier 1L x6','Lait de vache entier stérilisé UHT — briques 1L x6',cat_laitiers,brand_copag,'6111100010001','active',6,6,'ambient',90,'MA','MAD',3600,2,ARRAY['ONSSA','HACCP'],'B',4.8,34)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,28.00),(p,20,25.50),(p,100,23.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v1 AND ean='6111100010002') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v1,'Copag Lait demi-écrémé 1L x6','Lait demi-écrémé UHT — pack 6 briques 1L',cat_laitiers,brand_copag,'6111100010002','active',6,6,'ambient',90,'MA','MAD',2400,2,ARRAY['ONSSA','HACCP'],'B',4.7,28)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,25.00),(p,20,23.00),(p,100,21.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v1 AND ean='6111100010003') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,allergens,nutri_score,avg_rating,review_count)
    VALUES (org_v1,'Copag Yaourt nature 125g x4','Yaourt nature brassé barquette 4x125g',cat_laitiers,brand_copag,'6111100010003','active',12,4,'refrigerated',21,'MA','MAD',1440,1,ARRAY['ONSSA','Halal'],ARRAY['lait'],'B',4.6,19)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,18.50),(p,24,16.50),(p,96,15.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v1 AND ean='6111100010004') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,allergens,avg_rating,review_count)
    VALUES (org_v1,'Copag Crème fraîche 20cl','Crème fraîche épaisse 30% MG — pot 20cl',cat_laitiers,brand_copag,'6111100010004','active',12,1,'refrigerated',28,'MA','MAD',960,1,ARRAY['lait'],4.5,11)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,8.90),(p,24,8.00),(p,96,7.20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v1 AND ean='6111100010005') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,allergens,avg_rating,review_count)
    VALUES (org_v1,'Copag Beurre doux 250g','Beurre pasteurisé doux plaquette 250g',cat_laitiers,brand_copag,'6111100010005','active',12,1,'refrigerated',60,'MA','MAD',720,2,ARRAY['ONSSA','HACCP'],ARRAY['lait'],4.7,22)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,22.00),(p,24,20.00),(p,96,18.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v1 AND ean='6111100010006') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,allergens,avg_rating,review_count)
    VALUES (org_v1,'Copag Fromage fondu 8 portions','Fromage fondu crémeux boîte 8 portions 120g',cat_laitiers,brand_copag,'6111100010006','active',12,8,'refrigerated',90,'MA','MAD',1800,2,ARRAY['lait'],4.4,16)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,14.50),(p,24,13.00),(p,96,11.50);
  END IF;

  -- ── Vendeur 2 : Aïcha International — conserves (5 produits) ─────────────

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v2 AND ean='6111200020001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v2,'Aïcha Confiture abricot 400g','Confiture abricots 60% fruits bocal verre 400g',cat_conserves,brand_aicha,'6111200020001','active',12,1,'ambient',1095,'MA','MAD',2880,3,ARRAY['ONSSA','Halal'],'C',4.7,31)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,16.00),(p,48,14.50),(p,240,13.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v2 AND ean='6111200020002') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,allergens,nutri_score,avg_rating,review_count)
    VALUES (org_v2,'Aïcha Sardines huile olive 125g','Sardines huile olive vierge boîte 125g',cat_conserves,brand_aicha,'6111200020002','active',24,1,'ambient',1825,'MA','MAD',3600,4,ARRAY['ONSSA','Halal','MSC'],ARRAY['poisson'],'A',4.6,43)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,9.50),(p,48,8.50),(p,240,7.80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v2 AND ean='6111200020003') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v2,'Aïcha Harissa tube 70g','Harissa piquante authentique tube aluminium 70g',cat_conserves,brand_aicha,'6111200020003','active',24,1,'ambient',730,'MA','MAD',4320,3,ARRAY['ONSSA','Halal'],4.8,67)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,5.50),(p,48,4.80),(p,240,4.20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v2 AND ean='6111200020004') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v2,'Aïcha Sauce tomate cuisinée 400g','Sauce tomate cuisinée huile olive boîte 400g',cat_conserves,brand_aicha,'6111200020004','active',12,1,'ambient',730,'MA','MAD',2160,3,ARRAY['ONSSA','Halal'],'B',4.4,22)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,8.50),(p,48,7.50),(p,240,6.80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v2 AND ean='6111200020005') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,allergens,nutri_score,avg_rating,review_count)
    VALUES (org_v2,'Aïcha Thon naturel 160g','Thon albacore au naturel sans sel boîte 160g',cat_conserves,brand_aicha,'6111200020005','active',24,1,'ambient',1095,'MA','MAD',1800,4,ARRAY['ONSSA','Halal','MSC'],ARRAY['poisson'],'A',4.5,18)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,12.00),(p,48,10.80),(p,240,9.80);
  END IF;

  -- ── Vendeur 3 : AtlasEpice — épicerie sèche (4 produits) ─────────────────

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v3 AND ean='6111200010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,nutri_score,avg_rating,review_count)
    VALUES (org_v3,'Couscous moyen 1kg','Semoule de blé dur précuite sachet 1kg',cat_epicerie,'6111200010001','active',12,1,'ambient',540,'MA','MAD',4800,3,'B',4.6,38)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,10.50),(p,60,9.50),(p,300,8.50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v3 AND ean='6111250010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v3,'Huile d''argan alimentaire 500ml','Huile argan pure pressée à froid flacon verre 500ml',cat_epicerie,'6111250010001','active',6,1,'ambient',365,'MA','MAD',480,5,ARRAY['Bio AB','Ecocert','ONSSA'],4.9,12)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,85.00),(p,12,78.00),(p,48,72.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v3 AND ean='6111240010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,avg_rating,review_count)
    VALUES (org_v3,'Ras el Hanout Supérieur 100g','Mélange épices premium sachet kraft 100g',cat_epicerie,'6111240010001','active',24,1,'ambient',365,'MA','MAD',1200,4,4.8,54)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,18.00),(p,48,16.00),(p,240,14.50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v3 AND ean='6111260010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v3,'Thé vert menthe bio 200g','Thé vert Chine menthe poivrée bio boîte métal 200g',cat_epicerie,'6111260010001','active',12,1,'ambient',730,'MA','MAD',840,5,ARRAY['Bio AB','Ecocert'],4.7,29)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,35.00),(p,24,32.00),(p,96,29.00);
  END IF;

  -- ── Vendeur 4 : SurgelCasablanca — surgelés / boucherie (4 produits) ──────

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v4 AND ean='6111300030001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v4,'Koutoubia Brochettes agneau 1kg','Brochettes agneau assaisonnées surgelées sac 1kg',cat_bouche,brand_kout,'6111300030001','active',4,1,'frozen',180,'MA','MAD',720,2,ARRAY['Halal','ONSSA'],4.5,27)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,85.00),(p,20,78.00),(p,80,72.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v4 AND ean='6111300030002') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v4,'Koutoubia Merguez bœuf 500g','Merguez pur bœuf épicées sachet 500g',cat_bouche,brand_kout,'6111300030002','active',10,1,'frozen',180,'MA','MAD',1440,2,ARRAY['Halal','ONSSA','HACCP'],4.4,33)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,42.00),(p,20,38.00),(p,80,35.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v4 AND ean='6111300030003') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v4,'Koutoubia Filets poulet 1kg','Filets poulet fermier désossés surgelés sac 1kg',cat_bouche,brand_kout,'6111300030003','active',4,1,'frozen',365,'MA','MAD',1800,2,ARRAY['Halal','ONSSA'],'A',4.7,41)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,68.00),(p,20,62.00),(p,80,57.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v4 AND ean='6111300030004') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,brand_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,allergens,avg_rating,review_count)
    VALUES (org_v4,'Koutoubia Pastilla poulet 400g','Pastilla poulet marocaine surgelée 400g',cat_bouche,brand_kout,'6111300030004','active',6,1,'frozen',180,'MA','MAD',540,3,ARRAY['Halal','ONSSA'],ARRAY['gluten','oeufs','lait'],4.8,15)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,55.00),(p,12,50.00),(p,48,46.00);
  END IF;

  -- ── Vendeur 5 : BioProduits MA — épicerie bio / fine (5 produits) ─────────

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v5 AND ean='6111270010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v5,'Miel Atlas pur 500g','Miel toutes fleurs Atlas non pasteurisé pot verre 500g',cat_epicerie,'6111270010001','active',6,1,'ambient',730,'MA','MAD',360,5,ARRAY['Bio AB','Ecocert','ONSSA'],4.9,23)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,65.00),(p,12,60.00),(p,48,55.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v5 AND ean='6111280010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v5,'Huile olive BIO extra vierge 500ml','Huile olive AOC Tyout première pression bouteille verre 500ml',cat_epicerie,'6111280010001','active',6,1,'ambient',540,'MA','MAD',480,4,ARRAY['Bio AB','Ecocert','ONSSA'],'A',4.8,19)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,72.00),(p,12,66.00),(p,48,60.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v5 AND ean='6111290010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v5,'Amandes grillées salées 250g','Amandes Marrakech grillées légèrement salées sachet kraft 250g',cat_epicerie,'6111290010001','active',12,1,'ambient',180,'MA','MAD',720,4,ARRAY['Bio AB','Ecocert'],4.7,14)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,38.00),(p,24,35.00),(p,96,32.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v5 AND ean='6111300010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,nutri_score,avg_rating,review_count)
    VALUES (org_v5,'Dattes Medjool 500g','Dattes Medjool premium Zagora boîte bois 500g',cat_epicerie,'6111300010001','active',6,1,'ambient',180,'MA','MAD',540,5,ARRAY['Bio AB','Halal','ONSSA'],'C',4.9,31)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,58.00),(p,12,54.00),(p,48,50.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE seller_org_id=org_v5 AND ean='6111310010001') THEN
    INSERT INTO products (seller_org_id,name,short_description,category_id,ean,status,moq,pack_size,temperature,shelf_life_days,origin_country,currency,stock_qty,estimated_lead_days,certifications,avg_rating,review_count)
    VALUES (org_v5,'Safran pur filaments 2g','Safran Maroc filaments premium boîte métal 2g',cat_epicerie,'6111310010001','active',6,1,'ambient',730,'MA','MAD',240,6,ARRAY['ONSSA'],4.9,8)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id,qty_min,unit_price) VALUES (p,1,95.00),(p,12,88.00),(p,48,82.00);
  END IF;

END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOC 4 : références EAN plateforme (30 lignes)
-- Certaines correspondent à des produits vendus, d'autres sont plateforme only
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  cat_boissons  uuid; cat_epicerie  uuid; cat_laitiers  uuid;
  cat_conserves uuid; cat_hygiene   uuid; cat_bouche    uuid;
  cat_entretien uuid;
  brand_copag   uuid; brand_aicha   uuid; brand_kout    uuid;
BEGIN
  SELECT id INTO cat_boissons  FROM categories WHERE name = 'Boissons'                LIMIT 1;
  SELECT id INTO cat_epicerie  FROM categories WHERE name = 'Épicerie sèche'          LIMIT 1;
  SELECT id INTO cat_laitiers  FROM categories WHERE name = 'Produits laitiers'       LIMIT 1;
  SELECT id INTO cat_conserves FROM categories WHERE name = 'Conserves'               LIMIT 1;
  SELECT id INTO cat_hygiene   FROM categories WHERE name = 'Hygiène'                 LIMIT 1;
  SELECT id INTO cat_bouche    FROM categories WHERE name = 'Boucherie & Charcuterie' LIMIT 1;
  SELECT id INTO cat_entretien FROM categories WHERE name = 'Entretien'               LIMIT 1;
  SELECT id INTO brand_copag   FROM brands WHERE name = 'Copag'                       LIMIT 1;
  SELECT id INTO brand_aicha   FROM brands WHERE name = 'Aïcha'                       LIMIT 1;
  SELECT id INTO brand_kout    FROM brands WHERE name = 'Koutoubia'                   LIMIT 1;

  INSERT INTO ean_references
    (ean, name, short_description, category_id, brand_id, temperature,
     net_weight, weight_unit, certifications, allergens, nutri_score,
     pack_size, shelf_life_days, origin_country, manufacturer_name, status, source)
  VALUES
    -- ── Laitiers Copag (7 — dont 1 non encore listé) ──────────────────────
    ('6111100010001','Copag Lait UHT entier 1L','Lait de vache entier UHT 1L',cat_laitiers,brand_copag,'ambient',1000,'g',ARRAY['ONSSA','HACCP'],ARRAY['lait'],'B',1,90,'MA','Copag SA','active','platform'),
    ('6111100010002','Copag Lait demi-écrémé 1L','Lait demi-écrémé UHT 1L',cat_laitiers,brand_copag,'ambient',1000,'g',ARRAY['ONSSA','HACCP'],ARRAY['lait'],'B',1,90,'MA','Copag SA','active','platform'),
    ('6111100010003','Copag Yaourt nature x4','Yaourt nature brassé barquette 4x125g',cat_laitiers,brand_copag,'refrigerated',500,'g',ARRAY['ONSSA','Halal'],ARRAY['lait'],'B',4,21,'MA','Copag SA','active','platform'),
    ('6111100010004','Copag Crème fraîche 20cl','Crème fraîche épaisse 30% MG 20cl',cat_laitiers,brand_copag,'refrigerated',200,'g',ARRAY['ONSSA'],ARRAY['lait'],NULL,1,28,'MA','Copag SA','active','platform'),
    ('6111100010005','Copag Beurre doux 250g','Beurre pasteurisé doux 250g',cat_laitiers,brand_copag,'refrigerated',250,'g',ARRAY['ONSSA','HACCP'],ARRAY['lait'],NULL,1,60,'MA','Copag SA','active','platform'),
    ('6111100010006','Copag Fromage fondu 8 portions','Fromage fondu crémeux boîte 8 portions 120g',cat_laitiers,brand_copag,'refrigerated',120,'g',ARRAY['ONSSA'],ARRAY['lait'],NULL,8,90,'MA','Copag SA','active','platform'),
    ('6111100020001','Copag Raïb nature 250ml','Lait fermenté nature raïb marocain 250ml',cat_laitiers,brand_copag,'refrigerated',250,'g',ARRAY['ONSSA','Halal'],ARRAY['lait'],'B',1,14,'MA','Copag SA','active','platform'),
    -- ── Conserves Aïcha (7 — dont 2 non encore listés) ───────────────────
    ('6111200020001','Aïcha Confiture abricot 400g','Confiture abricots 60% fruits bocal 400g',cat_conserves,brand_aicha,'ambient',400,'g',ARRAY['ONSSA','Halal'],ARRAY[]::text[],'C',1,1095,'MA','Société Aicha','active','platform'),
    ('6111200020002','Aïcha Sardines huile olive 125g','Sardines huile olive vierge boîte 125g',cat_conserves,brand_aicha,'ambient',125,'g',ARRAY['ONSSA','Halal','MSC'],ARRAY['poisson'],'A',1,1825,'MA','Société Aicha','active','platform'),
    ('6111200020003','Aïcha Harissa tube 70g','Harissa piquante authentique tube aluminium 70g',cat_conserves,brand_aicha,'ambient',70,'g',ARRAY['ONSSA','Halal'],ARRAY[]::text[],NULL,1,730,'MA','Société Aicha','active','platform'),
    ('6111200020004','Aïcha Sauce tomate 400g','Sauce tomate cuisinée huile olive boîte 400g',cat_conserves,brand_aicha,'ambient',400,'g',ARRAY['ONSSA','Halal'],ARRAY[]::text[],'B',1,730,'MA','Société Aicha','active','platform'),
    ('6111200020005','Aïcha Thon naturel 160g','Thon albacore au naturel sans sel boîte 160g',cat_conserves,brand_aicha,'ambient',160,'g',ARRAY['ONSSA','Halal','MSC'],ARRAY['poisson'],'A',1,1095,'MA','Société Aicha','active','platform'),
    ('6111200020010','Aïcha Confiture fraise 400g','Confiture fraises 60% fruits bocal 400g',cat_conserves,brand_aicha,'ambient',400,'g',ARRAY['ONSSA','Halal'],ARRAY[]::text[],'C',1,1095,'MA','Société Aicha','active','platform'),
    ('6111200020011','Aïcha Pâte d''amande 200g','Pâte d''amande Aïcha pot verre 200g',cat_conserves,brand_aicha,'ambient',200,'g',ARRAY['ONSSA','Halal'],ARRAY['fruits à coque'],NULL,1,365,'MA','Société Aicha','active','platform'),
    -- ── Viandes Koutoubia (5 — dont 1 non encore listé) ──────────────────
    ('6111300030001','Koutoubia Brochettes agneau 1kg','Brochettes agneau assaisonnées surgelées 1kg',cat_bouche,brand_kout,'frozen',1000,'g',ARRAY['Halal','ONSSA'],ARRAY['viande agneau'],NULL,1,180,'MA','Koutoubia Group','active','platform'),
    ('6111300030002','Koutoubia Merguez bœuf 500g','Merguez pur bœuf épicées 500g',cat_bouche,brand_kout,'frozen',500,'g',ARRAY['Halal','ONSSA','HACCP'],ARRAY['viande bœuf'],NULL,1,180,'MA','Koutoubia Group','active','platform'),
    ('6111300030003','Koutoubia Filets poulet 1kg','Filets poulet désossés surgelés sac 1kg',cat_bouche,brand_kout,'frozen',1000,'g',ARRAY['Halal','ONSSA'],ARRAY[]::text[],'A',1,365,'MA','Koutoubia Group','active','platform'),
    ('6111300030004','Koutoubia Pastilla poulet 400g','Pastilla poulet marocaine surgelée 400g',cat_bouche,brand_kout,'frozen',400,'g',ARRAY['Halal','ONSSA'],ARRAY['gluten','oeufs','lait'],NULL,1,180,'MA','Koutoubia Group','active','platform'),
    ('6111300030010','Koutoubia Kefta bœuf 500g','Kefta pur bœuf assaisonnée surgelée 500g',cat_bouche,brand_kout,'frozen',500,'g',ARRAY['Halal','ONSSA'],ARRAY['viande bœuf'],NULL,1,180,'MA','Koutoubia Group','active','platform'),
    -- ── Boissons génériques (4) ───────────────────────────────────────────
    ('6111230010001','Eau Sidi Ali 1,5L','Eau minérale naturelle peu minéralisée bouteille PET 1,5L',cat_boissons,NULL,'ambient',1500,'g',ARRAY[]::text[],ARRAY[]::text[],NULL,1,730,'MA','Sidi Ali SA','active','platform'),
    ('6111230010002','Eau Sidi Harazem 1,5L','Eau minérale riche en minéraux bouteille 1,5L',cat_boissons,NULL,'ambient',1500,'g',ARRAY[]::text[],ARRAY[]::text[],NULL,1,730,'MA','Sidi Harazem SA','active','platform'),
    ('6111230010003','Jus orange Pom''s 1L','Jus orange 100% pur jus briquette 1L',cat_boissons,NULL,'ambient',1000,'g',ARRAY['ONSSA'],ARRAY[]::text[],'B',1,365,'MA','Pom''s Maroc','active','platform'),
    ('6111230010004','Café arabica torréfié 500g','Café arabica pur torréfié moulu sachet 500g',cat_boissons,NULL,'ambient',500,'g',ARRAY['ONSSA'],ARRAY[]::text[],NULL,1,730,'MA','Lyoness Café Maroc','active','platform'),
    -- ── Épicerie sèche génériques (4) ────────────────────────────────────
    ('6111210010001','Huile de tournesol 1L','Huile végétale tournesol pure bouteille PET 1L',cat_epicerie,NULL,'ambient',1000,'g',ARRAY['ONSSA'],ARRAY[]::text[],NULL,1,730,'MA','Lesieur Cristal MA','active','platform'),
    ('6111210010002','Sucre cristallisé 1kg','Sucre cristallisé blanc sachet 1kg',cat_epicerie,NULL,'ambient',1000,'g',ARRAY['ONSSA'],ARRAY[]::text[],NULL,1,730,'MA','Cosumar','active','platform'),
    ('6111210010003','Farine blé T55 1kg','Farine blé tendre T55 tous usages sachet 1kg',cat_epicerie,NULL,'ambient',1000,'g',ARRAY['ONSSA'],ARRAY['gluten'],NULL,1,365,'MA','Les Moulins du Maroc','active','platform'),
    ('6111210010004','Riz basmati 1kg','Riz basmati grain long vieilli 24 mois sachet 1kg',cat_epicerie,NULL,'ambient',1000,'g',ARRAY['ONSSA'],ARRAY[]::text[],'B',1,730,'IN','Sonacos Import MA','active','platform'),
    -- ── Hygiène (2) ───────────────────────────────────────────────────────
    ('6111410010001','Savon olive Nabulsi 100g','Savon naturel huile olive Nabulsi 100g',cat_hygiene,NULL,'ambient',100,'g',ARRAY[]::text[],ARRAY[]::text[],NULL,1,1095,'PS',NULL,'active','platform'),
    ('6111410010002','Shampooing argan 250ml','Shampooing huile argan cheveux normaux 250ml',cat_hygiene,NULL,'ambient',250,'g',ARRAY['ONSSA'],ARRAY[]::text[],NULL,1,730,'MA','Bionatural MA','active','platform'),
    -- ── Entretien (2) ─────────────────────────────────────────────────────
    ('6111510010001','Lessive liquide concentrée 3L','Lessive liquide concentrée toutes machines bidon 3L',cat_entretien,NULL,'ambient',3000,'g',ARRAY[]::text[],ARRAY[]::text[],NULL,1,730,'MA','Unilever Maroc','active','platform'),
    ('6111510010002','Eau de Javel 36° 2L','Eau de Javel désinfectante 36° bidon 2L',cat_entretien,NULL,'ambient',2000,'g',ARRAY[]::text[],ARRAY[]::text[],NULL,1,365,'MA','Henkel Maroc','active','platform')
  ON CONFLICT (ean) DO NOTHING;

END $$;
