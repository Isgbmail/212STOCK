/**
 * Apply pending Supabase migrations (admin_flag + storage bucket).
 *
 * 1. Add your service_role key to .env:
 *    SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *    (found at https://supabase.com/dashboard/project/nismelnynlubpegxgpnr/settings/api)
 *
 * 2. Run: node scripts/apply-migrations.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Parse .env manually (no dotenv dependency needed)
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(__dir, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch {}
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://nismelnynlubpegxgpnr.supabase.co';
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!SERVICE_KEY) {
  console.error('\n❌  Service role key manquante.\n');
  console.error('   Ajoutez dans .env :');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ...\n');
  console.error('   Clé disponible sur :');
  console.error('   https://supabase.com/dashboard/project/nismelnynlubpegxgpnr/settings/api\n');
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

async function runSQL(sql, label) {
  process.stdout.write(`  → ${label} ... `);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log('✅ OK');
    return true;
  }

  const body = await res.text();
  // 42701 = column already exists, 42710 = policy already exists — both are fine
  if (body.includes('42701') || body.includes('42710') || body.includes('already exists')) {
    console.log('✅ déjà appliqué');
    return true;
  }

  console.log(`❌ ERREUR (${res.status})`);
  console.error('   ', body.slice(0, 300));
  return false;
}

console.log('\n🚀 Application des migrations Stock212\n');

await runSQL(
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;`,
  'Migration 012 — colonne is_admin sur profiles'
);

await runSQL(
  `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES ('product-images', 'product-images', true, 5242880,
     ARRAY['image/jpeg','image/png','image/webp','image/gif'])
   ON CONFLICT (id) DO NOTHING;`,
  'Migration 013 — bucket product-images'
);

await runSQL(
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='product_images_public_select'
     ) THEN
       CREATE POLICY "product_images_public_select" ON storage.objects
         FOR SELECT TO public USING (bucket_id = 'product-images');
     END IF;
   END $$;`,
  'Migration 013 — policy lecture publique'
);

await runSQL(
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='product_images_vendor_insert'
     ) THEN
       CREATE POLICY "product_images_vendor_insert" ON storage.objects
         FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
     END IF;
   END $$;`,
  'Migration 013 — policy upload vendor'
);

console.log('\n✅ Terminé. Rechargez l\'application.\n');
