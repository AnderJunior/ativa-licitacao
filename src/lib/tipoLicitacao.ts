/**
 * Resolução do Tipo/Modalidade de licitação a partir do conteúdo colado.
 *
 * Usado pelo check "TIPO" da tela de Cadastro de Licitação. Precisa lidar com o
 * fato de que todo edital começa com cabeçalhos genéricos ("AVISO DE LICITAÇÃO")
 * que também existem como tipo cadastrado — a modalidade real costuma vir depois.
 */

export interface TipoRef {
  id: string;
  sigla: string;
  descricao: string | null;
}

export type ResultadoTipo<T extends TipoRef = TipoRef> =
  | { status: 'encontrado'; tipo: T; via: 'rotulo' | 'sigla' | 'texto' }
  | { status: 'nao-encontrado'; termoRotulo: string | null };

/**
 * Forma canônica para comparação: minúsculas, sem acento, sem pontuação,
 * e com plural reduzido ("preços" e "preco" viram "preco").
 */
export const canonizar = (s: string | null | undefined): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(p => (p.length > 3 ? p.replace(/s$/, '') : p))
    .join(' ');

/**
 * Descrições que são cabeçalho de documento, não modalidade.
 * Continuam podendo ser escolhidas, mas só quando nada mais específico casar.
 */
const GENERICOS = new Set(['aviso', 'licitacao']);
const PENALIDADE_GENERICO = 500;

/** Grafias alternativas aceitas para uma descrição cadastrada (chave já canonizada). */
const ALIASES: Record<string, string[]> = {
  // O cadastro tem "INEXIBILIDADE"; os editais escrevem "inexigibilidade".
  inexibilidade: ['inexigibilidade'],
  'pre qualificacao': ['prequalificacao'],
  'intencao de registro de preco': ['irp'],
  'regime diferenciado de contratacao': ['rdc'],
};

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A frase aparece no texto delimitada por palavra inteira? */
const contemFrase = (textoCanon: string, fraseCanon: string): boolean => {
  if (!fraseCanon) return false;
  return new RegExp(`(?:^|\\s)${escaparRegex(fraseCanon)}(?:\\s|$)`).test(textoCanon);
};

/** Todas as grafias aceitas de um tipo (descrição + aliases). */
const frasesDoTipo = (descricao: string | null): string[] => {
  const desc = canonizar(descricao);
  if (!desc) return [];
  return [desc, ...(ALIASES[desc] || [])];
};

/** Extrai o valor do rótulo "Modalidade de Compra:" / "Modalidade:". */
export function extrairTermoModalidade(conteudo: string): string | null {
  const re = /(?:modalidade(?:\s+(?:de\s+compra|da\s+licitac[aã]o|licitat[oó]ria))?)\s*[:\-–—]\s*(.+?)\s*(?:\r?\n|$)/i;
  const match = (conteudo || '').match(re);
  if (!match) return null;
  const termo = match[1].trim();
  return termo || null;
}

/**
 * Resolve o tipo/modalidade a partir do conteúdo.
 *
 * Ordem de confiança: rótulo "Modalidade:" → sigla no rótulo → varredura do texto.
 * Na varredura vence a descrição mais específica (mais longa) encontrada em
 * qualquer parte do texto — não a primeira linha que casar.
 */
export function resolverTipoPorConteudo<T extends TipoRef>(conteudo: string, tipos: T[]): ResultadoTipo<T> {
  const texto = conteudo || '';
  const textoCanon = canonizar(texto);
  const termoRotulo = extrairTermoModalidade(texto);
  const rotuloCanon = termoRotulo ? canonizar(termoRotulo) : '';

  // Sigla informada diretamente no rótulo ("Modalidade: PE").
  if (rotuloCanon) {
    const porSigla = tipos.find(t => canonizar(t.sigla) === rotuloCanon);
    if (porSigla) return { status: 'encontrado', tipo: porSigla, via: 'sigla' };
  }

  type Candidato = { tipo: T; score: number; via: 'rotulo' | 'texto'; tamanho: number };
  const candidatos: Candidato[] = [];

  for (const tipo of tipos) {
    const frases = frasesDoTipo(tipo.descricao);
    if (frases.length === 0) continue;

    const descCanon = frases[0];
    const generico = GENERICOS.has(descCanon);
    // Especificidade: descrição mais longa é mais informativa que "AVISO".
    const tamanho = descCanon.length;

    const noRotulo = rotuloCanon ? frases.some(f => contemFrase(rotuloCanon, f) || rotuloCanon === f) : false;
    const noTexto = frases.some(f => contemFrase(textoCanon, f));
    if (!noRotulo && !noTexto) continue;

    let score = tamanho;
    if (noRotulo) score += 1000; // O rótulo explícito é a fonte mais confiável.
    if (generico) score -= PENALIDADE_GENERICO;

    candidatos.push({ tipo, score, via: noRotulo ? 'rotulo' : 'texto', tamanho });
  }

  if (candidatos.length === 0) return { status: 'nao-encontrado', termoRotulo };

  candidatos.sort((a, b) => b.score - a.score || b.tamanho - a.tamanho);
  const vencedor = candidatos[0];
  return { status: 'encontrado', tipo: vencedor.tipo, via: vencedor.via };
}
