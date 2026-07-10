/**
 * Stock212 — Seed de données de test
 *
 * Crée 4 comptes utilisateurs, 3 organisations et 12 produits réalistes.
 *
 * Prérequis :
 *   1. Renseigner SUPABASE_SERVICE_ROLE_KEY dans .env
 *      (Dashboard → Settings → API → service_role key)
 *   2. node scripts/seed-test-data.mjs
 *
 * Le script est idempotent : relancer ne duplique rien.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Chargement .env ──────────────────────────────────────────────────────────

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(__dir, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx === -1) continue;
      env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

const env        = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL  || 'https://nismelnynlubpegxgpnr.supabase.co';
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];
const PROJECT_REF  = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!SERVICE_KEY) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY manquante dans .env\n');
  console.error('   Récupérez-la sur :');
  console.error(`   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api\n`);
  process.exit(1);
}

// ─── Comptes de test ──────────────────────────────────────────────────────────

const TEST_ACCOUNTS = [
  { email: 'admin@stock212.test',    password: 'Test1234!', full_name: 'Admin Platform',  role: 'admin'    },
  { email: 'vendeur@stock212.test',  password: 'Test1234!', full_name: 'Karim Benali',    role: 'seller'   },
  { email: 'acheteur@stock212.test', password: 'Test1234!', full_name: 'Sophie Martin',   role: 'buyer'    },
  { email: 'livreur@stock212.test',  password: 'Test1234!', full_name: 'Mehdi Rousseau',  role: 'delivery' },
];

// ─── Auth Admin API ───────────────────────────────────────────────────────────

async function listUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  const data = await res.json();
  return data.users ?? [];
}

async function createOrGetUser(email, password, full_name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
  });
  const data = await res.json();
  if (res.ok) return { id: data.id, created: true };

  // Utilisateur déjà existant → retrouver son ID
  if (res.status === 422 || JSON.stringify(data).includes('already')) {
    const all = await listUsers();
    const found = all.find(u => u.email === email);
    if (found) return { id: found.id, created: false };
  }
  throw new Error(`Impossible de créer ${email}: ${JSON.stringify(data)}`);
}

// ─── Management API (SQL) ─────────────────────────────────────────────────────

async function runSQL(sql, label) {
  process.stdout.write(`  → ${label} ... `);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.ok) { console.log('✅'); return true; }
  if (text.includes('already exists') || text.includes('23505')) { console.log('✅ déjà présent'); return true; }
  console.log(`❌ (${res.status})`);
  console.error('  ', text.slice(0, 500));
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n🚀  Stock212 — Seed de données de test\n');

// ── Étape 1 : Comptes Auth ────────────────────────────────────────────────────
console.log('📧  Création des comptes utilisateurs...');
const users = {};
for (const a of TEST_ACCOUNTS) {
  process.stdout.write(`  → ${a.email} ... `);
  try {
    const r = await createOrGetUser(a.email, a.password, a.full_name);
    users[a.role] = r.id;
    console.log(r.created ? `✅ créé  [${r.id}]` : `✅ existant  [${r.id}]`);
  } catch (err) {
    console.log('❌');
    console.error('  ', err.message);
    process.exit(1);
  }
}

// ── Étape 2 : Organisations + membres + profils ───────────────────────────────
console.log('\n🏗️   Organisations, membres et profils...');

await runSQL(`
DO $$
DECLARE
  seller_id   uuid;
  buyer_id    uuid;
  delivery_id uuid;
BEGIN

  -- ── Org vendeur ────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE name = 'MaghrebImport SARL') THEN
    INSERT INTO organisations (name, org_type, sub_type, country, city, postal_code, validation_status)
    VALUES ('MaghrebImport SARL', 'seller', 'Distributeur', 'FR', 'Paris', '75010', 'active');
  END IF;
  SELECT id INTO seller_id FROM organisations WHERE name = 'MaghrebImport SARL' LIMIT 1;

  -- ── Org acheteur ───────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE name = 'Épicerie du Marché SARL') THEN
    INSERT INTO organisations (name, org_type, sub_type, country, city, postal_code, validation_status)
    VALUES ('Épicerie du Marché SARL', 'buyer', 'Épicerie', 'FR', 'Lyon', '69001', 'active');
  END IF;
  SELECT id INTO buyer_id FROM organisations WHERE name = 'Épicerie du Marché SARL' LIMIT 1;

  -- ── Org livreur ────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE name = 'TransFresh Express') THEN
    INSERT INTO organisations (name, org_type, sub_type, country, city, postal_code, validation_status)
    VALUES ('TransFresh Express', 'delivery', 'Entreprise de logistique', 'FR', 'Marseille', '13001', 'active');
  END IF;
  SELECT id INTO delivery_id FROM organisations WHERE name = 'TransFresh Express' LIMIT 1;

  -- ── Profils métier ─────────────────────────────────────────────────────────
  INSERT INTO seller_profiles (organisation_id, certifications, accepted_payment_terms, default_prep_days)
  VALUES (seller_id, ARRAY['ISO 22000','Bio AB'], ARRAY['prepayment','30_days'], 2)
  ON CONFLICT DO NOTHING;

  INSERT INTO buyer_profiles (organisation_id, default_payment_terms, credit_limit)
  VALUES (buyer_id, '30_days', 15000.00)
  ON CONFLICT DO NOTHING;

  INSERT INTO delivery_profiles (organisation_id, delivery_type, base_rate, validation_status)
  VALUES (delivery_id, 'logistics_company', 4.50, 'validated')
  ON CONFLICT DO NOTHING;

  INSERT INTO delivery_capabilities (organisation_id, cold_chain, ambient, frozen, last_mile, max_weight_kg, max_volume_m3)
  VALUES (delivery_id, true, true, true, true, 2000.00, 40.000)
  ON CONFLICT DO NOTHING;

  INSERT INTO delivery_zones (organisation_id, region, postal_codes, lead_days_min, lead_days_max)
  VALUES
    (delivery_id, 'Île-de-France',   ARRAY['75','92','93','94','95','77','78','91'], 1, 2),
    (delivery_id, 'Provence-Alpes-Côte d''Azur', ARRAY['13','83','84','06','04','05'], 2, 3)
  ON CONFLICT DO NOTHING;

  -- ── Membres ────────────────────────────────────────────────────────────────
  INSERT INTO organisation_members (organisation_id, user_id, team_role)
  VALUES (seller_id,   '${users.seller}',   'owner') ON CONFLICT DO NOTHING;

  INSERT INTO organisation_members (organisation_id, user_id, team_role)
  VALUES (buyer_id,    '${users.buyer}',    'owner') ON CONFLICT DO NOTHING;

  INSERT INTO organisation_members (organisation_id, user_id, team_role)
  VALUES (delivery_id, '${users.delivery}', 'owner') ON CONFLICT DO NOTHING;

  -- ── Profils utilisateurs (onboarding marqué done) ─────────────────────────
  INSERT INTO profiles (id, full_name, onboarding_done)
  VALUES ('${users.seller}',   'Karim Benali',    true)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, onboarding_done = true;

  INSERT INTO profiles (id, full_name, onboarding_done)
  VALUES ('${users.buyer}',    'Sophie Martin',   true)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, onboarding_done = true;

  INSERT INTO profiles (id, full_name, onboarding_done)
  VALUES ('${users.delivery}', 'Mehdi Rousseau',  true)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, onboarding_done = true;

  INSERT INTO profiles (id, full_name, onboarding_done, is_admin)
  VALUES ('${users.admin}',    'Admin Platform',  true, true)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, onboarding_done = true, is_admin = true;

END $$;
`, 'Organisations + membres + profils');

// ── Étape 3 : Produits ────────────────────────────────────────────────────────
console.log('\n📦  Insertion des produits...');

await runSQL(`
DO $$
DECLARE
  seller_id      uuid;
  cat_boissons   uuid;
  cat_epicerie   uuid;
  cat_laitiers   uuid;
  cat_bouche     uuid;
  cat_surgeles   uuid;
  cat_conserves  uuid;
  cat_hygiene    uuid;
  brand_nestle    uuid;
  brand_danone    uuid;
  brand_cocacola  uuid;
  brand_bonduelle uuid;
  brand_mccain    uuid;
  brand_heinz     uuid;
  brand_president uuid;
  p uuid;
BEGIN

  SELECT id INTO seller_id     FROM organisations WHERE name = 'MaghrebImport SARL' LIMIT 1;
  SELECT id INTO cat_boissons  FROM categories WHERE name = 'Boissons'              LIMIT 1;
  SELECT id INTO cat_epicerie  FROM categories WHERE name = 'Épicerie sèche'        LIMIT 1;
  SELECT id INTO cat_laitiers  FROM categories WHERE name = 'Produits laitiers'     LIMIT 1;
  SELECT id INTO cat_bouche    FROM categories WHERE name = 'Boucherie & Charcuterie' LIMIT 1;
  SELECT id INTO cat_surgeles  FROM categories WHERE name = 'Surgelés'              LIMIT 1;
  SELECT id INTO cat_conserves FROM categories WHERE name = 'Conserves'             LIMIT 1;
  SELECT id INTO cat_hygiene   FROM categories WHERE name = 'Hygiène'               LIMIT 1;
  SELECT id INTO brand_nestle    FROM brands WHERE name = 'Nestlé'     LIMIT 1;
  SELECT id INTO brand_danone    FROM brands WHERE name = 'Danone'     LIMIT 1;
  SELECT id INTO brand_cocacola  FROM brands WHERE name = 'Coca-Cola'  LIMIT 1;
  SELECT id INTO brand_bonduelle FROM brands WHERE name = 'Bonduelle'  LIMIT 1;
  SELECT id INTO brand_mccain    FROM brands WHERE name = 'McCain'     LIMIT 1;
  SELECT id INTO brand_heinz     FROM brands WHERE name = 'Heinz'      LIMIT 1;
  SELECT id INTO brand_president FROM brands WHERE name = 'Président'  LIMIT 1;

  -- ── 1 · Eau minérale 1,5L x6 ─────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Eau minérale naturelle plate 1,5L x6' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Eau minérale naturelle plate 1,5L x6',
      'Eau minérale naturelle de source, pack de 6 bouteilles PET 1,5L',
      'Captée à la source de Vals-les-Bains (Ardèche), cette eau minérale naturelle se distingue par sa faible minéralisation (résidu sec 170 mg/L). Idéale pour la restauration, les hôtels et la distribution alimentaire.',
      cat_boissons, '3760091725018', 'active', 6, 6, 'ambient', 730,
      'FR', 'EUR', 2400, 3,
      ARRAY['https://images.pexels.com/photos/1346155/pexels-photo-1346155.jpeg'],
      'A', 4.50, 12)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1,   2.40), (p, 50,  2.10), (p, 200, 1.90);
  END IF;

  -- ── 2 · Coca-Cola 33cl x24 ───────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Coca-Cola Original 33cl x24' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      is_on_promotion, nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Coca-Cola Original 33cl x24',
      'Boisson gazeuse sucrée — pack de 24 canettes aluminium 33cl',
      'La référence incontournable des boissons sucrées gazeuses. Format canette 33cl, pack de 24 unités. Conditionnement carton filmé, adapté au stockage en entrepôt et à la revente en GMS et CHR.',
      cat_boissons, brand_cocacola, '5449000000996', 'active', 24, 24, 'ambient', 365,
      'BE', 'EUR', 800, 2,
      ARRAY['https://images.pexels.com/photos/50593/coca-cola-cold-drink-soft-drink-coke-50593.jpeg'],
      true, 'E', 4.20, 35)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 12.90), (p, 10, 11.50), (p, 50, 10.80);
  END IF;

  -- ── 3 · Lait UHT demi-écrémé 1L x6 ──────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lait UHT demi-écrémé 1L x6' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      certifications, nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Lait UHT demi-écrémé 1L x6',
      'Lait de vache demi-écrémé stérilisé UHT — pack de 6 briques 1L',
      'Lait collecté dans les Hauts-de-France, traité UHT pour une conservation longue durée (3 mois). Brique en carton recyclable. Conditionnement par 6, idéal pour épiceries, cafés et restauration collective.',
      cat_laitiers, brand_president, '3450630014346', 'active', 6, 6, 'ambient', 90,
      'FR', 'EUR', 1500, 2,
      ARRAY['https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'],
      ARRAY['Label Rouge'], 'B', 4.70, 28)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 5.40), (p, 20, 4.95), (p, 100, 4.60);
  END IF;

  -- ── 4 · Couscous moyen 1kg ────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Couscous moyen semoule fine 1kg' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Couscous moyen semoule fine 1kg',
      'Semoule de blé dur précuite — grain moyen, prêt en 5 minutes',
      'Semoule de blé dur de qualité supérieure, précuite à la vapeur et séchée. Grain moyen idéal pour plats traditionnels, salades et buffets. Sachet sous vide 1kg, carton de 12 unités.',
      cat_epicerie, '3760012390271', 'active', 12, 12, 'ambient', 540,
      'DZ', 'EUR', 3600, 4,
      ARRAY['https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'],
      'B', 4.80, 41)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 1.95), (p, 60, 1.70), (p, 300, 1.50);
  END IF;

  -- ── 5 · Sardines à l'huile d'olive 125g ──────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sardines entières à l''huile d''olive 125g' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      certifications, nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Sardines entières à l''huile d''olive 125g',
      'Sardines de l''Atlantique à l''huile d''olive vierge extra, boîte 125g',
      'Sardines pêchées dans l''Atlantique Nord-Est, cuisinées à l''huile d''olive vierge extra. Conserve 5 ans, boîte métal facile à ouvrir. Certification MSC pêche durable. Format CHR et épicerie fine.',
      cat_conserves, '3419680020127', 'active', 24, 24, 'ambient', 1825,
      'MA', 'EUR', 2880, 5,
      ARRAY['https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'],
      ARRAY['MSC','Pêche Durable'], 'A', 4.60, 19)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 1.85), (p, 48, 1.60), (p, 240, 1.40);
  END IF;

  -- ── 6 · Tomates concassées BIO 400g ──────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tomates concassées BIO 400g' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      certifications, nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Tomates concassées BIO 400g',
      'Tomates pelées et concassées, agriculture biologique certifiée, boîte 400g',
      'Tomates de variété Roma cultivées en Italie du Sud sans pesticides, pelées et concassées en conserve. Idéales pour pizzas, sauces et plats mijotés. Certifiées Bio AB et Ecocert.',
      cat_conserves, brand_bonduelle, '3083680007756', 'active', 12, 12, 'ambient', 1095,
      'IT', 'EUR', 1440, 3,
      ARRAY['https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'],
      ARRAY['Bio AB','Ecocert'], 'A', 4.40, 22)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 0.95), (p, 60, 0.82), (p, 300, 0.75);
  END IF;

  -- ── 7 · Frites surgelées 2,5kg ────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Frites classiques surgelées 2,5kg' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      certifications, avg_rating, review_count)
    VALUES (seller_id,
      'Frites classiques surgelées 2,5kg',
      'Frites allumettes surgelées 2,5kg — cuisson four ou friture, format restauration',
      'Pommes de terre Bintje d''origine belge, calibre 10/10mm, blanchies et surgelées à -40°C. Format sac 2,5kg, carton de 4. Idéales pour la restauration rapide, les brasseries et la restauration collective.',
      cat_surgeles, brand_mccain, '5410228023050', 'active', 4, 4, 'frozen', 540,
      'BE', 'EUR', 400, 2,
      ARRAY['https://images.pexels.com/photos/3736173/pexels-photo-3736173.jpeg'],
      ARRAY['Qualité Restauration'], 4.30, 17)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 6.50), (p, 20, 5.90), (p, 80, 5.40);
  END IF;

  -- ── 8 · Yaourt nature brassé x4 ──────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Yaourt nature brassé pot verre 125g x4' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Yaourt nature brassé pot verre 125g x4',
      'Yaourt brassé au lait entier, pot en verre consigné — barquette de 4 x 125g',
      'Yaourt au lait entier fermenté avec des ferments vivants sélectionnés. Pot en verre 125g consigné (0,05€/pot). Texture crémeuse et onctueuse. DLC 21 jours. Barquette de 4 pots.',
      cat_laitiers, brand_danone, '3033710065097', 'active', 12, 4, 'refrigerated', 21,
      'FR', 'EUR', 960, 1,
      ARRAY['https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'],
      'B', 4.55, 14)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 2.15), (p, 24, 1.95), (p, 96, 1.78);
  END IF;

  -- ── 9 · Ketchup Heinz 1kg squeeze ────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ketchup Heinz 1kg squeeze' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Ketchup Heinz 1kg squeeze',
      'Ketchup tomate classique flacon souple 1kg — format restauration',
      'Ketchup à la tomate Heinz, recette originale sans colorants ni conservateurs artificiels. Flacon squeeze souple 1kg avec bouchon auto-fermant. Format idéal cafés, restaurants et cantines.',
      cat_epicerie, brand_heinz, '0013000004602', 'active', 6, 6, 'ambient', 730,
      'NL', 'EUR', 720, 3,
      ARRAY['https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'],
      'D', 4.25, 31)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 4.20), (p, 24, 3.80), (p, 120, 3.45);
  END IF;

  -- ── 10 · Filets de poulet fermier Label Rouge 1kg ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Filets de poulet fermier Label Rouge 1kg' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      certifications, nutri_score, avg_rating, review_count)
    VALUES (seller_id,
      'Filets de poulet fermier Label Rouge 1kg',
      'Filets de poulet fermier français élevé en plein air — sous vide 1kg',
      'Poulet fermier Label Rouge élevé en plein air pendant 81 jours minimum, nourri aux céréales françaises. Filets parés, conditionnés sous vide. DLC 7 jours. Idéal restauration et boucherie.',
      cat_bouche, '3250390027504', 'active', 5, 1, 'refrigerated', 7,
      'FR', 'EUR', 200, 1,
      ARRAY['https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg'],
      ARRAY['Label Rouge','Plein Air'], 'A', 4.75, 9)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 8.90), (p, 20, 7.95), (p, 50, 7.40);
  END IF;

  -- ── 11 · Savon liquide mains recharge 5L ─────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Savon liquide mains recharge 5L' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      avg_rating, review_count, is_new)
    VALUES (seller_id,
      'Savon liquide mains recharge 5L',
      'Savon doux parfumé fleur de coton — bidon 5L recharge distributeur',
      'Savon doux pH neutre formulé pour les mains sensibles. Parfum fleur de coton. Bidon 5L avec robinet verseur, compatible tous distributeurs standard. Biodégradable à 95%. Idéal hôtellerie, restauration, bureaux.',
      cat_hygiene, '3574660207361', 'active', 4, 1, 'ambient', 1095,
      'FR', 'EUR', 500, 3,
      ARRAY['https://images.pexels.com/photos/3952232/pexels-photo-3952232.jpeg'],
      4.35, 7, true)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 8.50), (p, 10, 7.80), (p, 40, 7.20);
  END IF;

  -- ── 12 · Kit Kat 4 doigts x24 ────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kit Kat 4 doigts 41,5g x24' AND seller_org_id = seller_id) THEN
    INSERT INTO products (seller_org_id, name, short_description, long_description,
      category_id, brand_id, ean, status, moq, pack_size, temperature, shelf_life_days,
      origin_country, currency, stock_qty, estimated_lead_days, images,
      nutri_score, is_new, avg_rating, review_count)
    VALUES (seller_id,
      'Kit Kat 4 doigts 41,5g x24',
      'Barre chocolatée gaufrette au chocolat lait — présentoir de 24 barres',
      'Kit Kat 4 doigts, gaufrette croustillante enrobée de chocolat au lait. Présentoir carton de 24 barres individuelles 41,5g. Idéal pour la revente en caisse, kiosque, snacking et distributeurs automatiques.',
      cat_epicerie, brand_nestle, '7613034626561', 'active', 24, 24, 'ambient', 365,
      'CH', 'EUR', 1200, 3,
      ARRAY['https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'],
      'E', true, 4.60, 52)
    RETURNING id INTO p;
    INSERT INTO price_tiers (product_id, qty_min, unit_price) VALUES
      (p, 1, 18.90), (p, 5, 17.50), (p, 20, 16.40);
  END IF;

END $$;
`, '12 produits + paliers de prix');

// ── Récapitulatif ─────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + '─'.repeat(70));
console.log('✅  Seed terminé avec succès !\n');
console.log('  Comptes disponibles (mot de passe : Test1234!)\n');
console.log(`  ${pad('Email', 30)} ${pad('Rôle', 14)} Organisation`);
console.log(`  ${pad('─'.repeat(28), 30)} ${pad('─'.repeat(12), 14)} ───────────────────────`);
console.log(`  ${pad('admin@stock212.test', 30)} ${pad('Admin', 14)} (accès plateforme complet)`);
console.log(`  ${pad('vendeur@stock212.test', 30)} ${pad('Vendeur', 14)} MaghrebImport SARL`);
console.log(`  ${pad('acheteur@stock212.test', 30)} ${pad('Acheteur', 14)} Épicerie du Marché SARL`);
console.log(`  ${pad('livreur@stock212.test', 30)} ${pad('Livreur', 14)} TransFresh Express`);
console.log('\n  12 produits actifs créés sous MaghrebImport SARL');
console.log(`\n  Dashboard Supabase :`);
console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/editor\n`);
