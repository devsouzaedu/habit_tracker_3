// Temporary script to create user accounts
const https = require('https');

const SUPABASE_URL = 'https://frxfchoxnaduyfqwupnm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_etYl2GuPZDoMMwbjhCo8zQ_Edhy5iRX';

function createUser(userId, password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            key: userId,
            data: {
                [`ht_${userId}_password`]: password,
                [`ht_${userId}_habits`]: '[]',
                [`ht_${userId}_records`]: '{}',
                [`ht_${userId}_notes`]: '[]',
                [`ht_${userId}_finance`]: '{"balance":0,"log":[]}',
                [`ht_${userId}_workouts`]: '[]'
            },
            updated_at: new Date().toISOString()
        });

        const url = new URL(SUPABASE_URL + '/rest/v1/user_data');
        const options = {
            hostname: url.hostname,
            path: url.pathname + '?on_conflict=key',
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`✅ ${userId} criado com sucesso! (status: ${res.statusCode})`);
                    resolve();
                } else {
                    console.log(`❌ Erro ao criar ${userId}: ${res.statusCode} - ${body}`);
                    reject(body);
                }
            });
        });

        req.on('error', e => {
            console.log(`❌ Erro de rede para ${userId}:`, e.message);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

(async () => {
    console.log('Criando usuarios...\n');
    await createUser('usuario1', '221073');
    await createUser('usuario2', '221073');
    console.log('\nDone!');
})();
