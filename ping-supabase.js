const fs = require('fs');
const path = require('path');

async function ping() {
    console.log('--- SUPABASE ROBUST KEEP-ALIVE BOT ---');
    console.log(`Execution time: ${new Date().toISOString()}`);

    // Read config from ENV or fallback to supabase-config.js
    let url = process.env.SUPABASE_URL;
    let key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        const configPath = path.join(__dirname, 'supabase-config.js');
        if (!fs.existsSync(configPath)) {
            console.error('❌ File supabase-config.js not found.');
            process.exit(1);
        }

        const content = fs.readFileSync(configPath, 'utf-8');
        const urlMatch = content.match(/const SUPABASE_URL = ['"]([^'"]+)['"]/);
        const keyMatch = content.match(/const SUPABASE_ANON_KEY = ['"]([^'"]+)['"]/);

        if (!urlMatch || !keyMatch) {
            console.error('❌ Could not parse SUPABASE_URL or SUPABASE_ANON_KEY from supabase-config.js.');
            process.exit(1);
        }

        url = urlMatch[1];
        key = keyMatch[1];
    }

    console.log(`Target Supabase project: ${url}`);

    let writeSuccess = false;
    let readSuccess = false;

    // STEP 1: Database write via RPC. The anon key can no longer write to user_data (RLS),
    // so it calls keepalive_ping() (SECURITY DEFINER, see supabase-migration.sql), which
    // upserts a row in the internal `keepalive` table and registers real Postgres activity.
    console.log('\n[1/2] Performing database write transaction (RPC keepalive_ping)...');
    try {
        const writeResponse = await fetch(`${url}/rest/v1/rpc/keepalive_ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Cache-Control': 'no-cache, no-store'
            },
            body: '{}'
        });

        if (writeResponse.ok) {
            console.log(`✅ Write transaction successful (HTTP ${writeResponse.status})! Postgres activity registered.`);
            writeSuccess = true;
        } else {
            const errText = await writeResponse.text();
            console.warn(`⚠️ Write transaction returned HTTP ${writeResponse.status}: ${errText}`);
        }
    } catch (err) {
        console.warn(`⚠️ Write transaction exception: ${err.message}`);
    }

    // STEP 2: Anti-cache request to the REST API root (no table access needed)
    console.log('\n[2/2] Performing anti-cache API request...');
    try {
        const readResponse = await fetch(`${url}/rest/v1/?nocache=${Date.now()}`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        if (readResponse.ok) {
            console.log(`✅ API request successful (HTTP ${readResponse.status})`);
            readSuccess = true;
        } else {
            const errText = await readResponse.text();
            console.warn(`⚠️ API request returned HTTP ${readResponse.status}: ${errText.slice(0, 200)}`);
        }
    } catch (err) {
        console.warn(`⚠️ API request exception: ${err.message}`);
    }

    // Validation
    if (writeSuccess) {
        console.log('\n🎉 SUCCESS: Supabase project is active and healthy!');
        process.exit(0);
    } else {
        console.error('\n❌ FAILURE: Database write (keepalive_ping) failed. Did you run supabase-migration.sql? Project might also be paused or credentials invalid.');
        process.exit(1);
    }
}

ping();
