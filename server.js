/* ======================================================
   HABIT TRACKER — LOCAL SERVER
   Serves static files + persists data to data.json
   No external dependencies needed!
   ====================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3030;
const DATA_FILE = path.join(__dirname, 'data.json');
const STATIC_DIR = __dirname;

// MIME types
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

// ===== DATA HELPERS =====
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('[DATA] Error reading:', e.message);
    }
    return {};
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('[DATA] Error writing:', e.message);
        return false;
    }
}

// ===== GET LOCAL IP =====
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// ===== SERVER =====
const server = http.createServer((req, res) => {
    // CORS headers (for network access)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Disable caching for development
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ===== API: GET DATA =====
    if (req.method === 'GET' && req.url === '/api/data') {
        const data = readData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
    }

    // ===== API: POST DATA =====
    if (req.method === 'POST' && req.url === '/api/data') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                writeData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // ===== STATIC FILES =====
    let filePath = req.url.split('?')[0]; // strip query params
    if (filePath === '/') filePath = '/index.html';

    const fullPath = path.join(STATIC_DIR, filePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║          HABIT TRACKER v3 — SERVIDOR            ║');
    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log(`  ║  Local:    http://localhost:${PORT}                ║`);
    console.log(`  ║  Rede:     http://${localIP}:${PORT}          ║`);
    console.log('  ║                                                  ║');
    console.log('  ║  Acesse pelo celular usando o endereço da Rede  ║');
    console.log('  ║  Dados salvos em: data.json                     ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');

    // Open browser automatically
    exec(`start http://localhost:${PORT}`);
});
