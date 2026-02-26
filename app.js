/* ======================================================
   HABIT TRACKER v3 — APP LOGIC
   Storage: Supabase cloud + localStorage fallback
   ====================================================== */
(() => {
    'use strict';

    const KEYS = {
        PW: 'ht_password',
        HABITS: 'ht_habits',
        REC: 'ht_records',
        NOTES: 'ht_notes',
        FIN: 'ht_finance',
        AUTH: 'ht_auth'
    };
    const DEF_PW = '1234';
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const DAYS_F = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const MO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // state
    let weekOff = 0;
    let dPeriod = 'week';
    let delId = null;
    let editNoteId = null;
    let supabaseReady = false;
    let supabase = null;
    let mobileSelectedDay = null; // index 0-6 for mobile day view

    // ==================== SUPABASE INIT ====================
    function initSupabase() {
        try {
            if (typeof SUPABASE_URL !== 'undefined' &&
                typeof SUPABASE_ANON_KEY !== 'undefined' &&
                SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
                SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                supabaseReady = true;
                console.log('[SUPABASE] Connected');
            } else {
                console.log('[SUPABASE] Not configured — using localStorage only');
            }
        } catch (e) {
            console.error('[SUPABASE] Init error:', e.message);
        }
    }

    // ==================== STORAGE LAYER ====================
    // Reads from localStorage (instant), writes to both localStorage AND Supabase

    function lGet(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; }
        catch { return fallback; }
    }
    function lSet(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
        syncToSupabase(); // async, non-blocking
    }

    const getPw = () => localStorage.getItem(KEYS.PW) || DEF_PW;
    const setPw = p => { localStorage.setItem(KEYS.PW, p); syncToSupabase(); };
    const getH = () => lGet(KEYS.HABITS, []);
    const svH = h => lSet(KEYS.HABITS, h);
    const getR = () => lGet(KEYS.REC, {});
    const svR = r => lSet(KEYS.REC, r);
    const getN = () => lGet(KEYS.NOTES, []);
    const svN = n => lSet(KEYS.NOTES, n);
    const getF = () => lGet(KEYS.FIN, { balance: 0, log: [] });
    const svF = f => lSet(KEYS.FIN, f);

    // ===== SUPABASE SYNC =====
    // Uses a single row in `user_data` table with key='default'
    // Table schema: id (int8, auto), key (text, unique), data (jsonb), updated_at (timestamptz)
    let syncTimer = null;

    function syncToSupabase() {
        if (!supabaseReady) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(async () => {
            try {
                const payload = {};
                for (const k of Object.values(KEYS)) {
                    if (k === KEYS.AUTH) continue;
                    const val = localStorage.getItem(k);
                    if (val !== null) payload[k] = val;
                }
                const { error } = await supabase
                    .from('user_data')
                    .upsert({
                        key: 'default',
                        data: payload,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                if (error) console.error('[SUPABASE] Sync error:', error.message);
            } catch (e) {
                console.error('[SUPABASE] Sync exception:', e.message);
            }
        }, 500);
    }

    async function syncFromSupabase() {
        if (!supabaseReady) return false;
        try {
            const { data, error } = await supabase
                .from('user_data')
                .select('data')
                .eq('key', 'default')
                .single();

            if (error) {
                // PGRST116 = no rows found, which is normal for first use
                if (error.code === 'PGRST116') {
                    console.log('[SUPABASE] No data found — will use localStorage or create fresh');
                    return false;
                }
                console.error('[SUPABASE] Read error:', error.message);
                return false;
            }

            if (data && data.data) {
                for (const [k, v] of Object.entries(data.data)) {
                    if (k === KEYS.AUTH) continue;
                    localStorage.setItem(k, v);
                }
                console.log('[SUPABASE] Data loaded from cloud');
                return true;
            }
            return false;
        } catch (e) {
            console.error('[SUPABASE] Read exception:', e.message);
            return false;
        }
    }

    // Legacy: also try local server if available (for backwards compatibility)
    async function syncFromLocalServer() {
        try {
            const resp = await fetch('/api/data');
            if (!resp.ok) return false;
            const data = await resp.json();
            for (const [k, v] of Object.entries(data)) {
                if (k === KEYS.AUTH) continue;
                localStorage.setItem(k, v);
            }
            return true;
        } catch {
            return false;
        }
    }

    // ==================== DATE HELPERS ====================
    const $ = id => document.getElementById(id);
    const now = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const dk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rk = (hid, d) => `${hid}_${dk(d)}`;
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const esc = t => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };

    function weekDays() {
        const s = addD(now(), weekOff * 7);
        return Array.from({ length: 7 }, (_, i) => addD(s, i));
    }

    function rangeText(days) {
        const f = days[0], l = days[6];
        if (f.getMonth() === l.getMonth()) return `${f.getDate()} – ${l.getDate()} ${MO[f.getMonth()]} ${f.getFullYear()}`;
        return `${f.getDate()} ${MO[f.getMonth()]} – ${l.getDate()} ${MO[l.getMonth()]} ${l.getFullYear()}`;
    }

    const fmtDt = iso => {
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const fmtMoney = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ==================== AUTH ====================
    async function initAuth() {
        const screen = $('login-screen'), app = $('app');

        // Initialize Supabase
        initSupabase();

        // Sync data: try Supabase first, then local server
        const loadedFromCloud = await syncFromSupabase();
        if (!loadedFromCloud) {
            await syncFromLocalServer();
        }

        if (sessionStorage.getItem(KEYS.AUTH) === '1') {
            screen.classList.add('hidden');
            app.classList.remove('hidden');
            boot();
            return;
        }

        const input = $('login-pw'), btn = $('login-btn'), err = $('login-err');
        const attempt = () => {
            if (input.value === getPw()) {
                sessionStorage.setItem(KEYS.AUTH, '1');
                screen.style.opacity = '0';
                screen.style.transition = 'opacity .35s';
                setTimeout(() => { screen.classList.add('hidden'); app.classList.remove('hidden'); boot(); }, 350);
            } else {
                err.textContent = 'Senha incorreta';
                setTimeout(() => err.textContent = '', 2000);
            }
        };
        btn.onclick = attempt;
        input.onkeydown = e => { if (e.key === 'Enter') attempt(); };
    }

    // ==================== BOOT ====================
    function boot() {
        const n = new Date();
        $('topbar-date').textContent = `${DAYS_F[n.getDay()]}, ${n.getDate()} ${MO[n.getMonth()]} ${n.getFullYear()}`;
        initNav();
        initTracker();
        initHabitModal();
        initDelModal();
        initNotes();
        initNoteModal();
        initFinance();
        initPwModal();
        renderTracker();
    }

    // ==================== NAV ====================
    function initNav() {
        const btns = document.querySelectorAll('.sidebar-btn:not(.logout)');
        const titles = { tracker: 'Tracker', notes: 'Notas', finance: 'Finanças', dashboard: 'Dashboard' };
        btns.forEach(b => {
            b.onclick = () => {
                btns.forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
                const v = b.dataset.view;
                $(`${v}-view`).classList.remove('hidden');
                $('topbar-title').textContent = titles[v] || '';
                if (v === 'dashboard') renderDash();
                if (v === 'notes') renderNotes();
                if (v === 'finance') renderFinance();
            };
        });
        $('logout-btn').onclick = () => { sessionStorage.removeItem(KEYS.AUTH); location.reload(); };
    }

    // ==================== TRACKER ====================
    function initTracker() {
        $('prev-week').onclick = () => { weekOff--; mobileSelectedDay = null; renderTracker(); };
        $('next-week').onclick = () => { weekOff++; mobileSelectedDay = null; renderTracker(); };
        $('today-btn').onclick = () => { weekOff = 0; mobileSelectedDay = null; renderTracker(); };
    }

    function renderTracker() {
        const habits = getH(), rec = getR(), days = weekDays(), td = now();
        $('week-range').textContent = rangeText(days);
        const grid = $('tracker-grid'), empty = $('tracker-empty');

        if (!habits.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        let h = '';
        // header row
        h += '<div class="grid-row header"><div class="cell"></div>';
        days.forEach(d => {
            const t = same(d, td);
            h += `<div class="cell${t ? ' is-today' : ''}"><span>${DAYS[d.getDay()]}</span><span class="dn">${d.getDate()}</span></div>`;
        });
        h += '<div class="cell"></div></div>';

        // habit rows
        habits.forEach(hab => {
            const streak = calcStreak(hab.id, rec);
            h += `<div class="grid-row habit">`;
            h += `<div class="habit-info">`;
            h += `<div class="h-icon" style="border:1px solid ${hab.color || 'var(--brd)'}">${hab.icon}</div>`;
            h += `<div><div class="h-name">${esc(hab.name)}</div>`;
            h += `<div class="h-streak">${streak > 0 ? '🔥 ' + streak + 'd' : '—'}</div></div></div>`;

            days.forEach(d => {
                const t = same(d, td);
                const key = rk(hab.id, d);
                const s = rec[key] || null;
                let cls = 's-btn', txt = '—';
                if (s === 'win') { cls += ' w'; txt = 'Win'; }
                else if (s === 'fail') { cls += ' f'; txt = 'Fail'; }
                h += `<div class="cell${t ? ' is-today' : ''}"><button class="${cls}" data-h="${hab.id}" data-d="${dk(d)}">${txt}</button></div>`;
            });

            h += `<div class="del-cell"><button class="row-del" data-del="${hab.id}" title="Excluir">✕</button></div>`;
            h += `</div>`;
        });

        grid.innerHTML = h;

        // bind events
        grid.querySelectorAll('.s-btn').forEach(b => { b.onclick = () => toggleStatus(b); });
        grid.querySelectorAll('.row-del').forEach(b => { b.onclick = () => openDel(b.dataset.del); });

        renderProgressChart();
        renderMobileTracker();
    }

    // ==================== MOBILE TRACKER ====================
    function isMobile() {
        return window.innerWidth <= 640;
    }

    function renderMobileTracker() {
        if (!isMobile()) return;

        const habits = getH(), rec = getR(), days = weekDays(), td = now();
        const strip = $('mobile-day-strip');
        const container = $('mobile-tracker');
        const emptyEl = $('mobile-tracker-empty');

        if (!habits.length) {
            strip.innerHTML = '';
            container.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        // Auto-select today if not set
        if (mobileSelectedDay === null) {
            mobileSelectedDay = days.findIndex(d => same(d, td));
            if (mobileSelectedDay === -1) mobileSelectedDay = 0;
        }

        const selDay = days[mobileSelectedDay];

        // Day strip
        strip.innerHTML = days.map((d, i) => {
            const isToday = same(d, td);
            const active = i === mobileSelectedDay;
            let cls = 'mobile-day-btn';
            if (active) cls += ' active';
            if (isToday) cls += ' is-today';
            return `<button class="${cls}" data-di="${i}"><span>${DAYS[d.getDay()]}</span><span class="day-num">${d.getDate()}</span></button>`;
        }).join('');

        strip.querySelectorAll('.mobile-day-btn').forEach(b => {
            b.onclick = () => {
                mobileSelectedDay = parseInt(b.dataset.di);
                renderMobileTracker();
            };
        });

        // Scroll active day into view
        const activeBtn = strip.querySelector('.mobile-day-btn.active');
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        // Day summary
        let winsToday = 0;
        habits.forEach(hab => {
            if (rec[rk(hab.id, selDay)] === 'win') winsToday++;
        });
        const pct = Math.round((winsToday / habits.length) * 100);
        const scoreCls = pct >= 60 ? 'good' : pct >= 30 ? 'mid' : pct > 0 ? 'bad' : '';
        const dayLabel = same(selDay, td) ? 'Hoje' : `${DAYS_F[selDay.getDay()]}, ${selDay.getDate()} ${MO[selDay.getMonth()]}`;

        let html = `<div class="mobile-day-summary">`;
        html += `<span class="mobile-day-label">${dayLabel}</span>`;
        html += `<span class="mobile-day-score ${scoreCls}">${winsToday}/${habits.length} — ${pct}%</span>`;
        html += `</div>`;

        // Habit cards
        habits.forEach(hab => {
            const key = rk(hab.id, selDay);
            const s = rec[key] || null;
            const streak = calcStreak(hab.id, rec);
            let toggleCls = 'mobile-habit-toggle';
            let toggleTxt = '—';
            if (s === 'win') { toggleCls += ' w'; toggleTxt = '✓ Win'; }
            else if (s === 'fail') { toggleCls += ' f'; toggleTxt = '✗ Fail'; }

            html += `<div class="mobile-habit-card">`;
            html += `<div class="mobile-habit-left">`;
            html += `<div class="mobile-habit-icon" style="border:1px solid ${hab.color || 'var(--brd)'}">${hab.icon}</div>`;
            html += `<div><div class="mobile-habit-name">${esc(hab.name)}</div>`;
            html += `<div class="mobile-habit-streak">${streak > 0 ? '🔥 ' + streak + 'd' : ''}</div></div></div>`;
            html += `<button class="${toggleCls}" data-h="${hab.id}" data-d="${dk(selDay)}">${toggleTxt}</button>`;
            html += `<button class="mobile-habit-del" data-del="${hab.id}">✕</button>`;
            html += `</div>`;
        });

        container.innerHTML = html;

        // Bind events
        container.querySelectorAll('.mobile-habit-toggle').forEach(b => {
            b.onclick = () => toggleStatus(b);
        });
        container.querySelectorAll('.mobile-habit-del').forEach(b => {
            b.onclick = () => openDel(b.dataset.del);
        });
    }

    // ==================== PROGRESS LINE CHART ====================
    function renderProgressChart() {
        const canvas = $('progress-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cont = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = cont.clientWidth * dpr;
        canvas.height = cont.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        const w = cont.clientWidth, ht = cont.clientHeight;
        ctx.clearRect(0, 0, w, ht);

        const habits = getH(), rec = getR(), td = now();
        const numDays = 30;

        if (!habits.length) {
            ctx.fillStyle = '#5a5a67';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Adicione hábitos para ver o progresso', w / 2, ht / 2);
            return;
        }

        // Build data: for each of the last 30 days, compute % of habits completed
        const data = [];
        for (let i = numDays - 1; i >= 0; i--) {
            const d = addD(td, -i);
            let wins = 0;
            habits.forEach(hab => {
                const key = rk(hab.id, d);
                if (rec[key] === 'win') wins++;
            });
            const pct = Math.round((wins / habits.length) * 100);
            data.push({
                date: d,
                pct,
                label: `${d.getDate()}/${d.getMonth() + 1}`
            });
        }

        const p = { t: 24, r: 18, b: 32, l: 40 };
        const cw = w - p.l - p.r;
        const ch = ht - p.t - p.b;

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = p.t + (ch / 4) * i;
            const val = 100 - (i * 25);
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.l, y);
            ctx.lineTo(w - p.r, y);
            ctx.stroke();
            ctx.fillStyle = '#5a5a67';
            ctx.font = '9px JetBrains Mono';
            ctx.textAlign = 'right';
            ctx.fillText(val + '%', p.l - 6, y + 3);
        }

        // Date labels
        const labelStep = Math.ceil(data.length / 10);
        data.forEach((item, i) => {
            if (i % labelStep === 0 || i === data.length - 1) {
                const x = p.l + (i / (data.length - 1)) * cw;
                ctx.fillStyle = '#5a5a67';
                ctx.font = '9px JetBrains Mono';
                ctx.textAlign = 'center';
                ctx.fillText(item.label, x, ht - p.b + 16);
            }
        });

        if (data.length < 2) return;

        // Build points
        const points = data.map((item, i) => ({
            x: p.l + (i / (data.length - 1)) * cw,
            y: p.t + ch - (item.pct / 100) * ch
        }));

        // Gradient fill under the line
        const gradient = ctx.createLinearGradient(0, p.t, 0, p.t + ch);
        gradient.addColorStop(0, 'rgba(230, 0, 42, 0.25)');
        gradient.addColorStop(0.5, 'rgba(230, 0, 42, 0.08)');
        gradient.addColorStop(1, 'rgba(230, 0, 42, 0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const cpx = (points[i - 1].x + points[i].x) / 2;
            ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
        }
        ctx.lineTo(points[points.length - 1].x, p.t + ch);
        ctx.lineTo(points[0].x, p.t + ch);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const cpx = (points[i - 1].x + points[i].x) / 2;
            ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#e6002a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Average line
        const avg = Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length);
        const avgY = p.t + ch - (avg / 100) * ch;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.l, avgY);
        ctx.lineTo(w - p.r, avgY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Average label
        ctx.fillStyle = 'rgba(0, 230, 118, 0.7)';
        ctx.font = '9px JetBrains Mono';
        ctx.textAlign = 'left';
        ctx.fillText('Média: ' + avg + '%', p.l + 4, avgY - 6);

        // Dots on data points (show a subset to avoid clutter)
        const dotStep = Math.max(1, Math.floor(data.length / 15));
        points.forEach((pt, i) => {
            if (i % dotStep === 0 || i === points.length - 1) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#e6002a';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(230, 0, 42, 0.3)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        });

        // Current value highlight (last point)
        const last = points[points.length - 1];
        const lastPct = data[data.length - 1].pct;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = lastPct >= 60 ? '#00e676' : lastPct >= 30 ? '#ffcc00' : '#ff3b4f';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = lastPct >= 60 ? 'rgba(0,230,118,0.3)' : lastPct >= 30 ? 'rgba(255,204,0,0.3)' : 'rgba(255,59,79,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Today % label
        ctx.fillStyle = '#ededf0';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText('Hoje: ' + lastPct + '%', w - p.r, p.t - 6);
    }

    function toggleStatus(btn) {
        const hid = btn.dataset.h, dkey = btn.dataset.d;
        const rec = getR();
        const key = `${hid}_${dkey}`;
        const cur = rec[key] || null;
        if (cur === null) rec[key] = 'win';
        else if (cur === 'win') rec[key] = 'fail';
        else delete rec[key];
        svR(rec);
        renderTracker();
    }

    function calcStreak(hid, rec) {
        let s = 0, d = now();
        if (rec[rk(hid, d)] !== 'win') d = addD(d, -1);
        while (rec[rk(hid, d)] === 'win') { s++; d = addD(d, -1); }
        return s;
    }

    function bestStreak(hid, rec) {
        const dates = [];
        for (const k in rec) {
            if (k.startsWith(hid + '_') && rec[k] === 'win') {
                dates.push(new Date(k.replace(hid + '_', '') + 'T00:00:00'));
            }
        }
        if (!dates.length) return 0;
        dates.sort((a, b) => a - b);
        let best = 1, cur = 1;
        for (let i = 1; i < dates.length; i++) {
            if ((dates[i] - dates[i - 1]) / 864e5 === 1) { cur++; best = Math.max(best, cur); }
            else cur = 1;
        }
        return best;
    }

    // ==================== HABIT MODAL ====================
    function initHabitModal() {
        let icon = '🏋️', color = '#e6002a';
        $('add-habit-btn').onclick = () => { $('habit-modal').classList.remove('hidden'); $('h-name').value = ''; $('h-name').focus(); };

        document.querySelectorAll('#icon-picker .pick').forEach(b => {
            b.onclick = () => {
                document.querySelectorAll('#icon-picker .pick').forEach(x => x.classList.remove('selected'));
                b.classList.add('selected'); icon = b.dataset.v;
            };
        });
        document.querySelectorAll('#color-picker .cdot').forEach(b => {
            b.onclick = () => {
                document.querySelectorAll('#color-picker .cdot').forEach(x => x.classList.remove('selected'));
                b.classList.add('selected'); color = b.dataset.v;
            };
        });

        $('h-save').onclick = () => {
            const name = $('h-name').value.trim();
            if (!name) { $('h-name').style.borderColor = 'var(--fail)'; setTimeout(() => $('h-name').style.borderColor = '', 1500); return; }
            const habits = getH();
            habits.push({ id: 'h_' + Date.now(), name, icon, color, created: new Date().toISOString() });
            svH(habits);
            $('habit-modal').classList.add('hidden');
            renderTracker();
        };
        $('h-name').onkeydown = e => { if (e.key === 'Enter') $('h-save').click(); };
    }

    // ==================== DELETE MODAL ====================
    function initDelModal() {
        $('del-confirm').onclick = () => {
            if (!delId) return;
            svH(getH().filter(h => h.id !== delId));
            const rec = getR(), clean = {};
            for (const k in rec) { if (!k.startsWith(delId + '_')) clean[k] = rec[k]; }
            svR(clean);
            $('del-modal').classList.add('hidden');
            delId = null;
            renderTracker();
        };
    }

    function openDel(id) {
        const h = getH().find(x => x.id === id);
        if (!h) return;
        delId = id;
        $('del-name').textContent = h.name;
        $('del-modal').classList.remove('hidden');
    }

    // ==================== NOTES ====================
    function initNotes() {
        $('add-note-btn').onclick = () => {
            editNoteId = null;
            $('note-modal-title').textContent = 'Nova Nota';
            $('n-title').value = ''; $('n-content').value = '';
            $('note-modal').classList.remove('hidden');
            $('n-title').focus();
        };
    }

    function renderNotes() {
        const notes = getN();
        const list = $('notes-grid'), empty = $('notes-empty');
        if (!notes.length) { empty.classList.remove('hidden'); list.innerHTML = ''; return; }
        empty.classList.add('hidden');
        const sorted = [...notes].sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));
        list.innerHTML = sorted.map(n => `
            <div class="note-card" data-nid="${n.id}">
                <button class="note-del" data-ndel="${n.id}" title="Excluir">✕</button>
                <div class="note-card-t">${esc(n.title || 'Sem título')}</div>
                <div class="note-card-b">${esc(n.content || '')}</div>
                <div class="note-card-d">${fmtDt(n.updated || n.created)}</div>
            </div>
        `).join('');

        list.querySelectorAll('.note-card').forEach(c => {
            c.onclick = e => { if (e.target.closest('.note-del')) return; openNote(c.dataset.nid); };
        });
        list.querySelectorAll('.note-del').forEach(b => {
            b.onclick = e => { e.stopPropagation(); svN(getN().filter(n => n.id !== b.dataset.ndel)); renderNotes(); };
        });
    }

    function openNote(id) {
        const n = getN().find(x => x.id === id);
        if (!n) return;
        editNoteId = id;
        $('note-modal-title').textContent = 'Editar Nota';
        $('n-title').value = n.title || '';
        $('n-content').value = n.content || '';
        $('note-modal').classList.remove('hidden');
    }

    function initNoteModal() {
        $('n-save').onclick = () => {
            const title = $('n-title').value.trim(), content = $('n-content').value.trim();
            if (!title && !content) return;
            const notes = getN(), ts = new Date().toISOString();
            if (editNoteId) {
                const n = notes.find(x => x.id === editNoteId);
                if (n) { n.title = title; n.content = content; n.updated = ts; }
            } else {
                notes.push({ id: 'n_' + Date.now(), title, content, created: ts, updated: ts });
            }
            svN(notes);
            $('note-modal').classList.add('hidden');
            renderNotes();
        };
    }

    // ==================== FINANCE ====================
    function initFinance() {
        const doEntry = type => {
            const val = parseFloat($('fin-val').value);
            if (!val || val <= 0) { $('fin-val').style.borderColor = 'var(--fail)'; setTimeout(() => $('fin-val').style.borderColor = '', 1500); return; }
            const fin = getF();
            const amt = type === 'in' ? val : -val;
            fin.balance += amt;
            fin.log.unshift({
                id: 'f_' + Date.now(),
                amount: amt,
                desc: $('fin-desc').value.trim() || (type === 'in' ? 'Entrada' : 'Saída'),
                date: new Date().toISOString()
            });
            svF(fin);
            $('fin-val').value = ''; $('fin-desc').value = '';
            renderFinance();
        };
        $('fin-in-btn').onclick = () => doEntry('in');
        $('fin-out-btn').onclick = () => doEntry('out');
        $('fin-val').onkeydown = e => { if (e.key === 'Enter') doEntry('in'); };
    }

    function renderFinance() {
        const fin = getF();
        $('balance-amount').textContent = fmtMoney(fin.balance);
        const log = $('fin-log'), empty = $('fin-empty');
        if (!fin.log.length) { empty.classList.remove('hidden'); log.innerHTML = ''; return; }
        empty.classList.add('hidden');

        log.innerHTML = fin.log.map(e => `
            <div class="fin-entry">
                <div class="fin-entry-info">
                    <div class="fin-entry-d">${esc(e.desc)}</div>
                    <div class="fin-entry-dt">${fmtDt(e.date)}</div>
                </div>
                <span class="fin-amount ${e.amount >= 0 ? 'pos' : 'neg'}">${e.amount >= 0 ? '+' : ''}${fmtMoney(Math.abs(e.amount))}</span>
                <button class="fin-del" data-fid="${e.id}" title="Excluir">✕</button>
            </div>
        `).join('');

        log.querySelectorAll('.fin-del').forEach(b => {
            b.onclick = () => {
                const fin = getF();
                const entry = fin.log.find(x => x.id === b.dataset.fid);
                if (entry) { fin.balance -= entry.amount; fin.log = fin.log.filter(x => x.id !== b.dataset.fid); svF(fin); renderFinance(); }
            };
        });
    }

    // ==================== PASSWORD MODAL ====================
    function initPwModal() {
        document.querySelector('.sidebar-logo').ondblclick = () => {
            $('pw-modal').classList.remove('hidden');
            $('pw-new').value = ''; $('pw-conf').value = ''; $('pw-err').textContent = '';
        };
        $('pw-save').onclick = () => {
            const np = $('pw-new').value, cp = $('pw-conf').value;
            if (!np) { $('pw-err').textContent = 'Digite uma nova senha'; return; }
            if (np !== cp) { $('pw-err').textContent = 'Senhas não coincidem'; return; }
            setPw(np);
            $('pw-modal').classList.add('hidden');
        };
    }

    // ==================== DASHBOARD ====================
    function renderDash() {
        const habits = getH(), rec = getR(), td = now();
        document.querySelectorAll('.pill').forEach(b => {
            b.classList.toggle('active', b.dataset.period === dPeriod);
            b.onclick = () => { dPeriod = b.dataset.period; renderDash(); };
        });

        let start;
        if (dPeriod === 'week') start = addD(td, -6);
        else if (dPeriod === 'month') start = new Date(td.getFullYear(), td.getMonth(), 1);
        else start = new Date(2020, 0, 1);

        const pRec = {};
        for (const k in rec) {
            const ds = k.split('_').pop();
            const rd = new Date(ds + 'T00:00:00');
            if (rd >= start && rd <= td) pRec[k] = rec[k];
        }

        let wins = 0, fails = 0;
        for (const k in pRec) { if (pRec[k] === 'win') wins++; else if (pRec[k] === 'fail') fails++; }
        const total = wins + fails;
        const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
        let bst = 0;
        habits.forEach(h => { bst = Math.max(bst, bestStreak(h.id, rec)); });

        $('s-wins').textContent = wins;
        $('s-fails').textContent = fails;
        $('s-rate').textContent = rate + '%';
        $('s-streak').textContent = bst;

        drawChart(start, td, habits, rec);
        drawBars(habits, pRec);
        drawTable(habits, pRec);
    }

    function drawChart(start, end, habits, rec) {
        const canvas = $('chart-canvas'), ctx = canvas.getContext('2d');
        const cont = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = cont.clientWidth * dpr;
        canvas.height = cont.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        const w = cont.clientWidth, ht = cont.clientHeight;
        ctx.clearRect(0, 0, w, ht);

        const data = [];
        let d = new Date(start), maxV = 1;
        while (d <= end) {
            let dw = 0, df = 0;
            habits.forEach(hab => { const k = rk(hab.id, d); if (rec[k] === 'win') dw++; else if (rec[k] === 'fail') df++; });
            data.push({ wins: dw, fails: df, label: `${d.getDate()}/${d.getMonth() + 1}` });
            maxV = Math.max(maxV, dw, df);
            d = addD(d, 1);
        }

        let display = data.length > 60 ? data.slice(-60) : data;
        if (!display.length) { ctx.fillStyle = '#5a5a67'; ctx.font = '12px Inter'; ctx.textAlign = 'center'; ctx.fillText('Sem dados', w / 2, ht / 2); return; }

        const p = { t: 14, r: 14, b: 32, l: 32 };
        const cw = w - p.l - p.r, ch = ht - p.t - p.b;
        const gw = cw / display.length;
        const bw = Math.max(3, Math.min(12, gw * 0.35));

        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = p.t + (ch / 4) * i;
            ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(w - p.r, y); ctx.stroke();
            ctx.fillStyle = '#5a5a67'; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxV - (maxV / 4) * i), p.l - 5, y + 3);
        }

        display.forEach((item, i) => {
            const x = p.l + i * gw + gw / 2;
            if (item.wins > 0) {
                const bh = (item.wins / maxV) * ch;
                ctx.fillStyle = 'rgba(0,230,118,0.55)';
                ctx.beginPath(); ctx.rect(x - bw - 1, p.t + ch - bh, bw, bh); ctx.fill();
            }
            if (item.fails > 0) {
                const bh = (item.fails / maxV) * ch;
                ctx.fillStyle = 'rgba(255,59,79,0.55)';
                ctx.beginPath(); ctx.rect(x + 1, p.t + ch - bh, bw, bh); ctx.fill();
            }
            const show = display.length <= 14 || i % Math.ceil(display.length / 14) === 0;
            if (show) { ctx.fillStyle = '#5a5a67'; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(item.label, x, p.t + ch + 14); }
        });

        ctx.fillStyle = 'rgba(0,230,118,0.7)'; ctx.fillRect(w - 100, 4, 8, 8);
        ctx.fillStyle = '#94949f'; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'left'; ctx.fillText('Win', w - 88, 12);
        ctx.fillStyle = 'rgba(255,59,79,0.7)'; ctx.fillRect(w - 52, 4, 8, 8);
        ctx.fillStyle = '#94949f'; ctx.fillText('Fail', w - 40, 12);
    }

    function drawBars(habits, pRec) {
        const el = $('habit-bars');
        if (!habits.length) { el.innerHTML = '<div class="empty-msg-sm">Nenhum hábito</div>'; return; }
        el.innerHTML = habits.map(h => {
            let w = 0, t = 0;
            for (const k in pRec) { if (k.startsWith(h.id + '_')) { t++; if (pRec[k] === 'win') w++; } }
            const p = t > 0 ? Math.round((w / t) * 100) : 0;
            return `<div class="hb-item"><div class="hb-top"><span class="hb-name">${h.icon} ${esc(h.name)}</span><span class="hb-pct">${p}%</span></div><div class="hb-track"><div class="hb-fill" style="width:${p}%;background:${h.color || 'var(--red)'}"></div></div></div>`;
        }).join('');
    }

    function drawTable(habits, pRec) {
        const tbody = $('detail-tbody');
        if (!habits.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--t3)">Sem dados</td></tr>'; return; }
        tbody.innerHTML = habits.map(h => {
            let w = 0, f = 0;
            for (const k in pRec) { if (k.startsWith(h.id + '_')) { if (pRec[k] === 'win') w++; else if (pRec[k] === 'fail') f++; } }
            const t = w + f, r = t > 0 ? Math.round((w / t) * 100) : 0;
            let bc, bt;
            if (r >= 80) { bc = 'ex'; bt = 'Excelente'; } else if (r >= 60) { bc = 'gd'; bt = 'Bom'; } else if (r >= 40) { bc = 'wr'; bt = 'Atenção'; } else { bc = 'dg'; bt = 'Crítico'; }
            return `<tr><td>${h.icon} ${esc(h.name)}</td><td style="color:var(--grn)">${w}</td><td style="color:var(--fail)">${f}</td><td>${r}%</td><td><span class="badge ${bc}">${bt}</span></td></tr>`;
        }).join('');
    }

    // ==================== MODAL CLOSE HANDLERS ====================
    document.addEventListener('click', e => {
        const closeBtn = e.target.closest('[data-close]');
        if (closeBtn) { $(closeBtn.dataset.close).classList.add('hidden'); return; }
        if (e.target.classList.contains('overlay')) { e.target.classList.add('hidden'); }
    });

    // ==================== INIT ====================
    document.addEventListener('DOMContentLoaded', () => initAuth());

    let resizeT;
    window.addEventListener('resize', () => {
        clearTimeout(resizeT);
        resizeT = setTimeout(() => {
            if (!$('dashboard-view').classList.contains('hidden')) renderDash();
            if (!$('tracker-view').classList.contains('hidden')) {
                renderProgressChart();
                renderMobileTracker();
            }
        }, 250);
    });
})();
