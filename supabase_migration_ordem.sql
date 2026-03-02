-- Coluna ordem em contratacoes (navegação rápida)
-- Execute no SQL Editor do Supabase

-- ============================================================
-- MIGRAÇÃO INICIAL (já executada - manter para referência)
-- ============================================================
-- ALTER TABLE contratacoes ADD COLUMN IF NOT EXISTS ordem SERIAL;
-- CREATE INDEX IF NOT EXISTS idx_contratacoes_ordem ON contratacoes(ordem);

-- ============================================================
-- CORREÇÃO: Renumera ordem de 1 a N sequencialmente
-- Execute este bloco para corrigir valores altos na coluna ordem
-- ============================================================

-- 1. Renumera todos os registros sequencialmente (1, 2, 3, ...) ordenados por num_ativa
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY 
      CASE 
        WHEN num_ativa IS NOT NULL AND (num_ativa::text) ~ '^\d+$' THEN (num_ativa::text)::integer 
        ELSE 999999999 
      END ASC,
      created_at ASC
  ) as rn
  FROM contratacoes
)
UPDATE contratacoes c SET ordem = o.rn FROM ordered o WHERE c.id = o.id;

-- 2. Reseta a sequence para continuar a partir do último valor
SELECT setval(
  pg_get_serial_sequence('contratacoes', 'ordem'),
  (SELECT COALESCE(MAX(ordem), 0) FROM contratacoes)
);
