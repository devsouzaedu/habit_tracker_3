/*
  ============================================================
  MIGRATION SCRIPT: data.json → Supabase
  
  This script uploads your existing data.json to Supabase
  so your progress is preserved after deployment.

  PREREQUISITES:
  1. Create a Supabase project at https://supabase.com
  2. Run the SQL below in Supabase SQL Editor to create the table
  3. Set SUPABASE_URL and SUPABASE_KEY below
  4. Run: node migrate-to-supabase.js

  SQL TO CREATE TABLE (run in Supabase SQL Editor):
  ─────────────────────────────────────────────────
  
  CREATE TABLE user_data (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Enable Row Level Security
  ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

  -- Allow all operations for anon users (single-user app)
  CREATE POLICY "Allow all for anon" ON user_data
    FOR ALL USING (true) WITH CHECK (true);
  
  ============================================================
*/

const fs = require('fs');
const path = require('path');

// ===== CONFIGURE THESE =====
const SUPABASE_URL = 'https://frxfchoxnaduyfqwupnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_etYl2GuPZDoMMwbjhCo8zQ_Edhy5iRX';
// ============================

const DATA_FILE = path.join(__dirname, 'data.json');

async function migrate() {
    console.log('\n  ╔══════════════════════════════════════════════════╗');
    console.log('  ║    HABIT TRACKER — MIGRAÇÃO PARA SUPABASE        ║');
    console.log('  ╚══════════════════════════════════════════════════╝\n');

    // Validate config
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('  ❌ Configure SUPABASE_URL e SUPABASE_KEY no arquivo migrate-to-supabase.js');
        console.error('  Encontre esses valores em: Supabase Dashboard → Settings → API\n');
        process.exit(1);
    }

    // Read data.json
    if (!fs.existsSync(DATA_FILE)) {
        console.error('  ❌ Arquivo data.json não encontrado!');
        process.exit(1);
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);

    console.log('  📂 data.json lido com sucesso');
    console.log(`  📊 Chaves encontradas: ${Object.keys(data).join(', ')}`);

    // Upload to Supabase using REST API (no npm packages needed!)
    const payload = {
        key: 'default',
        data: data,
        updated_at: new Date().toISOString()
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        console.log('\n  ✅ Dados migrados com sucesso para o Supabase!');
        console.log('  🎉 Seu progresso está salvo na nuvem.\n');
        console.log('  Próximos passos:');
        console.log('  1. Atualize SUPABASE_URL e SUPABASE_ANON_KEY em supabase-config.js');
        console.log('  2. Faça git push para o GitHub');
        console.log('  3. Conecte o repo no Vercel\n');

    } catch (error) {
        console.error(`\n  ❌ Erro na migração: ${error.message}`);
        console.error('  Verifique se:');
        console.error('    - A URL e Key do Supabase estão corretas');
        console.error('    - A tabela user_data foi criada (SQL acima)');
        console.error('    - Row Level Security permite escrita\n');
        process.exit(1);
    }
}

migrate();
