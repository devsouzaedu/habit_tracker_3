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
        WORKOUT: 'ht_workouts',
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

    // workout state
    let woActive = null; // { startTime, muscles, exercises }
    let woTimerInterval = null;
    let woDetailId = null;

    // ==================== EXERCISE DATABASE ====================
    const MUSCLE_GROUPS = [
        { id: 'peito', name: 'Peito', emoji: '🫁', color: '#e6002a', split: 'push' },
        { id: 'ombro', name: 'Ombro', emoji: '🏔️', color: '#ff6600', split: 'push' },
        { id: 'triceps', name: 'Tríceps', emoji: '💪', color: '#ff3366', split: 'push' },
        { id: 'costas', name: 'Costas', emoji: '🔙', color: '#00b0ff', split: 'pull' },
        { id: 'biceps', name: 'Bíceps', emoji: '💪', color: '#9933ff', split: 'pull' },
        { id: 'trapezio', name: 'Trapézio', emoji: '🔺', color: '#00e676', split: 'pull' },
        { id: 'quadriceps', name: 'Quadríceps', emoji: '🦵', color: '#ffcc00', split: 'legs' },
        { id: 'posterior', name: 'Posterior', emoji: '🦵', color: '#ff9900', split: 'legs' },
        { id: 'panturrilha', name: 'Panturrilha', emoji: '🦶', color: '#00e676', split: 'legs' },
        { id: 'gluteos', name: 'Glúteos', emoji: '🍑', color: '#ff0099', split: 'legs' },
        { id: 'abdominais', name: 'Abdominais', emoji: '🎯', color: '#00e676', split: 'all' }
    ];

    const EXERCISE_DB = {
        peito: [
            'Supino Reto', 'Supino Inclinado', 'Supino Declinado',
            'Crucifixo', 'Crucifixo Inclinado', 'Crossover',
            'Flexão', 'Peck Deck', 'Voador'
        ],
        ombro: [
            'Desenvolvimento', 'Desenvolvimento Halteres',
            'Elevação Lateral', 'Elevação Frontal',
            'Face Pull', 'Arnold Press', 'Remada Alta'
        ],
        triceps: [
            'Tríceps Corda', 'Tríceps Testa', 'Tríceps Francês',
            'Tríceps Barra', 'Mergulho', 'Tríceps Coice',
            'Tríceps Banco'
        ],
        costas: [
            'Puxada Frontal', 'Puxada Triângulo', 'Remada Curvada',
            'Remada Cavaleiro', 'Remada Baixa', 'Pull-up',
            'Pullover', 'Remada Unilateral', 'Barra Fixa'
        ],
        biceps: [
            'Rosca Direta', 'Rosca Alternada', 'Rosca Martelo',
            'Rosca Scott', 'Rosca Concentrada', 'Rosca Inversa',
            'Rosca Barra W'
        ],
        trapezio: [
            'Encolhimento Halteres', 'Encolhimento Barra',
            'Remada Alta', 'Face Pull', 'Farmer Walk'
        ],
        quadriceps: [
            'Agachamento Livre', 'Leg Press', 'Cadeira Extensora',
            'Agachamento Hack', 'Afundo', 'Agachamento Frontal',
            'Passada', 'Sissy Squat'
        ],
        posterior: [
            'Cadeira Flexora', 'Stiff', 'Mesa Flexora',
            'Levantamento Terra', 'Good Morning', 'Leg Curl Deitado'
        ],
        panturrilha: [
            'Panturrilha em Pé', 'Panturrilha Sentado',
            'Panturrilha no Leg Press', 'Panturrilha Unilateral'
        ],
        gluteos: [
            'Hip Thrust', 'Abdução', 'Búlgaro',
            'Elevação Pélvica', 'Kickback', 'Agachamento Sumô'
        ],
        abdominais: [
            'Abdominal Crunch', 'Prancha', 'Elevação de Pernas',
            'Abdominal Bicicleta', 'Russian Twist', 'Abdominal Infra',
            'Prancha Lateral', 'Abdominal na Roda'
        ]
    };

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
    const getW = () => lGet(KEYS.WORKOUT, []);
    const svW = w => lSet(KEYS.WORKOUT, w);

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

    // ==================== AUTO-FAIL UNCHECKED HABITS ====================
    function markPastUncheckedAsFail() {
        const habits = getH(), rec = getR(), td = now();
        if (!habits.length) return;

        let changed = false;
        habits.forEach(hab => {
            // Start from habit creation date (or max 90 days ago)
            const maxPast = addD(td, -90);
            let startDate = hab.created ? new Date(hab.created) : maxPast;
            startDate.setHours(0, 0, 0, 0);
            if (startDate < maxPast) startDate = maxPast;

            // Iterate from startDate up to yesterday (not today)
            let d = new Date(startDate);
            while (d < td) {
                const key = rk(hab.id, d);
                if (!rec[key]) {
                    rec[key] = 'fail';
                    changed = true;
                }
                d = addD(d, 1);
            }
        });

        if (changed) {
            svR(rec);
            console.log('[AUTO-FAIL] Hábitos não marcados no passado foram definidos como falha');
        }
    }

    function scheduleMidnightCheck() {
        const runAtMidnight = () => {
            markPastUncheckedAsFail();
            // Re-render if tracker is visible
            if (!$('tracker-view').classList.contains('hidden')) {
                renderTracker();
            }
            if (!$('dashboard-view').classList.contains('hidden')) {
                renderDash();
            }
            // Schedule next midnight check
            scheduleMidnightCheck();
        };

        // Calculate ms until next 00:01
        const nowMs = new Date();
        const next = new Date(nowMs);
        next.setDate(next.getDate() + 1);
        next.setHours(0, 1, 0, 0); // 00:01:00
        const msUntilMidnight = next - nowMs;

        console.log(`[AUTO-FAIL] Próxima verificação em ${Math.round(msUntilMidnight / 60000)} minutos`);
        setTimeout(runAtMidnight, msUntilMidnight);
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

        // Mark past unchecked habits as fail on boot
        markPastUncheckedAsFail();

        renderTracker();

        // Schedule midnight auto-fail check
        scheduleMidnightCheck();

        // Initialize workout
        initWorkout();
        initWorkoutTabs();
    }

    // ==================== NAV ====================
    function initNav() {
        const btns = document.querySelectorAll('.sidebar-btn:not(.logout)');
        const titles = { tracker: 'Tracker', notes: 'Notas', finance: 'Finanças', workout: 'Treino', dashboard: 'Dashboard' };
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
                if (v === 'workout') renderWorkout();
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
        h += '<div class="grid-days-scroll">';
        days.forEach(d => {
            const t = same(d, td);
            h += `<div class="cell day-cell${t ? ' is-today' : ''}"><span>${DAYS[d.getDay()]}</span><span class="dn">${d.getDate()}</span></div>`;
        });
        h += '</div>';
        h += '<div class="cell"></div></div>';

        // habit rows
        habits.forEach(hab => {
            const streak = calcStreak(hab.id, rec);
            const trend = calcTrend(hab.id, rec);
            h += `<div class="grid-row habit">`;
            h += `<div class="habit-info">`;
            h += `<div class="h-icon" style="border:1px solid ${hab.color || 'var(--brd)'}">${hab.icon}</div>`;
            h += `<div class="h-meta">`;
            h += `<div class="h-name-row"><span class="h-name">${esc(hab.name)}</span>${trendIcon(trend)}</div>`;
            h += `<div class="h-badges">${streakBadge(streak)}</div>`;
            h += `</div></div>`;

            h += '<div class="grid-days-scroll">';
            days.forEach(d => {
                const t = same(d, td);
                const key = rk(hab.id, d);
                const s = rec[key] || null;
                let cls = 's-btn', txt = '—';
                if (s === 'win') { cls += ' w'; txt = '✓'; }
                else if (s === 'fail') { cls += ' f'; txt = '✗'; }
                h += `<div class="cell day-cell${t ? ' is-today' : ''}"><button class="${cls}" data-h="${hab.id}" data-d="${dk(d)}">${txt}</button></div>`;
            });
            h += '</div>';

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

        const habits = getH(), rec = getR(), td = now();
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

        // Generate extended range: 21 past + today + 7 future = 29 days
        const mobileDays = [];
        for (let i = -21; i <= 7; i++) {
            mobileDays.push(addD(td, i));
        }

        // Auto-select today if not set
        if (mobileSelectedDay === null) {
            mobileSelectedDay = dk(td);
        }

        const selDay = mobileDays.find(d => dk(d) === mobileSelectedDay) || td;

        // Day strip — show month separator labels
        let lastMonth = -1;
        strip.innerHTML = mobileDays.map(d => {
            const isToday = same(d, td);
            const active = dk(d) === mobileSelectedDay;
            let cls = 'mobile-day-btn';
            if (active) cls += ' active';
            if (isToday) cls += ' is-today';
            let monthLabel = '';
            if (d.getMonth() !== lastMonth) {
                monthLabel = `<span class="day-month">${MO[d.getMonth()]}</span>`;
                lastMonth = d.getMonth();
            }
            return `<button class="${cls}" data-dk="${dk(d)}">${monthLabel}<span>${DAYS[d.getDay()]}</span><span class="day-num">${d.getDate()}</span></button>`;
        }).join('');

        strip.querySelectorAll('.mobile-day-btn').forEach(b => {
            b.onclick = () => {
                mobileSelectedDay = b.dataset.dk;
                renderMobileTracker();
            };
        });

        // Scroll active day into view
        requestAnimationFrame(() => {
            const activeBtn = strip.querySelector('.mobile-day-btn.active');
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        });

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
            const trend = calcTrend(hab.id, rec);
            let toggleCls = 'mobile-habit-toggle';
            let toggleTxt = '—';
            if (s === 'win') { toggleCls += ' w'; toggleTxt = '✓'; }
            else if (s === 'fail') { toggleCls += ' f'; toggleTxt = '✗'; }

            html += `<div class="mobile-habit-card${s === 'win' ? ' card-win' : s === 'fail' ? ' card-fail' : ''}">`;
            html += `<div class="mobile-habit-left">`;
            html += `<div class="mobile-habit-icon" style="border:1px solid ${hab.color || 'var(--brd)'}">${hab.icon}</div>`;
            html += `<div class="mobile-habit-meta">`;
            html += `<div class="mobile-habit-name-row"><span class="mobile-habit-name">${esc(hab.name)}</span>${trendIcon(trend)}</div>`;
            html += `<div class="mobile-habit-badges">${streakBadge(streak)}</div>`;
            html += `</div></div>`;
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
    // Store chart data for tooltip interactions
    let chartData = null;
    let chartPoints = null;
    let chartPadding = null;
    let chartDimensions = null;
    let chartHabitsCount = 0;

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
        chartHabitsCount = habits.length;

        if (!habits.length) {
            ctx.fillStyle = '#5a5a67';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Adicione hábitos para ver o progresso', w / 2, ht / 2);
            chartData = null;
            chartPoints = null;
            removeChartTooltip();
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
                wins,
                total: habits.length,
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

        // Store for tooltip
        chartData = data;
        chartPoints = points;
        chartPadding = p;
        chartDimensions = { w, ht, cw, ch };

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

        // Setup tooltip interactions
        setupChartTooltip(canvas, cont);
    }

    // ==================== CHART TOOLTIP ====================
    function removeChartTooltip() {
        const existing = document.querySelector('.chart-tooltip-container');
        if (existing) existing.remove();
    }

    function setupChartTooltip(canvas, cont) {
        // Remove old tooltip elements
        removeChartTooltip();

        // Create tooltip container (overlay)
        const tooltipContainer = document.createElement('div');
        tooltipContainer.className = 'chart-tooltip-container';

        // Crosshair vertical line
        const crosshair = document.createElement('div');
        crosshair.className = 'chart-crosshair';
        tooltipContainer.appendChild(crosshair);

        // Active dot
        const activeDot = document.createElement('div');
        activeDot.className = 'chart-active-dot';
        tooltipContainer.appendChild(activeDot);

        // Tooltip box
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltipContainer.appendChild(tooltip);

        cont.appendChild(tooltipContainer);

        let isActive = false;

        function findClosestPoint(mouseX) {
            if (!chartPoints || !chartData) return -1;
            let minDist = Infinity, closest = -1;
            chartPoints.forEach((pt, i) => {
                const dist = Math.abs(pt.x - mouseX);
                if (dist < minDist) {
                    minDist = dist;
                    closest = i;
                }
            });
            return closest;
        }

        function showTooltip(mouseX) {
            if (!chartData || !chartPoints || !chartPadding) return;
            const idx = findClosestPoint(mouseX);
            if (idx < 0) return;

            const pt = chartPoints[idx];
            const d = chartData[idx];
            const p = chartPadding;
            const dims = chartDimensions;

            isActive = true;
            tooltipContainer.classList.add('active');

            // Position crosshair
            crosshair.style.left = pt.x + 'px';
            crosshair.style.top = p.t + 'px';
            crosshair.style.height = dims.ch + 'px';

            // Position active dot
            activeDot.style.left = pt.x + 'px';
            activeDot.style.top = pt.y + 'px';

            // Format date nicely
            const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            const dateStr = `${dayNames[d.date.getDay()]}, ${d.label}`;

            // Color based on percentage
            const pctColor = d.pct >= 60 ? '#00e676' : d.pct >= 30 ? '#ffcc00' : '#ff3b4f';

            // Tooltip content
            tooltip.innerHTML = `
                <div class="chart-tt-date">${dateStr}</div>
                <div class="chart-tt-pct" style="color:${pctColor}">${d.pct}%</div>
                <div class="chart-tt-detail">${d.wins}/${d.total} hábitos</div>
            `;

            // Position tooltip — avoid overflow
            const ttWidth = 130;
            let ttLeft = pt.x - ttWidth / 2;
            if (ttLeft < 5) ttLeft = 5;
            if (ttLeft + ttWidth > dims.w - 5) ttLeft = dims.w - ttWidth - 5;

            const ttTop = pt.y - 72;
            tooltip.style.left = ttLeft + 'px';
            tooltip.style.top = (ttTop < 2 ? pt.y + 16 : ttTop) + 'px';
        }

        function hideTooltip() {
            isActive = false;
            tooltipContainer.classList.remove('active');
        }

        // Mouse events
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const mouseX = (e.clientX - rect.left);
            showTooltip(mouseX);
        });

        canvas.addEventListener('mouseleave', () => {
            hideTooltip();
        });

        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const mouseX = (touch.clientX - rect.left);
            showTooltip(mouseX);
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const mouseX = (touch.clientX - rect.left);
            showTooltip(mouseX);
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            setTimeout(hideTooltip, 1500);
        });
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

    // ==================== GAMIFICATION HELPERS ====================
    function calcTrend(hid, rec) {
        // Compare last 7 days vs previous 7 days win rate
        const td = now();
        let recentWins = 0, recentTotal = 0, prevWins = 0, prevTotal = 0;
        for (let i = 0; i < 7; i++) {
            const d1 = addD(td, -i);
            const k1 = rk(hid, d1);
            if (rec[k1]) { recentTotal++; if (rec[k1] === 'win') recentWins++; }
            const d2 = addD(td, -(i + 7));
            const k2 = rk(hid, d2);
            if (rec[k2]) { prevTotal++; if (rec[k2] === 'win') prevWins++; }
        }
        const recentRate = recentTotal > 0 ? recentWins / recentTotal : 0;
        const prevRate = prevTotal > 0 ? prevWins / prevTotal : 0;
        if (recentTotal < 2 && prevTotal < 2) return 'neutral';
        if (recentRate > prevRate + 0.05) return 'up';
        if (recentRate < prevRate - 0.05) return 'down';
        return 'neutral';
    }

    function trendIcon(trend) {
        if (trend === 'up') return '<span class="trend-icon trend-up" title="Tendência subindo">▲</span>';
        if (trend === 'down') return '<span class="trend-icon trend-down" title="Tendência descendo">▼</span>';
        return '<span class="trend-icon trend-neutral" title="Estável">◆</span>';
    }

    function streakBadge(streak) {
        if (streak <= 0) return '';
        let level = '', cls = 'streak-badge';
        if (streak >= 30) { level = 'LENDÁRIO'; cls += ' streak-legendary'; }
        else if (streak >= 21) { level = 'ÉPICO'; cls += ' streak-epic'; }
        else if (streak >= 14) { level = 'RARO'; cls += ' streak-rare'; }
        else if (streak >= 7) { level = 'BOM'; cls += ' streak-good'; }
        else { level = streak + 'd'; cls += ' streak-normal'; }
        return `<span class="${cls}">🔥 ${streak}d${level && streak >= 7 ? ' · ' + level : ''}</span>`;
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

    // ==================== WORKOUT ====================
    function initWorkout() {
        const muscleGrid = $('wo-muscle-grid');
        const startBtn = $('wo-start-btn');
        let selectedMuscles = new Set();

        // Render muscle grid
        muscleGrid.innerHTML = MUSCLE_GROUPS.map(mg =>
            `<button class="wo-muscle-chip" data-muscle="${mg.id}">
                <span class="muscle-emoji">${mg.emoji}</span>${mg.name}
            </button>`
        ).join('');

        // Muscle chip toggle
        muscleGrid.querySelectorAll('.wo-muscle-chip').forEach(chip => {
            chip.onclick = () => {
                const mid = chip.dataset.muscle;
                if (selectedMuscles.has(mid)) selectedMuscles.delete(mid);
                else selectedMuscles.add(mid);
                chip.classList.toggle('selected');
                startBtn.disabled = selectedMuscles.size === 0;
                // Deactivate PPL shortcuts if manual selection changes
                document.querySelectorAll('.wo-split-btn').forEach(b => b.classList.remove('active'));
            };
        });

        // PPL Shortcuts
        document.querySelectorAll('.wo-split-btn').forEach(btn => {
            btn.onclick = () => {
                const split = btn.dataset.split;
                document.querySelectorAll('.wo-split-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                selectedMuscles.clear();
                const splitMuscles = MUSCLE_GROUPS.filter(mg => mg.split === split || mg.split === 'all');
                splitMuscles.forEach(mg => selectedMuscles.add(mg.id));

                muscleGrid.querySelectorAll('.wo-muscle-chip').forEach(chip => {
                    chip.classList.toggle('selected', selectedMuscles.has(chip.dataset.muscle));
                });
                startBtn.disabled = false;
            };
        });

        // Start Workout
        startBtn.onclick = () => {
            woActive = {
                startTime: new Date().toISOString(),
                muscles: [...selectedMuscles],
                exercises: []
            };
            renderWorkout();
            startWoTimer();
        };

        // Add Exercise button
        $('wo-add-exercise-btn').onclick = () => openExercisePicker();

        // Finish Workout
        $('wo-finish-btn').onclick = () => {
            if (!woActive) return;
            if (!woActive.exercises.length) {
                if (!confirm('Nenhum exercício adicionado. Finalizar mesmo assim?')) return;
            }
            const workout = {
                id: 'wo_' + Date.now(),
                startTime: woActive.startTime,
                endTime: new Date().toISOString(),
                muscles: woActive.muscles,
                exercises: woActive.exercises,
                duration: Math.floor((new Date() - new Date(woActive.startTime)) / 1000)
            };
            const workouts = getW();
            workouts.unshift(workout);
            svW(workouts);
            woActive = null;
            clearInterval(woTimerInterval);
            woTimerInterval = null;
            renderWorkout();
        };

        // Exercise picker: search
        $('ex-search').oninput = () => renderExerciseList();

        // Exercise picker: custom exercise
        $('ex-custom-add').onclick = () => {
            const name = $('ex-custom-name').value.trim();
            if (!name || !woActive) return;
            const muscle = woActive.muscles[0] || 'peito';
            woActive.exercises.push({ name, muscle, addedAt: new Date().toISOString() });
            $('ex-custom-name').value = '';
            $('exercise-modal').classList.add('hidden');
            renderWorkout();
        };
        $('ex-custom-name').onkeydown = e => { if (e.key === 'Enter') $('ex-custom-add').click(); };

        // Workout detail delete
        $('wo-detail-del').onclick = () => {
            if (!woDetailId) return;
            if (!confirm('Excluir este treino?')) return;
            svW(getW().filter(w => w.id !== woDetailId));
            $('wo-detail-modal').classList.add('hidden');
            woDetailId = null;
            renderWorkout();
        };

        renderWorkout();
    }

    function startWoTimer() {
        clearInterval(woTimerInterval);
        const updateTimer = () => {
            if (!woActive) return;
            const elapsed = Math.floor((new Date() - new Date(woActive.startTime)) / 1000);
            const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            $('wo-timer').textContent = `${h}:${m}:${s}`;
        };
        updateTimer();
        woTimerInterval = setInterval(updateTimer, 1000);
    }

    function fmtDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}min`;
        return `${m}min`;
    }

    function renderWorkout() {
        const activePanel = $('wo-active-panel');
        const startPanel = $('wo-start-panel');

        if (woActive) {
            activePanel.classList.remove('hidden');
            startPanel.classList.add('hidden');

            // Muscles tags
            const musclesHtml = woActive.muscles.map(mid => {
                const mg = MUSCLE_GROUPS.find(m => m.id === mid);
                return mg ? `<span class="wo-muscle-tag">${mg.emoji} ${mg.name}</span>` : '';
            }).join('');
            $('wo-muscles-selected').innerHTML = musclesHtml;

            // Exercise list
            const exHtml = woActive.exercises.map((ex, i) => {
                const mg = MUSCLE_GROUPS.find(m => m.id === ex.muscle);
                const color = mg ? mg.color : '#888';
                const mName = mg ? mg.name : ex.muscle;
                return `<div class="wo-ex-card">
                    <div class="wo-ex-info">
                        <div class="wo-ex-muscle-dot" style="background:${color}"></div>
                        <span class="wo-ex-name">${esc(ex.name)}</span>
                        <span class="wo-ex-muscle-label">${mName}</span>
                    </div>
                    <button class="wo-ex-remove" data-exi="${i}" title="Remover">✕</button>
                </div>`;
            }).join('');

            $('wo-exercise-list').innerHTML = exHtml || '<div class="empty-msg-sm">Toque em <b>+ Exercício</b> para adicionar</div>';

            // Bind remove buttons
            $('wo-exercise-list').querySelectorAll('.wo-ex-remove').forEach(btn => {
                btn.onclick = () => {
                    woActive.exercises.splice(parseInt(btn.dataset.exi), 1);
                    renderWorkout();
                };
            });
        } else {
            activePanel.classList.add('hidden');
            startPanel.classList.remove('hidden');
        }

        renderWorkoutHistory();
    }

    function renderWorkoutHistory() {
        const workouts = getW();
        const container = $('wo-history');
        const emptyEl = $('wo-history-empty');
        const countEl = $('wo-history-count');

        if (!workouts.length) {
            container.innerHTML = '';
            emptyEl.classList.remove('hidden');
            countEl.textContent = '';
            return;
        }
        emptyEl.classList.add('hidden');
        countEl.textContent = `${workouts.length} treino${workouts.length > 1 ? 's' : ''}`;

        container.innerHTML = workouts.slice(0, 30).map(w => {
            const dt = new Date(w.startTime);
            const muscleNames = w.muscles.map(mid => {
                const mg = MUSCLE_GROUPS.find(m => m.id === mid);
                return mg ? mg.emoji + ' ' + mg.name : mid;
            }).join(', ');

            const exTags = w.exercises.slice(0, 4).map(ex =>
                `<span class="wo-h-ex-tag">${esc(ex.name)}</span>`
            ).join('');
            const moreCount = w.exercises.length > 4 ? `<span class="wo-h-ex-more">+${w.exercises.length - 4}</span>` : '';

            return `<div class="wo-history-card" data-wid="${w.id}">
                <div class="wo-h-date">
                    <span class="wo-h-day">${dt.getDate()}</span>
                    <span class="wo-h-month">${MO[dt.getMonth()]}</span>
                </div>
                <div class="wo-h-divider"></div>
                <div class="wo-h-info">
                    <div class="wo-h-top">
                        <span class="wo-h-muscles">${muscleNames}</span>
                        <span class="wo-h-duration">${fmtDuration(w.duration || 0)}</span>
                    </div>
                    <div class="wo-h-exercises">${exTags}${moreCount}</div>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('.wo-history-card').forEach(card => {
            card.onclick = () => openWorkoutDetail(card.dataset.wid);
        });
    }

    function openExercisePicker() {
        if (!woActive) return;
        $('exercise-modal').classList.remove('hidden');
        $('ex-search').value = '';
        $('ex-custom-name').value = '';

        // Muscle tabs
        const tabsContainer = $('ex-muscle-tabs');
        const activeMuscles = woActive.muscles;
        tabsContainer.innerHTML = '<button class="ex-muscle-tab active" data-mtab="all">Todos</button>' +
            activeMuscles.map(mid => {
                const mg = MUSCLE_GROUPS.find(m => m.id === mid);
                return mg ? `<button class="ex-muscle-tab" data-mtab="${mid}">${mg.emoji} ${mg.name}</button>` : '';
            }).join('');

        tabsContainer.querySelectorAll('.ex-muscle-tab').forEach(tab => {
            tab.onclick = () => {
                tabsContainer.querySelectorAll('.ex-muscle-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderExerciseList();
            };
        });

        renderExerciseList();
        setTimeout(() => $('ex-search').focus(), 100);
    }

    function renderExerciseList() {
        if (!woActive) return;
        const search = ($('ex-search').value || '').toLowerCase().trim();
        const activeTab = document.querySelector('.ex-muscle-tab.active');
        const filterMuscle = activeTab ? activeTab.dataset.mtab : 'all';

        let exercises = [];
        const musclesToShow = filterMuscle === 'all' ? woActive.muscles : [filterMuscle];

        musclesToShow.forEach(mid => {
            const exList = EXERCISE_DB[mid] || [];
            exList.forEach(name => {
                if (!search || name.toLowerCase().includes(search)) {
                    exercises.push({ name, muscle: mid });
                }
            });
        });

        const listEl = $('ex-list');
        if (!exercises.length) {
            listEl.innerHTML = '<div class="empty-msg-sm">Nenhum exercício encontrado</div>';
            return;
        }

        listEl.innerHTML = exercises.map(ex => {
            const mg = MUSCLE_GROUPS.find(m => m.id === ex.muscle);
            const color = mg ? mg.color : '#888';
            const mName = mg ? mg.name : ex.muscle;
            return `<div class="ex-item" data-exname="${esc(ex.name)}" data-exmuscle="${ex.muscle}">
                <div class="ex-item-left">
                    <div class="wo-ex-muscle-dot" style="background:${color}"></div>
                    <span class="ex-item-name">${esc(ex.name)}</span>
                    <span class="ex-item-muscle">${mName}</span>
                </div>
                <span class="ex-item-add">+ ADD</span>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.ex-item').forEach(item => {
            item.onclick = () => {
                woActive.exercises.push({
                    name: item.dataset.exname,
                    muscle: item.dataset.exmuscle,
                    addedAt: new Date().toISOString()
                });
                renderWorkout();
                // Visual feedback
                item.style.background = 'var(--grn-bg)';
                item.style.borderColor = 'var(--grn-br)';
                setTimeout(() => {
                    item.style.background = '';
                    item.style.borderColor = '';
                }, 400);
            };
        });
    }

    function openWorkoutDetail(wid) {
        const w = getW().find(x => x.id === wid);
        if (!w) return;
        woDetailId = wid;

        const dt = new Date(w.startTime);
        const dayName = DAYS_F[dt.getDay()];
        $('wo-detail-title').textContent = `Treino — ${dayName}, ${dt.getDate()} ${MO[dt.getMonth()]}`;

        const muscleNames = w.muscles.map(mid => {
            const mg = MUSCLE_GROUPS.find(m => m.id === mid);
            return mg ? mg.emoji + ' ' + mg.name : mid;
        });

        const startHour = new Date(w.startTime);
        const endHour = w.endTime ? new Date(w.endTime) : null;
        const startStr = `${String(startHour.getHours()).padStart(2, '0')}:${String(startHour.getMinutes()).padStart(2, '0')}`;
        const endStr = endHour ? `${String(endHour.getHours()).padStart(2, '0')}:${String(endHour.getMinutes()).padStart(2, '0')}` : '--:--';

        // Get unique muscles from exercises
        const exerciseMuscles = new Set(w.muscles || []);
        w.exercises.forEach(ex => { if (ex.muscle) exerciseMuscles.add(ex.muscle); });

        let html = '';

        // Stats
        html += `<div class="wo-detail-stats">
            <div class="wo-detail-stat">
                <span class="wo-ds-val">${fmtDuration(w.duration || 0)}</span>
                <span class="wo-ds-lbl">Duração</span>
            </div>
            <div class="wo-detail-stat">
                <span class="wo-ds-val">${startStr} - ${endStr}</span>
                <span class="wo-ds-lbl">Horário</span>
            </div>
            <div class="wo-detail-stat">
                <span class="wo-ds-val">${w.exercises.length}</span>
                <span class="wo-ds-lbl">Exercícios</span>
            </div>
        </div>`;

        // ===== MUSCLE BODY VISUALIZER =====
        html += '<div class="wo-detail-section"><div class="wo-detail-label">Músculos Treinados</div>';
        html += '<div class="wo-body-visualizer">';
        html += buildMuscleBodySVG(exerciseMuscles);
        html += '</div>';

        // Muscle tags below visualizer
        html += '<div class="wo-detail-muscles">';
        html += muscleNames.map(n => `<span class="wo-muscle-tag">${n}</span>`).join('');
        html += '</div></div>';

        // Exercises
        if (w.exercises.length) {
            html += '<div class="wo-detail-section"><div class="wo-detail-label">Exercícios Realizados</div>';
            html += '<div class="wo-detail-exercises">';
            html += w.exercises.map(ex => {
                const mg = MUSCLE_GROUPS.find(m => m.id === ex.muscle);
                const color = mg ? mg.color : '#888';
                const mName = mg ? mg.name : ex.muscle;
                return `<div class="wo-detail-ex">
                    <div class="wo-ex-muscle-dot" style="background:${color}"></div>
                    <span class="wo-dex-name">${esc(ex.name)}</span>
                    <span class="wo-dex-muscle">${mName}</span>
                </div>`;
            }).join('');
            html += '</div></div>';
        }

        $('wo-detail-body').innerHTML = html;
        $('wo-detail-modal').classList.remove('hidden');
    }

    // ==================== MUSCLE BODY SVG VISUALIZER ====================
    function buildMuscleBodySVG(activeMuscles) {
        const isActive = (muscleId) => activeMuscles.has(muscleId);
        const activeColor = '#e6002a';
        const activeGlow = 'rgba(230, 0, 42, 0.6)';
        const inactiveColor = '#2a2a3a';
        const outlineColor = '#3a3a4e';

        function mc(muscleId) {
            return isActive(muscleId) ? activeColor : inactiveColor;
        }
        function ms(muscleId) {
            return isActive(muscleId) ? `filter:drop-shadow(0 0 6px ${activeGlow});` : '';
        }
        function mcls(muscleId) {
            return isActive(muscleId) ? 'muscle-active' : 'muscle-inactive';
        }

        // Build front body SVG
        let front = `<div class="wo-body-side"><div class="wo-body-label">FRENTE</div>
        <svg viewBox="0 0 200 400" class="wo-body-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="glow-front">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <!-- Head -->
        <ellipse cx="100" cy="38" rx="22" ry="26" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="1.2"/>
        <!-- Neck -->
        <rect x="90" y="62" width="20" height="14" rx="4" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.8"/>
        
        <!-- Traps (front) -->
        <path d="M80 68 Q72 74 60 82 L68 76 Q76 70 80 68Z" fill="${mc('trapezio')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('trapezio')}" style="${ms('trapezio')}"/>
        <path d="M120 68 Q128 74 140 82 L132 76 Q124 70 120 68Z" fill="${mc('trapezio')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('trapezio')}" style="${ms('trapezio')}"/>
        
        <!-- Shoulders / Deltoids -->
        <ellipse cx="56" cy="92" rx="18" ry="14" fill="${mc('ombro')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('ombro')}" style="${ms('ombro')}"/>
        <ellipse cx="144" cy="92" rx="18" ry="14" fill="${mc('ombro')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('ombro')}" style="${ms('ombro')}"/>
        
        <!-- Chest / Pectorals -->
        <path d="M70 82 Q74 78 100 80 Q126 78 130 82 Q132 98 126 108 Q114 116 100 118 Q86 116 74 108 Q68 98 70 82Z" fill="${mc('peito')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('peito')}" style="${ms('peito')}"/>
        <!-- Chest separation line -->
        <line x1="100" y1="82" x2="100" y2="118" stroke="${outlineColor}" stroke-width="0.6" opacity="0.5"/>
        
        <!-- Biceps -->
        <path d="M42 100 Q36 116 36 136 Q36 148 42 152 Q48 148 48 136 Q48 116 44 100Z" fill="${mc('biceps')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('biceps')}" style="${ms('biceps')}"/>
        <path d="M158 100 Q164 116 164 136 Q164 148 158 152 Q152 148 152 136 Q152 116 156 100Z" fill="${mc('biceps')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('biceps')}" style="${ms('biceps')}"/>
        
        <!-- Forearms -->
        <path d="M38 154 Q34 170 32 190 Q30 204 34 210 Q40 206 40 190 Q42 170 42 154Z" fill="${mc('antebraco')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('antebraco')}" style="${ms('antebraco')}"/>
        <path d="M162 154 Q166 170 168 190 Q170 204 166 210 Q160 206 160 190 Q158 170 158 154Z" fill="${mc('antebraco')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('antebraco')}" style="${ms('antebraco')}"/>
        
        <!-- Abs / Core -->
        <path d="M82 120 Q80 148 80 180 Q82 204 84 216 Q92 220 100 222 Q108 220 116 216 Q118 204 120 180 Q120 148 118 120 Q110 118 100 118 Q90 118 82 120Z" fill="${mc('abdominais')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('abdominais')}" style="${ms('abdominais')}"/>
        <!-- Abs lines -->
        <line x1="100" y1="122" x2="100" y2="216" stroke="${outlineColor}" stroke-width="0.5" opacity="0.5"/>
        <line x1="84" y1="140" x2="116" y2="140" stroke="${outlineColor}" stroke-width="0.4" opacity="0.4"/>
        <line x1="83" y1="158" x2="117" y2="158" stroke="${outlineColor}" stroke-width="0.4" opacity="0.4"/>
        <line x1="82" y1="176" x2="118" y2="176" stroke="${outlineColor}" stroke-width="0.4" opacity="0.4"/>
        <line x1="82" y1="194" x2="118" y2="194" stroke="${outlineColor}" stroke-width="0.4" opacity="0.4"/>
        
        <!-- Quadriceps -->
        <path d="M76 224 Q72 250 70 280 Q68 304 72 312 Q78 316 84 312 Q88 300 90 280 Q90 250 88 224Z" fill="${mc('quadriceps')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('quadriceps')}" style="${ms('quadriceps')}"/>
        <path d="M124 224 Q128 250 130 280 Q132 304 128 312 Q122 316 116 312 Q112 300 110 280 Q110 250 112 224Z" fill="${mc('quadriceps')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('quadriceps')}" style="${ms('quadriceps')}"/>
        
        <!-- Knees -->
        <ellipse cx="82" cy="318" rx="10" ry="8" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.8"/>
        <ellipse cx="118" cy="318" rx="10" ry="8" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.8"/>
        
        <!-- Calves (front) -->
        <path d="M74 328 Q70 348 70 366 Q70 380 74 388 Q80 390 84 386 Q88 378 90 366 Q90 348 88 328Z" fill="${mc('panturrilha')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('panturrilha')}" style="${ms('panturrilha')}"/>
        <path d="M126 328 Q130 348 130 366 Q130 380 126 388 Q120 390 116 386 Q112 378 110 366 Q110 348 112 328Z" fill="${mc('panturrilha')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('panturrilha')}" style="${ms('panturrilha')}"/>
        
        <!-- Hands -->
        <ellipse cx="32" cy="218" rx="6" ry="8" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        <ellipse cx="168" cy="218" rx="6" ry="8" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        
        <!-- Feet -->
        <ellipse cx="80" cy="396" rx="10" ry="4" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        <ellipse cx="120" cy="396" rx="10" ry="4" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        </svg></div>`;

        // Build back body SVG
        let back = `<div class="wo-body-side"><div class="wo-body-label">COSTAS</div>
        <svg viewBox="0 0 200 400" class="wo-body-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="glow-back">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <!-- Head -->
        <ellipse cx="100" cy="38" rx="22" ry="26" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="1.2"/>
        <!-- Neck -->
        <rect x="90" y="62" width="20" height="14" rx="4" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.8"/>
        
        <!-- Traps -->
        <path d="M80 68 Q72 74 56 86 L58 82 Q70 74 80 68Z M120 68 Q128 74 144 86 L142 82 Q130 74 120 68Z" fill="${mc('trapezio')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('trapezio')}" style="${ms('trapezio')}"/>
        <path d="M80 68 L84 76 Q92 82 100 82 Q108 82 116 76 L120 68 Q110 66 100 66 Q90 66 80 68Z" fill="${mc('trapezio')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('trapezio')}" style="${ms('trapezio')}"/>
        
        <!-- Rear Deltoids -->
        <ellipse cx="56" cy="92" rx="18" ry="14" fill="${mc('ombro')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('ombro')}" style="${ms('ombro')}"/>
        <ellipse cx="144" cy="92" rx="18" ry="14" fill="${mc('ombro')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('ombro')}" style="${ms('ombro')}"/>
        
        <!-- Back / Lats -->
        <path d="M70 82 Q74 78 100 80 Q126 78 130 82 Q136 100 134 120 Q130 146 126 170 Q118 184 100 186 Q82 184 74 170 Q70 146 66 120 Q64 100 70 82Z" fill="${mc('costas')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('costas')}" style="${ms('costas')}"/>
        <!-- Back separation line -->
        <line x1="100" y1="82" x2="100" y2="186" stroke="${outlineColor}" stroke-width="0.6" opacity="0.5"/>
        <!-- Lats detail lines -->
        <path d="M74 110 Q80 120 86 130" fill="none" stroke="${outlineColor}" stroke-width="0.4" opacity="0.4"/>
        <path d="M126 110 Q120 120 114 130" fill="none" stroke="${outlineColor}" stroke-width="0.4" opacity="0.4"/>
        
        <!-- Triceps -->
        <path d="M42 100 Q36 116 36 140 Q36 152 42 156 Q48 152 48 140 Q48 116 44 100Z" fill="${mc('triceps')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('triceps')}" style="${ms('triceps')}"/>
        <path d="M158 100 Q164 116 164 140 Q164 152 158 156 Q152 152 152 140 Q152 116 156 100Z" fill="${mc('triceps')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('triceps')}" style="${ms('triceps')}"/>
        
        <!-- Forearms -->
        <path d="M38 158 Q34 174 32 194 Q30 208 34 214 Q40 210 40 194 Q42 174 42 158Z" fill="${mc('antebraco')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('antebraco')}" style="${ms('antebraco')}"/>
        <path d="M162 158 Q166 174 168 194 Q170 208 166 214 Q160 210 160 194 Q158 174 158 158Z" fill="${mc('antebraco')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('antebraco')}" style="${ms('antebraco')}"/>
        
        <!-- Lower back -->
        <path d="M82 188 Q80 200 80 214 Q82 222 90 224 Q96 226 100 226 Q104 226 110 224 Q118 222 120 214 Q120 200 118 188 Q110 186 100 186 Q90 186 82 188Z" fill="${mc('costas')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('costas')}" style="${ms('costas')}"/>
        
        <!-- Glutes -->
        <path d="M76 224 Q72 234 72 244 Q72 256 78 260 Q84 262 90 258 Q94 252 94 244 Q94 234 92 224Z" fill="${mc('gluteos')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('gluteos')}" style="${ms('gluteos')}"/>
        <path d="M124 224 Q128 234 128 244 Q128 256 122 260 Q116 262 110 258 Q106 252 106 244 Q106 234 108 224Z" fill="${mc('gluteos')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('gluteos')}" style="${ms('gluteos')}"/>
        
        <!-- Hamstrings -->
        <path d="M74 262 Q70 284 70 306 Q70 316 76 318 Q82 316 86 306 Q88 284 88 262Z" fill="${mc('posterior')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('posterior')}" style="${ms('posterior')}"/>
        <path d="M126 262 Q130 284 130 306 Q130 316 124 318 Q118 316 114 306 Q112 284 112 262Z" fill="${mc('posterior')}" stroke="${outlineColor}" stroke-width="1" class="${mcls('posterior')}" style="${ms('posterior')}"/>
        
        <!-- Knees -->
        <ellipse cx="82" cy="322" rx="10" ry="6" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.8"/>
        <ellipse cx="118" cy="322" rx="10" ry="6" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.8"/>
        
        <!-- Calves (back) -->
        <path d="M74 330 Q68 350 68 368 Q68 380 74 388 Q80 392 86 386 Q90 374 90 368 Q92 350 88 330Z" fill="${mc('panturrilha')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('panturrilha')}" style="${ms('panturrilha')}"/>
        <path d="M126 330 Q132 350 132 368 Q132 380 126 388 Q120 392 114 386 Q110 374 110 368 Q108 350 112 330Z" fill="${mc('panturrilha')}" stroke="${outlineColor}" stroke-width="0.8" class="${mcls('panturrilha')}" style="${ms('panturrilha')}"/>
        
        <!-- Hands -->
        <ellipse cx="32" cy="222" rx="6" ry="8" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        <ellipse cx="168" cy="222" rx="6" ry="8" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        
        <!-- Feet -->
        <ellipse cx="80" cy="396" rx="10" ry="4" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        <ellipse cx="120" cy="396" rx="10" ry="4" fill="${inactiveColor}" stroke="${outlineColor}" stroke-width="0.6"/>
        </svg></div>`;

        return front + back;
    }

    // ==================== WORKOUT TABS ====================
    function initWorkoutTabs() {
        const tabs = document.querySelectorAll('.wo-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.wo-tab-content').forEach(c => c.classList.add('hidden'));
                const target = tab.dataset.woTab;
                $(`wo-tab-${target}`).classList.remove('hidden');
                if (target === 'coach' && !coachInitialized) {
                    initCoach();
                }
            };
        });
    }

    // ==================== VEGETA COACH ====================
    let coachInitialized = false;
    let coachMessages = [];

    const VEGETA_RESPONSES = {
        greetings: [
            "Hmph... Então você veio treinar comigo? Bom, pelo menos tem bom gosto. Eu sou o Príncipe dos Saiyajins! Não espere que eu pegue leve com você, inseto! 💪",
            "Escute bem, verme! Eu não perco meu tempo com fracos. Se você está aqui, é melhor dar TUDO de si! Caso contrário... FINAL FLASH! 🔥",
            "Hmpf! Mais um terrestre querendo ficar forte? Está bem... Eu, Vegeta, o Príncipe de todos os Saiyajins, vou transformar esse corpo patético! Não me decepcione! ⚡"
        ],
        'treino-push': [
            `ESCUTE BEM, INSETO! Hoje vamos destruir Peito, Ombro e Tríceps! Um verdadeiro guerreiro não pula o treino de PUSH!\n\n🫁 **PEITO:**\n• Supino Reto — 4x8-10 (PESO PESADO, sem choro!)\n• Supino Inclinado — 4x10\n• Crossover — 3x12-15\n• Flexão — 3 séries até a FALHA!\n\n🏔️ **OMBRO:**\n• Desenvolvimento — 4x8-10\n• Elevação Lateral — 4x12-15\n• Elevação Frontal — 3x12\n\n💪 **TRÍCEPS:**\n• Tríceps Corda — 4x12\n• Tríceps Testa — 3x10\n• Mergulho — 3 séries até FALHA!\n\nDescanso: 60-90s entre séries. Se você descansar mais que isso, eu vou te mandar pro outro mundo com um Big Bang Attack! 💥`,
            `Hmph! Então quer treino de PUSH? Está certo! Eu treinava na Câmara de Gravidade a 500G, então não reclame!\n\n🫁 **PEITO — Destruição Total:**\n• Supino Reto — 5x6 (carga MÁXIMA!)\n• Crucifixo Inclinado — 4x10\n• Peck Deck — 3x12\n• Voador — 3x15 (queimação!)\n\n🏔️ **OMBRO — Poder Saiyajin:**\n• Arnold Press — 4x10\n• Elevação Lateral — 5x15\n• Face Pull — 3x15\n\n💪 **TRÍCEPS — Armas de Guerra:**\n• Tríceps Francês — 4x10\n• Tríceps Barra — 3x12\n• Tríceps Coice — 3x12\n\nEsse é o treino de um PRÍNCIPE! Agora vá e supere seus limites! 👑`
        ],
        'treino-pull': [
            `Hmpf! Dia de PULL! Costas e Bíceps! Se o Kakaroto consegue fazer barra, VOCÊ TAMBÉM CONSEGUE!\n\n🔙 **COSTAS — Muralha Saiyajin:**\n• Puxada Frontal — 4x10\n• Remada Curvada — 4x8-10 (PESADO!)\n• Remada Cavaleiro — 3x10\n• Pullover — 3x12\n• Pull-up — 3 séries até FALHA!\n\n💪 **BÍCEPS — Braços de Guerreiro:**\n• Rosca Direta — 4x10\n• Rosca Martelo — 3x12\n• Rosca Scott — 3x10\n• Rosca Concentrada — 3x12\n\n🔺 **TRAPÉZIO:**\n• Encolhimento Halteres — 4x15\n• Face Pull — 3x15\n\nSe suas costas não doerem amanhã, é porque você treinou como um verme! SUPERE SEUS LIMITES! ⚡`,
            `Escuta aqui, terrestre! Treino de PULL é onde se forja as verdadeiras COSTAS DE GUERREIRO!\n\n🔙 **COSTAS:**\n• Barra Fixa — 4x falha\n• Remada Baixa — 4x10\n• Puxada Triângulo — 3x12\n• Remada Unilateral — 3x10 cada lado\n\n💪 **BÍCEPS:**\n• Rosca Barra W — 4x10\n• Rosca Alternada — 3x12\n• Rosca Inversa — 3x12\n\n🔺 **TRAPÉZIO:**\n• Encolhimento Barra — 4x12\n• Farmer Walk — 3x30s\n\nKakaroto pode ter o Ultra Instinto, mas NINGUÉM tem costas como as MINHAS! 💪`
        ],
        'treino-legs': [
            `HAHAHAHA! DIA DE PERNA! O dia que separa os GUERREIROS dos INSETOS! Não ouse pular esse treino!\n\n🦵 **QUADRÍCEPS — PODER SAIYAJIN:**\n• Agachamento Livre — 5x6-8 (PESADO OU VÁ EMBORA!)\n• Leg Press — 4x10-12\n• Cadeira Extensora — 4x12\n• Afundo — 3x10 cada perna\n\n🦵 **POSTERIOR:**\n• Stiff — 4x10\n• Cadeira Flexora — 4x12\n• Mesa Flexora — 3x12\n\n🍑 **GLÚTEOS:**\n• Hip Thrust — 4x12\n• Búlgaro — 3x10 cada perna\n\n🦶 **PANTURRILHA:**\n• Panturrilha em Pé — 5x15\n• Panturrilha Sentado — 4x20\n\nPernas fracas = Guerreiro FRACO! O poder vem do CHÃO! Agora AGACHE! 🔥`,
            `Hmph! Então quer treinar pernas? Ótimo! Na câmara de gravidade 500G, cada agachamento era um teste de SOBREVIVÊNCIA!\n\n🦵 **QUADRÍCEPS:**\n• Agachamento Frontal — 4x8\n• Agachamento Hack — 4x10\n• Passada — 3x12 cada perna\n• Sissy Squat — 3x15\n\n🦵 **POSTERIOR:**\n• Levantamento Terra — 4x6 (PESADO!)\n• Good Morning — 3x10\n• Leg Curl Deitado — 3x12\n\n🍑 **GLÚTEOS:**\n• Agachamento Sumô — 4x12\n• Elevação Pélvica — 3x15\n• Kickback — 3x12\n\n🦶 **PANTURRILHA:**\n• Panturrilha no Leg Press — 4x15\n• Panturrilha Unilateral — 3x15\n\nQuem pula leg day NÃO MERECE ser chamado de guerreiro! 👑`
        ],
        motivacao: [
            "ESCUTE BEM, VERME! Eu perdi para o Kakaroto INÚMERAS vezes, mas NUNCA desisti! Cada derrota me tornou mais FORTE! Eu sou o Príncipe dos Saiyajins, e meu orgulho NUNCA me deixa parar! Agora levante essa bunda do sofá e vá TREINAR! 🔥💥⚡",
            "Hmph! Quer desistir? PATÉTICO! Quando eu explodia planetas inteiros, achava que ninguém seria páreo pra mim. Mas o Kakaroto me mostrou que SEMPRE há um nível acima! Cada repetição te leva mais perto de SUPERAR SEUS LIMITES! Agora PARE DE RECLAMAR E TREINE! 👑",
            "Um verdadeiro guerreiro NÃO PRECISA de motivação! A motivação vem e vai como o vento. O que você precisa é de DISCIPLINA e ORGULHO! Eu treino TODOS os dias, mesmo quando meu corpo diz NÃO! Você acha que foi fácil alcançar o Super Saiyajin Blue? NADA É FÁCIL! AGORA VÁ! 💪🔥",
            "Você está perdendo tempo pedindo motivação quando deveria estar AGACHANDO! Cada segundo parado é um segundo que o Kakaroto está ficando MAIS FORTE que você! Você quer ser um verme para sempre? LEVANTE-SE E LUTE! FINAL FLASH dessa preguiça! ⚡💥",
            "Tsc! Nos dias mais difíceis, lembre-se: EU, Vegeta, nascido princípe da raça mais poderosa do universo... tive que engolir meu orgulho VÁRIAS vezes. Mas NUNCA parei de treinar! Cada gota de suor é um passo para SUPERAR A SI MESMO! Agora MOSTRE SEU PODER! 🔥👑"
        ],
        aquecimento: [
            "Hmph! Aquecimento? Eu normalmente já começo DESTRUINDO, mas até mesmo um Saiyajin precisa aquecer... NÃO CONTE A NINGUÉM QUE EU DISSE ISSO!\n\n♨️ **AQUECIMENTO (10 min):**\n1. 🏃 Esteira leve ou pular corda — 3 min\n2. 🔄 Rotação de ombros — 20 reps\n3. 🔄 Rotação de quadril — 15 cada lado\n4. 🦵 Agachamento sem peso — 15 reps\n5. 💪 Flexão — 10 reps leves\n6. 🧘 Alongamento dinâmico — 2 min\n7. ⬆️ Elevação lateral leve — 12 reps\n\nDepois disso, faça 1-2 séries de aquecimento do primeiro exercício com 50% da carga. Não quero ver nenhum inseto se machucando por ESTUPIDEZ! 🔥"
        ],
        descanso: [
            "DESCANSO?! Hmph! Está bem, até eu preciso descansar às vezes... MAS NÃO MUITO!\n\n⏱️ **TEMPOS IDEAIS DE DESCANSO:**\n\n• **Força (1-5 reps, pesado):** 2-3 minutos\n• **Hipertrofia (8-12 reps):** 60-90 segundos\n• **Resistência (15+ reps):** 30-60 segundos\n• **Compostos pesados** (Agachamento, Terra): 2-3 min\n• **Isolados** (Rosca, Extensora): 45-60 seg\n\n⚠️ Se você descansa MAIS de 3 minutos, não está treinando — está PASSEANDO na academia! Eu treino na câmara de gravidade sem parar! Mas... eu sou um Saiyajin. Você pode descansar... UM POUCO! 💪"
        ]
    };

    const VEGETA_KEYWORD_RESPONSES = [
        {
            keywords: ['peito', 'supino', 'peitoral', 'chest'],
            responses: [
                "Peito, hein? Bom! Supino Reto é a BASE! 4 séries de 8-10 reps com carga que te faça SOFRER! Depois Crucifixo Inclinado 4x10, e Crossover 3x12. Um Saiyajin de verdade NUNCA pula supino! 💪🔥",
                "Hmph! Quer desenvolver peito? Comece com Supino Inclinado 4x8 (foca a parte superior!), depois Peck Deck 3x12 e termine com Flexão até a FALHA! Se não doer, você está fazendo ERRADO, inseto! 🫁"
            ]
        },
        {
            keywords: ['costas', 'dorsal', 'barra', 'puxada', 'back'],
            responses: [
                "COSTAS! A parte mais NOBRE do corpo de um guerreiro! Puxada Frontal 4x10, Remada Curvada 4x8 PESADA, e termine com Pull-up até a falha! Costas largas = PRESENÇA DE GUERREIRO! 🔙⚡",
                "Se quer costas de guerreiro Saiyajin, faça: Barra Fixa 4x falha, Remada Cavaleiro 4x10, Pullover 3x12. NADA constrói poder como as remadas! 💪"
            ]
        },
        {
            keywords: ['biceps', 'braco', 'braço', 'rosca', 'arm'],
            responses: [
                "Bíceps? Tsc! Rosca Direta 4x10 com barra, Rosca Martelo 3x12 e Rosca Concentrada 3x12. E NADA de ficar balançando o corpo! Execução PERFEITA ou nem faça, verme! 💪",
                "Hmph! Quer braços de guerreiro? Rosca Scott 4x10 (sem trapacear!), Rosca Alternada 3x12 e termine com Rosca Inversa para os antebraços. UM SAIYAJIN USA TODOS OS MÚSCULOS! ⚡"
            ]
        },
        {
            keywords: ['triceps', 'tríceps'],
            responses: [
                "Tríceps é 2/3 do braço, IDIOTA! Se quer braço grande, FOQUE NO TRÍCEPS! Tríceps Corda 4x12, Tríceps Testa 3x10 e Mergulho 3x falha! AGORA VÁ! 💪🔥"
            ]
        },
        {
            keywords: ['perna', 'pernas', 'agachamento', 'legs', 'quadriceps'],
            responses: [
                "DIA DE PERNA! O dia mais GLORIOSO! Agachamento Livre 5x6, Leg Press 4x10, Cadeira Extensora 4x12! Se você pula leg day, VOCÊ É MAIS FRACO QUE O YAMCHA! 🦵🔥",
                "HAHAHA! Perna fraca = Guerreiro PATÉTICO! Agachamento Frontal 4x8, Stiff 4x10, Hip Thrust 4x12, Panturrilha 5x15! O poder vem do CHÃO! 🦵⚡"
            ]
        },
        {
            keywords: ['ombro', 'ombros', 'deltóide', 'shoulder'],
            responses: [
                "OMBROS LARGOS é o que faz um guerreiro parecer PODEROSO! Desenvolvimento Militar 4x8, Elevação Lateral 5x15, Arnold Press 3x10! Ombros de guerreiro Saiyajin! 🏔️💪"
            ]
        },
        {
            keywords: ['abdomen', 'abdômen', 'abdominal', 'abs', 'barriga', 'tanquinho'],
            responses: [
                "Abdômen?! Prancha 3x1min, Abdominal Crunch 4x20, Elevação de Pernas 3x15, Russian Twist 3x20! Mas escuta: ABDÔMEN SE FAZ NA COZINHA, inseto! Para de comer porcaria! 🎯🔥"
            ]
        },
        {
            keywords: ['dieta', 'comer', 'alimentação', 'comida', 'proteina', 'proteína', 'nutrição'],
            responses: [
                "Hmph! Quer saber de dieta? UM SAIYAJIN COME MUITO! Mas com QUALIDADE! Proteína em TODAS as refeições — frango, ovos, carne! Arroz e batata para energia! Verduras porque... até guerreiros precisam de vitaminas! E NADA de junk food, INSETO! 🥗👑",
                "Dieta de um guerreiro Saiyajin: 2g de proteína por kg de peso, carboidratos complexos antes do treino, e MUITA comida! Eu como literalmente TONELADAS! Mas controlado! Nada de besteira! 🍗💪"
            ]
        },
        {
            keywords: ['dormir', 'sono', 'descansar', 'recovery', 'recuperação'],
            responses: [
                "Tsc! Até mesmo o Príncipe dos Saiyajins precisa dormir! 7-8 horas por noite, MÍNIMO! Os músculos crescem NO DESCANSO, não no treino, seu verme ignorante! Sem descanso adequado, você está PERDENDO TEMPO na academia! 😤💤"
            ]
        },
        {
            keywords: ['goku', 'kakaroto', 'kakarot'],
            responses: [
                "NÃO ME FALE DO KAKAROTO! Aquele... aquele Saiyajin de classe baixa! Sempre um passo à minha frente! MAS EU VOU SUPERÁ-LO! E VOCÊ VAI ME AJUDAR NESSE TREINO! AGORA FOCO! 😤⚡💥",
                "Kakaroto?! COMO OUSA mencionar esse nome na minha presença?! Ele pode ter o Ultra Instinto, mas EU tenho o Ultra Ego! E meu ORGULHO é minha maior arma! Agora PARE de falar dele e TREINE! 👑🔥"
            ]
        },
        {
            keywords: ['obrigado', 'valeu', 'thanks', 'brigado'],
            responses: [
                "Hmph! Não me agradeça, inseto! Eu não faço isso por VOCÊ! Eu faço porque um verdadeiro guerreiro forja OUTROS guerreiros! Agora pare de ser sentimental e VÁ TREINAR! 😤💪",
                "Tsc! Sentimentalismo é coisa de TERRESTRE FRACO! Não preciso dos seus agradecimentos. A única recompensa que aceito é ver você SUPERANDO SEUS LIMITES! Agora SAIA DAQUI e TREINE! 👑"
            ]
        }
    ];

    const VEGETA_FALLBACK = [
        "Hmph! Não entendi sua pergunta patética! Fala direito, inseto! Pergunte sobre TREINOS, EXERCÍCIOS ou peça MOTIVAÇÃO! Um Saiyajin não perde tempo com conversa fiada! 😤",
        "Tsc! Eu não sou seu amiguinho de conversa, VERME! Me pergunte sobre treinos de Push, Pull, Legs, exercícios específicos ou peça motivação! Foco no que IMPORTA! 💪",
        "Você está desperdiçando o tempo do PRÍNCIPE DOS SAIYAJINS com essa pergunta?! Pergunte sobre TREINOS ou exercícios! Ou use os botões rápidos aí embaixo! 👑",
        "INSETO! Se não sabe o que perguntar, use os atalhos de treino! Push, Pull ou Legs! Ou peça motivação! Não tenho PACIÊNCIA pra conversa fiada! ⚡🔥"
    ];

    function initCoach() {
        if (coachInitialized) return;
        coachInitialized = true;

        // Welcome message
        const greeting = VEGETA_RESPONSES.greetings[Math.floor(Math.random() * VEGETA_RESPONSES.greetings.length)];
        addCoachMessage('vegeta', greeting);

        // Quick action buttons
        document.querySelectorAll('.coach-quick-btn').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                addCoachMessage('user', btn.textContent.trim());
                setTimeout(() => {
                    processCoachAction(action);
                }, 400);
            };
        });

        // Send message
        $('coach-send').onclick = () => sendCoachMessage();
        $('coach-input').onkeydown = e => { if (e.key === 'Enter') sendCoachMessage(); };
    }

    function sendCoachMessage() {
        const input = $('coach-input');
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        addCoachMessage('user', msg);
        setTimeout(() => {
            const response = getVegetaResponse(msg);
            addCoachMessage('vegeta', response);
        }, 600 + Math.random() * 800);
    }

    function processCoachAction(action) {
        const responses = VEGETA_RESPONSES[action];
        if (responses) {
            const resp = responses[Math.floor(Math.random() * responses.length)];
            addCoachMessage('vegeta', resp);
        }
    }

    function getVegetaResponse(msg) {
        const lower = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Check keyword responses
        for (const entry of VEGETA_KEYWORD_RESPONSES) {
            for (const kw of entry.keywords) {
                const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (lower.includes(kwNorm)) {
                    return entry.responses[Math.floor(Math.random() * entry.responses.length)];
                }
            }
        }

        // Check for action keywords
        if (lower.includes('push') || (lower.includes('peito') && lower.includes('ombro'))) {
            return VEGETA_RESPONSES['treino-push'][Math.floor(Math.random() * VEGETA_RESPONSES['treino-push'].length)];
        }
        if (lower.includes('pull') || (lower.includes('costa') && lower.includes('bicep'))) {
            return VEGETA_RESPONSES['treino-pull'][Math.floor(Math.random() * VEGETA_RESPONSES['treino-pull'].length)];
        }
        if (lower.includes('legs') || lower.includes('perna')) {
            return VEGETA_RESPONSES['treino-legs'][Math.floor(Math.random() * VEGETA_RESPONSES['treino-legs'].length)];
        }
        if (lower.includes('motiv') || lower.includes('animo') || lower.includes('desanima') || lower.includes('pregui')) {
            return VEGETA_RESPONSES.motivacao[Math.floor(Math.random() * VEGETA_RESPONSES.motivacao.length)];
        }
        if (lower.includes('aquec') || lower.includes('warm')) {
            return VEGETA_RESPONSES.aquecimento[0];
        }
        if (lower.includes('descanso') || lower.includes('intervalo') || lower.includes('rest') || lower.includes('pausa')) {
            return VEGETA_RESPONSES.descanso[0];
        }
        if (lower.includes('ola') || lower.includes('oi') || lower.includes('hey') || lower.includes('eai') || lower.includes('fala')) {
            return VEGETA_RESPONSES.greetings[Math.floor(Math.random() * VEGETA_RESPONSES.greetings.length)];
        }

        // Fallback
        return VEGETA_FALLBACK[Math.floor(Math.random() * VEGETA_FALLBACK.length)];
    }

    function addCoachMessage(sender, text) {
        const chat = $('coach-chat');
        const msgEl = document.createElement('div');
        msgEl.className = `coach-msg coach-msg-${sender}`;

        if (sender === 'vegeta') {
            // Show typing indicator first
            const typingEl = document.createElement('div');
            typingEl.className = 'coach-msg coach-msg-vegeta coach-typing';
            typingEl.innerHTML = `
                <div class="coach-msg-avatar">
                    <img src="public/images/vegeta_png.png" alt="V">
                </div>
                <div class="coach-msg-bubble">
                    <div class="typing-dots"><span></span><span></span><span></span></div>
                </div>`;
            chat.appendChild(typingEl);
            chat.scrollTop = chat.scrollHeight;

            setTimeout(() => {
                typingEl.remove();
                // Format text with markdown-lite
                const formatted = text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>');

                msgEl.innerHTML = `
                    <div class="coach-msg-avatar">
                        <img src="public/images/vegeta_png.png" alt="V">
                    </div>
                    <div class="coach-msg-bubble">${formatted}</div>`;
                chat.appendChild(msgEl);
                chat.scrollTop = chat.scrollHeight;
            }, 800 + Math.random() * 600);
        } else {
            msgEl.innerHTML = `<div class="coach-msg-bubble">${esc(text)}</div>`;
            chat.appendChild(msgEl);
            chat.scrollTop = chat.scrollHeight;
        }

        coachMessages.push({ sender, text, time: new Date().toISOString() });
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
