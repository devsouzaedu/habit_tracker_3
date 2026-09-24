-- =====================================================
-- LISTA DE ESPERA (idempotente: pode rodar mais de uma vez)
-- Execute no SQL Editor: https://supabase.com/dashboard → SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS waitlist (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL,
    instagram TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT waitlist_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
    CONSTRAINT waitlist_instagram_format CHECK (instagram ~ '^[a-z0-9._]{1,30}$')
);

-- Um cadastro por email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_key ON waitlist (lower(email));

-- RLS: visitantes anônimos só podem INSERIR; ninguém lê pela API pública.
-- Consulte os inscritos pelo Table Editor do Supabase (usa service role).
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist;
CREATE POLICY "Anyone can join waitlist" ON waitlist
    FOR INSERT TO anon, authenticated WITH CHECK (true);

REVOKE ALL ON waitlist FROM anon, authenticated;
GRANT INSERT (email, instagram) ON waitlist TO anon, authenticated;
