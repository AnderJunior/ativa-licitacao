-- Coluna ordem em contratacoes (navegação rápida)
-- Execute no SQL Editor do Supabase

-- 1. Adiciona coluna com auto-incremento
ALTER TABLE contratacoes ADD COLUMN IF NOT EXISTS ordem SERIAL;

-- 2. Preenche registros existentes na ordem do num_ativa (num_ativa pode ser text ou integer)
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

-- 3. Reseta a sequence para o valor máximo atual
SELECT setval(pg_get_serial_sequence('contratacoes', 'ordem'), (SELECT COALESCE(MAX(ordem), 0) FROM contratacoes));

-- 4. Índice para buscas instantâneas
CREATE INDEX IF NOT EXISTS idx_contratacoes_ordem ON contratacoes(ordem);
