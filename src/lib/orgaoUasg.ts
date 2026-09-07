/**
 * Resolução de Órgão a partir do conteúdo colado no cadastro de licitação.
 *
 * Usado pelo check "UASG" da tela de Cadastro de Licitação: dado o texto colado
 * (ComprasNet / PNCP / digitado à mão), tenta descobrir qual órgão cadastrado
 * corresponde, seja pelo código UASG, seja pelo nome.
 */

export interface OrgaoRef {
  id: string;
  nome_orgao: string;
  compras_net?: string | null;
  compras_mg?: string | null;
}

export type ResultadoOrgao<T extends OrgaoRef = OrgaoRef> =
  | { status: 'encontrado'; orgao: T; via: 'codigo' | 'nome' | 'codigo+nome' | 'vinculo' }
  | { status: 'ambiguo'; candidatos: T[]; termo: string }
  | { status: 'nao-encontrado'; termo: string | null; codigos: string[] };

/** Associação unidade compradora → órgão cadastrado, definida pelo usuário na tela de Consulta. */
export interface VinculoOrgao {
  orgao_id?: string | null;
  orgao_nome?: string | null;
}

/** CNPJ apenas com dígitos — o PNCP às vezes envia formatado. */
export const normalizarCnpj = (s: string | null | undefined): string => (s || '').replace(/\D/g, '');

/**
 * Chave de um vínculo: o par (CNPJ, unidade compradora).
 *
 * A associação é por UNIDADE, não por CNPJ — um mesmo CNPJ pode ter várias
 * unidades no PNCP (a Prefeitura de Vila Velha tem a unidade 1 e a 985703) e
 * cada uma pode apontar para um órgão diferente. O CNPJ continua na chave
 * porque o un_cod é um código interno do órgão e se repete entre CNPJs
 * distintos (o un_cod "1" aparece em ~1867 CNPJs da base).
 *
 * Retorna null quando falta CNPJ ou unidade — sem os dois não há vínculo.
 */
export const chaveVinculo = (
  cnpj: string | null | undefined,
  unCod: string | null | undefined,
): string | null => {
  const c = normalizarCnpj(cnpj);
  const u = (unCod || '').trim();
  return c && u ? c + '|' + u : null;
};

/** Minúsculas, sem acento, espaços colapsados. */
export const normalizarTexto = (s: string | null | undefined): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Só dígitos, sem zeros à esquerda — tolera "120637", " 120637 ", "0120637". */
const normalizarCodigo = (s: string | null | undefined): string => {
  const digitos = (s || '').replace(/\D/g, '');
  return digitos.replace(/^0+(?=\d)/, '');
};

// Rótulos que introduzem o nome do órgão no texto colado.
const ROTULO_ORGAO = '(?:[oó]rg[aã]o|entidade|unidade\\s+gestora|unidade\\s+compradora|comprador)';

/** Extrai os códigos numéricos do texto, separando os explícitos dos genéricos. */
export function extrairCodigosUASG(conteudo: string): { explicitos: string[]; genericos: string[] } {
  const explicitos: string[] = [];
  const genericos: string[] = [];
  const push = (lista: string[], valor: string | undefined) => {
    const cod = normalizarCodigo(valor);
    // UASG tem 6 dígitos; Compras MG e códigos de UG variam de 4 a 8.
    if (cod.length >= 4 && cod.length <= 8 && !lista.includes(cod)) lista.push(cod);
  };

  // 1) Códigos rotulados explicitamente: "UASG: 120637", "UASG 120637",
  //    "Código UASG 120637", "UG 120637", "Compras MG: 1501".
  const patternsExplicitos = [
    /(?:c[oó]d(?:igo)?\.?\s*(?:da\s*)?)?uasg\s*(?:n[ºo°.]?\s*)?[:\-–—]?\s*(\d{4,8})\b/gi,
    /\bug\s*[:\-–—]?\s*(\d{4,8})\b/gi,
    /compras\s*mg\s*[:\-–—]?\s*(\d{4,8})\b/gi,
    // "Órgão: 120637" ou "Órgão: 120637 - NOME" — o código vem logo após o rótulo.
    new RegExp(`${ROTULO_ORGAO}\\s*[:\\-–—]\\s*(\\d{4,8})\\b`, 'gi'),
  ];
  for (const re of patternsExplicitos) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(conteudo)) !== null) push(explicitos, m[1]);
  }

  // 2) Qualquer número de 5 a 7 dígitos isolado — último recurso, só usado
  //    quando nem código explícito nem nome resolvem.
  const reGenerico = /(?<![\d.,/-])(\d{5,7})(?![\d.,/-])/g;
  let g: RegExpExecArray | null;
  while ((g = reGenerico.exec(conteudo)) !== null) {
    const cod = normalizarCodigo(g[1]);
    if (!explicitos.includes(cod)) push(genericos, g[1]);
  }

  return { explicitos, genericos };
}

/**
 * Extrai o nome do órgão do texto.
 * Remove o código que costuma vir grudado ("120637 - PREFEITURA..." → "PREFEITURA...").
 */
export function extrairNomeOrgao(conteudo: string): string | null {
  // Aceita "Órgão:", "Órgão/Entidade:", "Órgão Entidade -", "Unidade Compradora:" etc.
  const re = new RegExp(`${ROTULO_ORGAO}(?:\\s*[/e]\\s*entidade)?\\s*[:\\-–—]\\s*(.+?)\\s*(?:\\r?\\n|$)`, 'i');
  const match = conteudo.match(re);
  if (!match) return null;

  let nome = match[1].trim();
  // Descarta prefixo de código: "120637 - NOME", "120637 – NOME", "120637: NOME".
  nome = nome.replace(/^\d{4,8}\s*[-–—:/]\s*/, '').trim();
  // Descarta sufixo de código: "NOME - UASG 120637".
  nome = nome.replace(/\s*[-–—]?\s*(?:c[oó]d(?:igo)?\.?\s*)?uasg\s*[:\-–—]?\s*\d{4,8}\s*$/i, '').trim();
  // Se sobrou só número/pontuação, não é nome.
  if (!nome || !/[a-zA-ZÀ-ÿ]{2}/.test(nome)) return null;
  return nome;
}

/** Códigos que aparecem no próprio nome do órgão cadastrado (ex.: "... - UASG 120637"). */
const codigosDoNome = (nome: string): string[] => {
  const encontrados: string[] = [];
  const re = /(?:uasg|ug)\s*[:\-–—]?\s*(\d{4,8})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(nome || '')) !== null) {
    const cod = normalizarCodigo(m[1]);
    if (cod && !encontrados.includes(cod)) encontrados.push(cod);
  }
  return encontrados;
};

/** Órgãos cujo código (campo cadastrado ou embutido no nome) bate com algum dos códigos. */
function buscarPorCodigo<T extends OrgaoRef>(orgaos: T[], codigos: string[]): T[] {
  for (const cod of codigos) {
    // Prioriza o código cadastrado nos campos Compras NET / Compras MG.
    const porCampo = orgaos.filter(
      o => normalizarCodigo(o.compras_net) === cod || normalizarCodigo(o.compras_mg) === cod
    );
    if (porCampo.length > 0) return porCampo;

    // Fallback: muitos órgãos têm a UASG escrita no próprio nome e o campo vazio.
    const porNome = orgaos.filter(o => codigosDoNome(o.nome_orgao).includes(cod));
    if (porNome.length > 0) return porNome;
  }
  return [];
}

/** Pontua os órgãos por semelhança de nome e devolve os empatados no topo. */
function buscarPorNome<T extends OrgaoRef>(orgaos: T[], termo: string): T[] {
  const termoNorm = normalizarTexto(termo);
  if (termoNorm.length < 4) return [];

  const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length > 2);

  const pontuados = orgaos
    .map(o => {
      const nomeNorm = normalizarTexto(o.nome_orgao);
      if (!nomeNorm) return null;
      let score = 0;
      if (nomeNorm === termoNorm) score = 100;
      else if (nomeNorm.startsWith(termoNorm)) score = 80;
      else if (termoNorm.startsWith(nomeNorm)) score = 75;
      else if (nomeNorm.includes(termoNorm)) score = 60;
      else if (termoNorm.includes(nomeNorm)) score = 55;
      else if (palavrasTermo.length > 0 && palavrasTermo.every(p => nomeNorm.includes(p))) score = 40;
      return score > 0 ? { orgao: o, score } : null;
    })
    .filter((c): c is { orgao: T; score: number } => c !== null);

  if (pontuados.length === 0) return [];
  const melhor = Math.max(...pontuados.map(p => p.score));
  return pontuados.filter(p => p.score === melhor).map(p => p.orgao);
}

/**
 * Resolve o órgão a partir do conteúdo colado.
 *
 * Ordem: código explícito ∩ nome → código explícito → nome → código genérico.
 * Devolve `ambiguo` quando sobra mais de um candidato, para o popup de seleção.
 */
export function resolverOrgaoPorConteudo<T extends OrgaoRef>(conteudo: string, orgaos: T[]): ResultadoOrgao<T> {
  const texto = conteudo || '';
  const { explicitos, genericos } = extrairCodigosUASG(texto);
  const termo = extrairNomeOrgao(texto);

  const porCodigo = buscarPorCodigo(orgaos, explicitos);
  const porNome = termo ? buscarPorNome(orgaos, termo) : [];

  // Maior confiança: o mesmo órgão bate por código E por nome.
  if (porCodigo.length > 0 && porNome.length > 0) {
    const ids = new Set(porNome.map(o => o.id));
    const intersecao = porCodigo.filter(o => ids.has(o.id));
    if (intersecao.length === 1) return { status: 'encontrado', orgao: intersecao[0], via: 'codigo+nome' };
    if (intersecao.length > 1) return { status: 'ambiguo', candidatos: intersecao, termo: termo || '' };
  }

  // Código explícito é autoritativo (é o que o check "UASG" promete).
  if (porCodigo.length === 1) return { status: 'encontrado', orgao: porCodigo[0], via: 'codigo' };
  if (porCodigo.length > 1) return { status: 'ambiguo', candidatos: porCodigo, termo: termo || '' };

  if (porNome.length === 1) return { status: 'encontrado', orgao: porNome[0], via: 'nome' };
  if (porNome.length > 1) return { status: 'ambiguo', candidatos: porNome, termo: termo || '' };

  // Último recurso: número solto no texto que bata com um órgão cadastrado.
  const porCodigoGenerico = buscarPorCodigo(orgaos, genericos);
  if (porCodigoGenerico.length === 1) return { status: 'encontrado', orgao: porCodigoGenerico[0], via: 'codigo' };
  if (porCodigoGenerico.length > 1) return { status: 'ambiguo', candidatos: porCodigoGenerico, termo: termo || '' };

  return { status: 'nao-encontrado', termo, codigos: [...explicitos, ...genericos] };
}

/**
 * Resolve o órgão cadastrado de uma licitação vinda do PNCP.
 *
 * O nome que o PNCP envia raramente é igual ao nome cadastrado
 * ("MUNICIPIO DE PIUMA" x "PREFEITURA MUNICIPAL DE PIUMA"), por isso a
 * associação da unidade compradora — feita pelo usuário em Consulta > Unidades
 * — tem prioridade sobre qualquer comparação de nome.
 */
export function resolverOrgaoDaLicitacao<T extends OrgaoRef>(
  licitacao: { orgao_pncp?: string | null; cnpj?: string | null; un_cod?: string | null },
  orgaos: T[],
  vinculos?: Record<string, VinculoOrgao> | null
): ResultadoOrgao<T> {
  // 1. Associação explícita da unidade compradora — é a intenção declarada do
  //    usuário. Vale só para a unidade associada, não para o CNPJ inteiro.
  const chave = chaveVinculo(licitacao.cnpj, licitacao.un_cod);
  const vinculo = chave && vinculos ? vinculos[chave] : undefined;
  if (vinculo) {
    const porId = vinculo.orgao_id ? orgaos.find(o => o.id === vinculo.orgao_id) : undefined;
    if (porId) return { status: 'encontrado', orgao: porId, via: 'vinculo' };
    const porNomeVinculo = vinculo.orgao_nome
      ? orgaos.find(o => normalizarTexto(o.nome_orgao) === normalizarTexto(vinculo.orgao_nome))
      : undefined;
    if (porNomeVinculo) return { status: 'encontrado', orgao: porNomeVinculo, via: 'vinculo' };
  }

  const nome = (licitacao.orgao_pncp || '').trim();
  if (!nome) return { status: 'nao-encontrado', termo: null, codigos: [] };

  // 2. Nome exato (o campo pode guardar o id ou o nome do órgão).
  const exato = orgaos.find(o => o.id === nome || o.nome_orgao === nome);
  if (exato) return { status: 'encontrado', orgao: exato, via: 'nome' };

  // 3. Nome aproximado, com a mesma pontuação do preenchimento automático.
  const porNome = buscarPorNome(orgaos, nome);
  if (porNome.length === 1) return { status: 'encontrado', orgao: porNome[0], via: 'nome' };
  if (porNome.length > 1) return { status: 'ambiguo', candidatos: porNome, termo: nome };

  return { status: 'nao-encontrado', termo: nome, codigos: [] };
}
