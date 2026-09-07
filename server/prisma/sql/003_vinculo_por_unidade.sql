-- 003 — Vinculo orgao<->PNCP passa a ser por UNIDADE COMPRADORA, nao por CNPJ.
--
-- Problema: orgaos_vinculados so guardava o CNPJ, entao associar uma unidade
-- marcava todas as unidades daquele CNPJ. Ex.: PREFEITURA MUNICIPAL DE VILA
-- VELHA tem as unidades 1 e 985703 sob o CNPJ 27165554000103 — associar uma
-- associava as duas.
--
-- A chave e o par (cnpj, un_cod). un_cod sozinho nao serve: e um codigo local
-- do orgao e se repete entre CNPJs diferentes (un_cod '1' aparece em ~1867
-- CNPJs distintos na base).

ALTER TABLE orgaos_vinculados ADD COLUMN IF NOT EXISTS un_cod text;

-- Backfill seguro: so preenche onde nao ha ambiguidade, isto e, onde o CNPJ
-- possui uma unica unidade compradora na base de contratacoes. Vinculos de
-- CNPJs com varias unidades ficam com un_cod NULL e precisam ser refeitos
-- pela tela (Consulta > Unidades), pois nao ha como deduzir qual unidade o
-- usuario pretendia associar.
UPDATE orgaos_vinculados v
SET    un_cod = u.un_cod
FROM (
  SELECT cnpj, MIN(un_cod) AS un_cod
  FROM   contratacoes
  WHERE  un_cod IS NOT NULL
  GROUP  BY cnpj
  HAVING COUNT(DISTINCT un_cod) = 1
) u
WHERE  v.un_cod IS NULL
  AND  v.cnpj = u.cnpj;

CREATE UNIQUE INDEX IF NOT EXISTS orgaos_vinculados_cnpj_un_cod_key
  ON orgaos_vinculados (cnpj, un_cod);
