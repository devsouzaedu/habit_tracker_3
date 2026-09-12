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

    // STEP 1: Execute a write transaction (UPSERT)
    // Writing to the database completely bypasses edge caches (Cloudflare/Kong)
    // and forces PostgreSQL to register write-ahead log (WAL) and transaction activity.
    console.log('\n[1/2] Performing database write transaction (UPSERT heartbeat)...');
    try {
        const timestamp = new Date().toISOString();
        const payload = {
            key: '_keepalive',
            data: {
                last_ping: timestamp,
                client: 'supabase-keepalive-bot',
                ping_count: Date.now()
            },
            updated_at: timestamp
        };

        const writeResponse = await fetch(`${url}/rest/v1/user_data?on_conflict=key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Prefer': 'resolution=merge-duplicates,return=minimal',
                'Cache-Control': 'no-cache, no-store'
            },
            body: JSON.stringify(payload)
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

    // STEP 2: Execute an anti-cache SELECT query
    console.log('\n[2/2] Performing anti-cache SELECT query...');
    try {
        const readResponse = await fetch(`${url}/rest/v1/user_data?key=eq._keepalive&select=key,updated_at&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        if (readResponse.ok) {
            const data = await readResponse.text();
            console.log(`✅ Read query successful (HTTP ${readResponse.status}): ${data.slice(0, 100)}`);
            readSuccess = true;
        } else {
            const errText = await readResponse.text();
            console.warn(`⚠️ Read query returned HTTP ${readResponse.status}: ${errText}`);
        }
    } catch (err) {
        console.warn(`⚠️ Read query exception: ${err.message}`);
    }

    // Validation
    if (writeSuccess || readSuccess) {
        console.log('\n🎉 SUCCESS: Supabase project is active and healthy!');
        process.exit(0);
    } else {
        console.error('\n❌ FAILURE: Both write and read operations failed. Project might be paused or credentials invalid.');
        process.exit(1);
    }
}

ping();
