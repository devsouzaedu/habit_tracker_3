const fs = require('fs');
const path = require('path');

async function ping() {
    console.log('--- SUPABASE PING BOT ---');
    
    // Read config
    const configPath = path.join(__dirname, 'supabase-config.js');
    if (!fs.existsSync(configPath)) {
        console.error('File supabase-config.js not found.');
        process.exit(1);
    }
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const urlMatch = content.match(/const SUPABASE_URL = ['"]([^'"]+)['"]/);
    const keyMatch = content.match(/const SUPABASE_ANON_KEY = ['"]([^'"]+)['"]/);
    
    if (!urlMatch || !keyMatch) {
        console.error('Could not parse SUPABASE_URL or SUPABASE_ANON_KEY from supabase-config.js.');
        process.exit(1);
    }
    
    const url = urlMatch[1];
    const key = keyMatch[1];
    
    console.log(`Pinging Supabase project at ${url}...`);
    
    try {
        const response = await fetch(`${url}/rest/v1/user_data?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (response.ok) {
            console.log('✅ Supabase pinged successfully! Project kept active.');
        } else {
            console.error(`❌ Ping failed with status: ${response.status}`);
            const text = await response.text();
            console.error(text);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Network or Fetch error:', error.message);
        process.exit(1);
    }
}

ping();
