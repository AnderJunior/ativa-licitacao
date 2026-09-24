/**
 * Situação da licitação no PNCP (campo `situacao`, gravado pela sincronização).
 *
 * Suspensa, revogada e anulada continuam no sistema, mas a equipe precisa ver
 * isso de cara: o aviso vai na PRIMEIRA LINHA do texto da licitação.
 */

const AVISOS: Record<string, string> = {
  suspensa: '*** LICITAÇÃO SUSPENSA NO PNCP ***',
  revogada: '*** LICITAÇÃO REVOGADA NO PNCP ***',
  anulada: '*** LICITAÇÃO ANULADA NO PNCP ***',
};

// Aviso gravado antes (texto salvo no cadastro), para trocar quando a situação muda.
const AVISO_ANTIGO = /^\*\*\* LICITAÇÃO (SUSPENSA|REVOGADA|ANULADA) NO PNCP \*\*\*[ \t]*(\r?\n)?/;

/** Linha de aviso para a situação, ou null quando está normal ("Divulgada no PNCP"). */
export function avisoSituacao(situacao: string | null | undefined): string | null {
  const s = (situacao || '').toLowerCase();
  const chave = Object.keys(AVISOS).find(k => s.includes(k));
  return chave ? AVISOS[chave] : null;
}

/**
 * Põe o aviso da situação atual na primeira linha do texto. Se o texto já tinha
 * um aviso (de uma situação anterior), ele é trocado — ou removido, se a
 * licitação voltou ao normal.
 */
export function aplicarAvisoSituacao(texto: string | null | undefined, situacao: string | null | undefined): string {
  const semAviso = (texto || '').replace(AVISO_ANTIGO, '');
  const aviso = avisoSituacao(situacao);
  return aviso ? `${aviso}\n${semAviso}` : semAviso;
}
