/* ======================================================
   VERCEL MIDDLEWARE — PROTEÇÃO POR SENHA DA ROTA /app
   Só o hash SHA-256 da senha fica no repositório.
   Para trocar a senha:
   node -e "console.log(require('crypto').createHash('sha256').update('NOVA_SENHA').digest('hex'))"
   ====================================================== */

export const config = {
    matcher: ['/app', '/app/:path*', '/app.html'],
};

const PASSWORD_HASH = '14d16cd8a62eeb557ad5f0179a6b42f522600e634efde3b16040e59fff8b217d';
const COOKIE = 'mm_gate';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function isValid(password) {
    return typeof password === 'string' && password.length > 0 && (await sha256(password)) === PASSWORD_HASH;
}

function readCookie(request, name) {
    const header = request.headers.get('cookie') || '';
    for (const part of header.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name) {
            try { return decodeURIComponent(v.join('=')); } catch { return null; }
        }
    }
    return null;
}

function gatePage(error) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0b0b0f">
<meta name="robots" content="noindex">
<title>Mensuremi - Acesso Restrito</title>
<link rel="icon" href="/public/images/logo.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:#0b0b0f;background-image:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(230,0,42,.18),transparent 70%);color:#ededf0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:380px;background:#131318;border:1px solid #2a2a35;border-radius:16px;padding:40px 32px;text-align:center}
.logo{display:block;margin:0 auto 18px;width:64px;height:64px;border-radius:14px;object-fit:cover;box-shadow:0 4px 16px rgba(230,0,42,.35)}
h1{font-size:1.4rem;font-weight:800}
p{margin-top:8px;color:#94949f;font-size:.9rem;line-height:1.5}
form{margin-top:24px;display:flex;flex-direction:column;gap:12px;text-align:left}
input{background:#1a1a22;border:1px solid #2a2a35;border-radius:8px;color:#ededf0;font:inherit;font-size:.95rem;padding:12px 14px;outline:none;transition:border-color .2s}
input:focus{border-color:#e6002a}
button{padding:13px 22px;background:#e6002a;border:none;border-radius:8px;color:#fff;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer}
button:hover{background:#b30021}
.err{min-height:1.2em;font-size:.85rem;text-align:center;color:#ff3b4f}
</style>
</head>
<body>
<main class="card">
<img src="/public/images/logo.png" alt="Mensuremi" class="logo">
<h1>Acesso Restrito</h1>
<p>O Mensuremi está em acesso antecipado.<br>Digite a senha de convidado para continuar.</p>
<form method="POST" action="/app">
<input type="password" name="password" placeholder="Senha de acesso" autocomplete="current-password" autofocus required>
<button type="submit">Entrar</button>
<span class="err">${error ? 'Senha incorreta.' : ''}</span>
</form>
</main>
</body>
</html>`;
    return new Response(html, {
        status: 401,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex',
        },
    });
}

export default async function middleware(request) {
    if (request.method === 'POST') {
        let password = '';
        try {
            const form = await request.formData();
            password = String(form.get('password') || '');
        } catch { /* corpo inválido */ }

        if (!(await isValid(password))) return gatePage(true);

        return new Response(null, {
            status: 303,
            headers: {
                'Location': '/app',
                'Cache-Control': 'no-store',
                'Set-Cookie': `${COOKIE}=${encodeURIComponent(password)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
            },
        });
    }

    if (await isValid(readCookie(request, COOKIE))) return; // segue para o app

    return gatePage(false);
}
