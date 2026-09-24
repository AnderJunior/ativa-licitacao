-- 004 — Situação da licitação no PNCP (situacaoCompraNome).
--
-- Valores do PNCP: "Divulgada no PNCP", "Suspensa", "Revogada", "Anulada".
-- Suspensa, revogada e anulada continuam no sistema, mas a equipe precisa ver
-- isso logo na primeira linha do texto da licitação. A sincronização grava a
-- situação em toda importação/atualização — inclusive nas já cadastradas, onde
-- é o único campo que ela altera.

ALTER TABLE contratacoes ADD COLUMN IF NOT EXISTS situacao text;
