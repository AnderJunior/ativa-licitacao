-- Busca que ignora acento em órgão, município e nome de órgão cadastrado.
--
-- Sem isto, procurar "Piuma" não acha "PIÚMA" (e vice-versa), porque o ILIKE
-- do Postgres é insensível a maiúsculas mas NÃO a acentos.
--
-- unaccent() sozinho resolve a correção, mas é STABLE e não pode ser indexado.
-- O invólucro f_unaccent (IMMUTABLE) permite o índice; o pg_trgm dá índice
-- para buscas com curinga no início ('%termo%'), que é o caso aqui.
--
-- Script aditivo e idempotente: só cria o que ainda não existe.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Invólucro IMMUTABLE — obrigatório para poder indexar.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  STRICT
  PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1)
$$;

-- Índices para as buscas por texto das telas de consulta.
CREATE INDEX IF NOT EXISTS idx_contratacoes_orgao_pncp_unaccent
  ON contratacoes USING gin (f_unaccent(orgao_pncp) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contratacoes_municipio_unaccent
  ON contratacoes USING gin (f_unaccent(municipio) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orgaos_nome_unaccent
  ON orgaos USING gin (f_unaccent(nome_orgao) gin_trgm_ops);
