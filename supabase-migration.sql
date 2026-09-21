-- =====================================================
-- MIGRAÇÃO PARA SUPABASE AUTH + RLS  (idempotente: pode rodar mais de uma vez)
-- Execute no SQL Editor: https://supabase.com/dashboard → SQL Editor
-- =====================================================

-- 1. Coluna user_id vinculada ao Supabase Auth
ALTER TABLE user_data
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. UNIQUE em user_id (obrigatório: o app faz upsert com onConflict: 'user_id').
--    Linhas legadas com user_id NULL não conflitam entre si.
CREATE UNIQUE INDEX IF NOT EXISTS user_data_user_id_key ON user_data (user_id);

-- 3. A coluna legada "key" deixa de ser obrigatória (o app ainda a preenche com o UUID)
ALTER TABLE user_data ALTER COLUMN key DROP NOT NULL;

-- 4. Liga o RLS e remove TODAS as políticas antigas (inclui "Allow all for anon")
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'user_data'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.user_data', pol.policyname);
    END LOOP;
END $$;

-- 5. Políticas seguras: só usuários logados, só a própria linha
CREATE POLICY "Users can view own data" ON user_data
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON user_data
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON user_data
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON user_data
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Garante que o papel anônimo não tem acesso direto à tabela
REVOKE ALL ON user_data FROM anon;

-- 6. Perfis (opcional)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    legacy_user_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
CREATE POLICY "Users can manage own profile" ON user_profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
REVOKE ALL ON user_profiles FROM anon;

-- 7. KEEP-ALIVE: o bot do GitHub Actions usa a anon key, que não escreve mais em user_data.
--    Ele chama esta função (SECURITY DEFINER), que grava numa tabela interna própria.
CREATE TABLE IF NOT EXISTS keepalive (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ping_count BIGINT NOT NULL DEFAULT 0
);
ALTER TABLE keepalive ENABLE ROW LEVEL SECURITY;   -- sem políticas = ninguém acessa direto
REVOKE ALL ON keepalive FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.keepalive_ping()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO keepalive (id, last_ping, ping_count) VALUES (1, NOW(), 1)
    ON CONFLICT (id) DO UPDATE
        SET last_ping = NOW(), ping_count = keepalive.ping_count + 1
    RETURNING last_ping;
$$;

REVOKE ALL ON FUNCTION public.keepalive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive_ping() TO anon;

-- 8. Limpeza da linha antiga do keep-alive (a antiga escrevia key='_keepalive' em user_data)
DELETE FROM user_data WHERE key = '_keepalive' AND user_id IS NULL;

-- =====================================================
-- DADOS LEGADOS (usuários do sistema antigo "ID + senha")
-- Linhas com user_id NULL ficam inacessíveis pelo app (RLS) e guardam
-- SENHA EM TEXTO PURO dentro do JSON. Depois de conferir/exportar o que precisa:
--
--   SELECT key, updated_at FROM user_data WHERE user_id IS NULL;   -- revisar
--   DELETE FROM user_data WHERE user_id IS NULL;                   -- apagar
--
-- (não executado automaticamente de propósito)
-- =====================================================
