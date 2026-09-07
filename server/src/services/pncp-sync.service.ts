import { PrismaClient } from '@prisma/client';

// ── Configuracao ──────────────────────────────────────────

/** Contratacoes com recebimento de propostas em aberto. Varredura completa. */
const PNCP_PROPOSTA_URL = 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta';

/**
 * Contratacoes por DATA DE ATUALIZACAO — o mesmo eixo do "DtCriacao" da tela do
 * sistema antigo, que guarda o dataAtualizacaoGlobal do PNCP.
 *
 * E este o endpoint que reproduz a captura do sistema antigo. Filtrar por data de
 * PUBLICACAO nao serve: das 1602 licitacoes que o antigo capturou em 27/08,
 * 257 tinham sido publicadas em dias anteriores e entraram na lista porque foram
 * atualizadas naquele dia. Uma janela por publicacao nunca as alcancaria.
 */
const PNCP_ATUALIZACAO_URL = 'https://pncp.gov.br/api/consulta/v1/contratacoes/atualizacao';

/**
 * Codigos de modalidade consultados.
 *
 * A lista era 1..15 e por isso o sistema NUNCA via a modalidade 18 (Pregao -
 * Eletronico Internacional). Uma licitacao do Municipio do Rio de Janeiro ficou
 * de fora so por isso. Como o PNCP acrescenta codigos sem aviso, a varredura vai
 * ate MODALIDADE_MAX com folga: codigo inexistente responde HTTP 400 e e tratado
 * como "modalidade sem dados", custando uma unica requisicao por ciclo.
 */
const MODALIDADE_MAX = 20;
const MODALIDADES = Array.from({ length: MODALIDADE_MAX }, (_, i) => i + 1);
const PAGE_SIZE = 50;
const DELAY_BETWEEN_MODALITIES_MS = 500;

/**
 * Ritmo entre paginas. O PNCP responde 429 com facilidade e, quando isso
 * acontecia, a pagina era descartada em silencio. O intervalo agora e adaptativo:
 * sobe a cada 429 e volta a cair conforme as requisicoes passam.
 */
const DELAY_BASE_MS = 1000;
const DELAY_MAX_MS = 8000;

/**
 * Tentativas por pagina. Eram 3, com espera de 2s e 4s — curto demais para a
 * janela de rate limit do PNCP, entao as tres falhavam e a pagina (50 licitacoes)
 * era perdida. Modalidade 6 (Pregao Eletronico) tem 348 paginas; perder a pagina
 * 1 dela derrubava as 17 mil contratacoes da modalidade inteira no ciclo.
 */
const TENTATIVAS_POR_PAGINA = 6;
const ESPERA_429_BASE_MS = 5000;

/**
 * Tamanho de pagina da segunda passada. Uma pagina que devolve HTTP 500 de forma
 * teimosa costuma voltar ao normal quando os mesmos registros sao pedidos em
 * fatias menores, porque o recorte no servidor muda.
 */
const PAGE_SIZE_RECUPERACAO = 10;

/**
 * Janela, em dias, da varredura incremental por data de atualizacao.
 *
 * Zero = so o dia corrente. Cada dia a mais dobra o trabalho (sao ~182 paginas
 * por dia) e o ciclo precisa caber no intervalo do cron. O buraco da virada do
 * dia e coberto pela varredura completa, que roda de 6 em 6 horas.
 */
const DIAS_JANELA_INCREMENTAL = 0;

/**
 * Horizonte de busca, em dias.
 *
 * O endpoint /contratacoes/proposta filtra pelo ENCERRAMENTO do recebimento de
 * propostas. Com o valor antigo (30) uma licitacao publicada hoje com prazo de
 * 45 dias so era importada 15 dias depois, e a consulta do dia mostrava uma
 * fracao do que existia no PNCP.
 *
 * 180 dias ainda deixava de fora credenciamento de prazo longo: o do Municipio
 * de Anchieta encerra em 27/08/2027, quase um ano a frente. 400 dias cobre a
 * janela de um ano com folga.
 */
const HORIZONTE_DIAS = 400;

// ── Tipos da API PNCP ────────────────────────────────────
interface PncpOrgaoEntidade {
  cnpj: string;
  razaoSocial: string;
  poderId: string;
}

interface PncpUnidadeOrgao {
  codigoUnidade: string;
  nomeUnidade: string;
  ufSigla: string;
  municipioNome: string;
}

interface PncpContratacao {
  numeroControlePNCP: string;
  modalidadeId: number;
  modalidadeNome: string;
  numeroCompra: string;
  anoCompra: number;
  sequencialCompra: number;
  tipoInstrumentoConvocatorioNome: string;
  objetoCompra: string;
  dataPublicacaoPncp: string;
  dataAtualizacao: string;
  dataAtualizacaoGlobal: string;
  dataAberturaProposta: string;
  dataEncerramentoProposta: string;
  valorTotalEstimado: number;
  orgaoEntidade: PncpOrgaoEntidade;
  unidadeOrgao: PncpUnidadeOrgao;
}

interface PncpResponse {
  data: PncpContratacao[];
  totalPaginas: number;
  totalRegistros: number;
}

export type SyncModo = 'completo' | 'incremental';

export interface SyncResult {
  modo: SyncModo;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  /** Paginas que o PNCP nao entregou nem apos todas as tentativas. */
  paginasPerdidas: number;
  /** Modalidades que ficaram incompletas por causa das paginas perdidas. */
  modalidadesIncompletas: number[];
  startedAt: string;
  finishedAt: string;
  duration: string;
}

// ── Estado global do sync ─────────────────────────────────
let isSyncing = false;
let lastSyncResult: SyncResult | null = null;
let lastSyncError: string | null = null;

/**
 * Configuracao efetiva das buscas ao PNCP, para a tela Config. Busca.
 * Espelha as constantes deste arquivo — nao ha valores repetidos aqui.
 */
export function getSyncConfig() {
  const hoje = new Date();
  const inicioJanela = new Date();
  inicioJanela.setDate(inicioJanela.getDate() - DIAS_JANELA_INCREMENTAL);
  const fimHorizonte = new Date();
  fimHorizonte.setDate(fimHorizonte.getDate() + HORIZONTE_DIAS);

  return {
    varreduras: [
      {
        modo: 'incremental' as SyncModo,
        titulo: 'Incremental — o que mudou',
        endpoint: PNCP_ATUALIZACAO_URL,
        criterio: 'Data de atualizacao da licitacao no PNCP (dataAtualizacaoGlobal)',
        intervalo: `${INTERVALO_INCREMENTAL_MS / 60000} minutos`,
        intervaloMs: INTERVALO_INCREMENTAL_MS,
        janela: DIAS_JANELA_INCREMENTAL === 0
          ? 'Apenas o dia corrente'
          : `Dia corrente e os ${DIAS_JANELA_INCREMENTAL} dia(s) anteriores`,
        periodoAgora: `${formatDataPncp(inicioJanela)} a ${formatDataPncp(hoje)}`,
        paraQueServe: 'Pega a licitacao publicada hoje e tambem a antiga que foi retificada hoje.',
      },
      {
        modo: 'completo' as SyncModo,
        titulo: 'Completa — rede de seguranca',
        endpoint: PNCP_PROPOSTA_URL,
        criterio: 'Licitacoes com recebimento de propostas em aberto',
        intervalo: `${INTERVALO_COMPLETO_MS / 3600000} horas`,
        intervaloMs: INTERVALO_COMPLETO_MS,
        janela: `Propostas encerrando nos proximos ${HORIZONTE_DIAS} dias`,
        periodoAgora: `ate ${formatDataPncp(fimHorizonte)}`,
        paraQueServe: 'Confere todo o catalogo aberto e cobre o que a incremental nao alcancou.',
      },
    ],
    modalidades: MODALIDADES,
    filtros: [
      {
        nome: 'Somente proposta aberta',
        valor: 'Ativo',
        descricao: 'Licitacao com proposta ja encerrada, ou sem data de encerramento, nao e importada. '
          + 'O que ja foi importado continua sendo atualizado normalmente.',
      },
      {
        nome: 'Data de criacao congelada',
        valor: 'Ativo',
        descricao: 'dt_criacao e gravada uma unica vez, na importacao. Retificacao do PNCP aparece em dt_atualizacao.',
      },
      {
        nome: 'Campos da equipe preservados',
        valor: 'Ativo',
        descricao: 'A sincronizacao nunca sobrescreve num_ativa, cadastrado, enviada, lida, excluido, '
          + 'tipo de licitacao, links e textos do cadastro manual.',
      },
      {
        nome: 'Licitacao ja cadastrada',
        valor: 'Nao e alterada',
        descricao: 'Depois que a equipe cadastra, o PNCP nao sobrescreve mais aquele registro.',
      },
    ],
    ritmo: {
      registrosPorPagina: PAGE_SIZE,
      intervaloEntrePaginasMs: atrasoEntrePaginasMs,
      intervaloBaseMs: DELAY_BASE_MS,
      intervaloMaximoMs: DELAY_MAX_MS,
      tentativasPorPagina: TENTATIVAS_POR_PAGINA,
      esperaRateLimitBaseMs: ESPERA_429_BASE_MS,
      paginaDaSegundaPassada: PAGE_SIZE_RECUPERACAO,
      observacao: 'O intervalo entre paginas sobe sozinho quando o PNCP responde 429 e volta a cair '
        + 'depois de uma sequencia de requisicoes bem sucedidas.',
    },
  };
}

export function getSyncStatus() {
  return {
    isSyncing,
    lastSyncResult,
    lastSyncError,
  };
}

// ── Helpers ───────────────────────────────────────────────

/** Formata uma data como yyyyMMdd (formato aceito pela API do PNCP). */
function formatDataPncp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Retorna a data do fim do horizonte de busca no formato yyyyMMdd */
function formatDataFinalHorizonte(): string {
  const d = new Date();
  d.setDate(d.getDate() + HORIZONTE_DIAS);
  return formatDataPncp(d);
}

/** Formata data atual como yyyy-MM-dd'T'HH:mm:ss (sem timezone) */
function formatNow(): string {
  return new Date().toISOString().replace('Z', '').split('.')[0];
}

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Ritmo adaptativo ──────────────────────────────────────
// O PNCP nao publica o limite exato, entao o sync se ajusta sozinho: cada 429
// dobra o intervalo entre paginas e cada sequencia de sucessos o reduz.
let atrasoEntrePaginasMs = DELAY_BASE_MS;
let sucessosSeguidos = 0;

function registrarRateLimit(): void {
  atrasoEntrePaginasMs = Math.min(atrasoEntrePaginasMs * 2, DELAY_MAX_MS);
  sucessosSeguidos = 0;
  console.warn(`[PNCP] Rate limit — intervalo entre paginas agora e ${atrasoEntrePaginasMs}ms`);
}

function registrarSucesso(): void {
  sucessosSeguidos++;
  if (sucessosSeguidos >= 8 && atrasoEntrePaginasMs > DELAY_BASE_MS) {
    atrasoEntrePaginasMs = Math.max(Math.round(atrasoEntrePaginasMs / 2), DELAY_BASE_MS);
    sucessosSeguidos = 0;
    console.log(`[PNCP] Estavel — intervalo entre paginas reduzido para ${atrasoEntrePaginasMs}ms`);
  }
}

/**
 * Resultado de uma pagina. Antes a funcao devolvia `null` tanto para "o PNCP
 * respondeu que nao ha nada" quanto para "a requisicao falhou", e quem chamava
 * tratava os dois como fim de assunto — por isso a perda era invisivel.
 */
type ResultadoPagina =
  | { tipo: 'ok'; dados: PncpResponse }
  | { tipo: 'vazio' }
  | { tipo: 'falha'; motivo: string };

interface ParametrosBusca {
  url: string;
  modalidade: number;
  pagina: number;
  /** Varredura completa: fim do horizonte. Incremental: hoje. */
  dataFinal: string;
  /** So na varredura incremental (endpoint de publicacao). */
  dataInicial?: string;
  /** Padrao PAGE_SIZE. A segunda passada usa um valor menor (ver recuperarPaginas). */
  tamanhoPagina?: number;
}

/** Busca uma pagina da API PNCP, insistindo de verdade quando ha rate limit. */
async function fetchPncpPage(params: ParametrosBusca): Promise<ResultadoPagina> {
  const url = new URL(params.url);
  url.searchParams.set('dataFinal', params.dataFinal);
  if (params.dataInicial) url.searchParams.set('dataInicial', params.dataInicial);
  url.searchParams.set('codigoModalidadeContratacao', String(params.modalidade));
  url.searchParams.set('pagina', String(params.pagina));
  url.searchParams.set('tamanhoPagina', String(params.tamanhoPagina ?? PAGE_SIZE));

  const onde = `modalidade ${params.modalidade} pagina ${params.pagina}`;
  let ultimoMotivo = 'desconhecido';

  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_PAGINA; tentativa++) {
    try {
      const res = await fetch(url.toString(), { headers: { accept: '*/*' } });

      // 204 = o PNCP afirma que nao ha conteudo. Nao e falha.
      if (res.status === 204) return { tipo: 'vazio' };

      if (res.status === 429) {
        registrarRateLimit();
        // O PNCP as vezes informa quanto esperar; quando informa, obedecer.
        const retryAfter = Number(res.headers.get('retry-after'));
        const espera = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(ESPERA_429_BASE_MS * 2 ** (tentativa - 1), 60000);
        ultimoMotivo = 'HTTP 429 (rate limit)';
        console.warn(`[PNCP] 429 em ${onde} (tentativa ${tentativa}/${TENTATIVAS_POR_PAGINA}) — aguardando ${Math.round(espera / 1000)}s`);
        if (tentativa < TENTATIVAS_POR_PAGINA) await delay(espera);
        continue;
      }

      if (res.ok) {
        // Corpo vazio com HTTP 200 acontece e o res.json() estourava, virando
        // "erro de rede" e queimando as tentativas.
        const texto = await res.text();
        if (!texto.trim()) return { tipo: 'vazio' };
        registrarSucesso();
        return { tipo: 'ok', dados: JSON.parse(texto) as PncpResponse };
      }

      // 400 aqui significa parametro que o PNCP nao aceita — na pratica, codigo
      // de modalidade que nao existe. Nao adianta insistir e nao e perda de dado.
      if (res.status === 400) return { tipo: 'vazio' };

      ultimoMotivo = `HTTP ${res.status}`;
      console.error(`[PNCP] ${ultimoMotivo} em ${onde} (tentativa ${tentativa}/${TENTATIVAS_POR_PAGINA})`);
    } catch (err: any) {
      ultimoMotivo = `erro de rede: ${err?.message || err}`;
      console.error(`[PNCP] ${ultimoMotivo} em ${onde} (tentativa ${tentativa}/${TENTATIVAS_POR_PAGINA})`);
    }

    if (tentativa < TENTATIVAS_POR_PAGINA) await delay(2000 * tentativa);
  }

  console.error(`[PNCP] PERDIDA: ${onde} nao foi importada (${ultimoMotivo})`);
  return { tipo: 'falha', motivo: ultimoMotivo };
}

/** Busca o proximo num_ativa disponivel */
async function getNextNumAtiva(prisma: PrismaClient): Promise<number> {
  const result = await prisma.$queryRaw<{ next_num: number }[]>`
    SELECT COALESCE(MAX(CAST(num_ativa AS INTEGER)), 0) + 1 as next_num
    FROM contratacoes
    WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
  `;
  return Number(result[0]?.next_num || 1);
}

/** Chave de identidade de uma contratacao: numero PNCP + unidade + modalidade. */
function chaveContratacao(numeroControlePNCP: string | null, unCod: string | null, modalidadeId: number | null): string {
  return `${numeroControlePNCP}|${unCod}|${modalidadeId}`;
}

/**
 * Campos que pertencem ao PNCP — os unicos que o sync pode escrever.
 * Fora desta lista ficam os campos de trabalho da equipe (num_ativa, cadastrado,
 * enviada, lida, excluido, descricao_modalidade, links, textos_cadastro_manual),
 * que o sync nunca deve tocar.
 *
 * dt_criacao NAO entra aqui de proposito: ela e gravada uma unica vez, na
 * importacao (ver dtCriacaoInicial). Quando o PNCP retifica uma licitacao, quem
 * registra isso e dt_atualizacao. Antes, dt_criacao era reescrita a cada
 * retificacao e a licitacao "pulava" de horario — uma criada as 10h e retificada
 * as 12h05 sumia de uma consulta das 00:00 as 12:00 que antes a mostrava.
 */
function camposDoPncp(item: PncpContratacao) {
  return {
    uf: item.unidadeOrgao?.ufSigla || null,
    titulo: `${item.tipoInstrumentoConvocatorioNome || ''} nº ${item.numeroCompra || ''}`,
    municipio: item.unidadeOrgao?.municipioNome || null,
    unidade: item.unidadeOrgao?.nomeUnidade || null,
    orgao_pncp: item.orgaoEntidade?.razaoSocial || null,
    cnpj: item.orgaoEntidade?.cnpj || null,
    modalidade: item.modalidadeNome || null,
    conteudo: item.objetoCompra || null,
    dt_publicacao: item.dataPublicacaoPncp || null,
    dt_atualizacao: item.dataAtualizacao || null,
    dt_vigencia_ini: item.dataAberturaProposta || null,
    poder: item.orgaoEntidade?.poderId === 'N'
      ? 'Não se aplica'
      : (item.orgaoEntidade?.poderId || null),
    valor_estimado: item.valorTotalEstimado || null,
    link_processo: `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
    ano_compra: item.anoCompra != null ? String(item.anoCompra) : null,
    sequencial_compra: item.sequencialCompra != null ? String(item.sequencialCompra) : null,
    dt_encerramento_proposta: item.dataEncerramentoProposta || null,
  };
}

/**
 * A proposta desta licitacao esta aberta em algum momento do dia de hoje?
 *
 * O sistema so trabalha com licitacao de proposta aberta — das 1602 que o
 * sistema antigo capturou em 27/08, 99,3% estavam abertas e nenhuma vinha sem
 * data de encerramento. O endpoint /atualizacao, ao contrario, devolve tudo que
 * foi tocado no dia, inclusive licitacao de 2024 que recebeu um ajuste. Sem este
 * filtro entravam 2176 registros a mais, dos quais so 1 tinha proposta aberta.
 *
 * O corte e o INICIO DO DIA, e nao o instante da varredura. Existe dispensa com
 * janela de minutos — o Municipio de Indaiatuba publicou as 12:07 com proposta
 * encerrando as 12:11 — e comparar com o instante atual descartava justamente
 * essas, que o sistema antigo captura porque consulta a toda hora.
 *
 * Vale apenas para a IMPORTACAO. O que ja entrou continua sendo atualizado
 * normalmente, mesmo depois de a proposta encerrar.
 */
function propostaAberta(item: PncpContratacao, inicioDoDia: Date): boolean {
  if (!item.dataEncerramentoProposta) return false;
  const fim = new Date(item.dataEncerramentoProposta);
  return !isNaN(fim.getTime()) && fim >= inicioDoDia;
}

/** Valor de dt_criacao no momento da importacao. Nunca e reescrito depois. */
function dtCriacaoInicial(item: PncpContratacao): string | null {
  return item.dataAtualizacaoGlobal || null;
}

/**
 * Processa uma pagina de resultados PNCP:
 * - Insere as novas em lote (sem num_ativa — só recebe quando for cadastrada)
 * - Atualiza as que o PNCP alterou, desde que ainda NAO estejam cadastradas
 * - Nao encosta nas ja cadastradas, para nao sobrescrever trabalho manual
 */
export async function processPage(
  prisma: PrismaClient,
  items: PncpContratacao[],
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const validos = items.filter(i => i.numeroControlePNCP);
  if (validos.length === 0) return { inserted, updated, skipped, errors };

  const existentesDb = await prisma.contratacoes.findMany({
    where: { num_licitacao: { in: validos.map(i => i.numeroControlePNCP) } },
    select: {
      id: true, num_licitacao: true, un_cod: true, id_codigo_modalidade: true,
      cadastrado: true, dt_atualizacao: true,
    },
  });

  const existentes = new Map<string, (typeof existentesDb)[number]>();
  existentesDb.forEach(r => existentes.set(chaveContratacao(r.num_licitacao, r.un_cod, r.id_codigo_modalidade), r));

  const novos: any[] = [];
  const paraAtualizar: { id: string; data: ReturnType<typeof camposDoPncp> }[] = [];
  const vistosNestaPagina = new Set<string>();
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  for (const item of validos) {
    const key = chaveContratacao(item.numeroControlePNCP, item.unidadeOrgao?.codigoUnidade || null, item.modalidadeId);

    // A mesma contratacao pode vir repetida na pagina — nao inserir duas vezes.
    if (vistosNestaPagina.has(key)) { skipped++; continue; }
    vistosNestaPagina.add(key);

    const existente = existentes.get(key);

    if (!existente) {
      // Proposta ja encerrada: nao entra. Espelha o universo do sistema antigo.
      if (!propostaAberta(item, inicioDoDia)) { skipped++; continue; }

      novos.push({
        ...camposDoPncp(item),
        dt_criacao: dtCriacaoInicial(item),
        num_licitacao: item.numeroControlePNCP,
        id_codigo_modalidade: item.modalidadeId,
        un_cod: item.unidadeOrgao?.codigoUnidade || null,
        regiao: '',
        dt_importacao: formatNow(),
        tipo_cadastro: 'pncp',
      });
      continue;
    }

    // Ja cadastrada pela equipe: preserva como esta.
    if (existente.cadastrado === true) { skipped++; continue; }

    // O PNCP nao alterou nada desde a ultima importacao.
    if (existente.dt_atualizacao === (item.dataAtualizacao || null)) { skipped++; continue; }

    paraAtualizar.push({ id: existente.id, data: camposDoPncp(item) });
  }

  if (novos.length > 0) {
    try {
      const res = await prisma.contratacoes.createMany({ data: novos, skipDuplicates: true });
      inserted += res.count;
    } catch (err: any) {
      // Se o lote falhar, cai para insercao individual para nao perder a pagina toda.
      console.error(`[PNCP] Lote de ${novos.length} falhou, inserindo individualmente:`, err.message);
      for (const novo of novos) {
        try {
          await prisma.contratacoes.create({ data: novo });
          inserted++;
        } catch (e: any) {
          errors++;
          if (!e.message?.includes('Unique constraint')) {
            console.error(`[PNCP] Erro ao inserir ${novo.num_licitacao}:`, e.message);
          }
        }
      }
    }
  }

  for (const alvo of paraAtualizar) {
    try {
      await prisma.contratacoes.update({ where: { id: alvo.id }, data: alvo.data });
      updated++;
    } catch (err: any) {
      errors++;
      console.error(`[PNCP] Erro ao atualizar ${alvo.id}:`, err.message);
    }
  }

  return { inserted, updated, skipped, errors };
}

/** Uma pagina que o PNCP nao entregou na varredura. */
interface PaginaFalhada {
  modalidade: number;
  pagina: number;
}

/**
 * Segunda passada sobre as paginas que falharam.
 *
 * Roda no fim do ciclo, quando a pressao de rate limit ja passou. Se a pagina
 * continuar falhando no tamanho normal, os mesmos registros sao pedidos em
 * fatias menores: uma pagina de 50 vira 5 de 10, e um erro que atingia o recorte
 * inteiro costuma poupar a maior parte dos registros.
 */
async function recuperarPaginas(
  prisma: PrismaClient,
  falhadas: PaginaFalhada[],
  base: { url: string; dataFinal: string; dataInicial?: string },
): Promise<{ inserted: number; updated: number; skipped: number; errors: number; perdidas: PaginaFalhada[] }> {
  let inserted = 0, updated = 0, skipped = 0, errors = 0;
  const perdidas: PaginaFalhada[] = [];

  const somar = (r: { inserted: number; updated: number; skipped: number; errors: number }) => {
    inserted += r.inserted; updated += r.updated; skipped += r.skipped; errors += r.errors;
  };

  console.log(`
[PNCP Sync] Segunda passada em ${falhadas.length} pagina(s) que falharam...`);
  await delay(15000); // deixa a janela de rate limit virar

  for (const alvo of falhadas) {
    const cheia = await fetchPncpPage({ ...base, modalidade: alvo.modalidade, pagina: alvo.pagina });

    if (cheia.tipo === 'ok') {
      if (cheia.dados.data?.length) somar(await processPage(prisma, cheia.dados.data));
      console.log(`[PNCP Sync] Recuperada: modalidade ${alvo.modalidade} pagina ${alvo.pagina}`);
      await delay(atrasoEntrePaginasMs);
      continue;
    }
    if (cheia.tipo === 'vazio') { await delay(atrasoEntrePaginasMs); continue; }

    // Ainda falhando: tenta as mesmas licitacoes em fatias menores.
    const fatias = PAGE_SIZE / PAGE_SIZE_RECUPERACAO;
    const primeiraFatia = (alvo.pagina - 1) * fatias + 1;
    let recuperadas = 0;

    for (let i = 0; i < fatias; i++) {
      const fatia = await fetchPncpPage({
        ...base,
        modalidade: alvo.modalidade,
        pagina: primeiraFatia + i,
        tamanhoPagina: PAGE_SIZE_RECUPERACAO,
      });
      if (fatia.tipo === 'ok' && fatia.dados.data?.length) {
        somar(await processPage(prisma, fatia.dados.data));
        recuperadas++;
      }
      await delay(atrasoEntrePaginasMs);
    }

    if (recuperadas > 0) {
      console.log(
        `[PNCP Sync] Modalidade ${alvo.modalidade} pagina ${alvo.pagina}: ` +
        `${recuperadas}/${fatias} fatias recuperadas em paginas de ${PAGE_SIZE_RECUPERACAO}`,
      );
    } else {
      perdidas.push(alvo);
    }
  }

  return { inserted, updated, skipped, errors, perdidas };
}

// ── Funcao principal de sync ──────────────────────────────

export async function syncPncp(
  prisma: PrismaClient,
  modo: SyncModo = 'completo',
): Promise<SyncResult> {
  if (isSyncing) {
    throw new Error('Sync ja esta em andamento');
  }

  isSyncing = true;
  lastSyncError = null;
  const startedAt = new Date();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const paginasFalhadas: PaginaFalhada[] = [];

  try {
    // A varredura completa pergunta "o que esta com proposta aberta ate daqui a
    // 180 dias" (627 paginas) e serve de rede de seguranca. A incremental pergunta
    // "o que mudou nos ultimos dias" (182 paginas por dia) — e a consulta que
    // espelha o sistema antigo, porque pega tanto a licitacao nova quanto a antiga
    // que foi retificada hoje.
    const hoje = new Date();
    const inicioJanela = new Date();
    inicioJanela.setDate(inicioJanela.getDate() - DIAS_JANELA_INCREMENTAL);

    const urlBase = modo === 'completo' ? PNCP_PROPOSTA_URL : PNCP_ATUALIZACAO_URL;
    const dataFinal = modo === 'completo' ? formatDataFinalHorizonte() : formatDataPncp(hoje);
    const dataInicial = modo === 'completo' ? undefined : formatDataPncp(inicioJanela);

    console.log(`
[PNCP Sync] ======================================`);
    console.log(`[PNCP Sync] Iniciando sync ${modo.toUpperCase()}`);
    console.log(
      modo === 'completo'
        ? `[PNCP Sync] Propostas abertas ate ${dataFinal} (horizonte de ${HORIZONTE_DIAS} dias)`
        : `[PNCP Sync] Atualizadas de ${dataInicial} a ${dataFinal} (janela de ${DIAS_JANELA_INCREMENTAL} dias)`,
    );
    console.log(`[PNCP Sync] Modalidades: ${MODALIDADES.join(', ')}`);
    console.log(`[PNCP Sync] ======================================
`);

    for (const modalidade of MODALIDADES) {
      const buscar = (pagina: number) =>
        fetchPncpPage({ url: urlBase, modalidade, pagina, dataFinal, dataInicial });

      // 1) Pagina 1 define quantas paginas a modalidade tem.
      const primeira = await buscar(1);

      if (primeira.tipo === 'vazio') {
        console.log(`[PNCP Sync] Modalidade ${modalidade}: sem dados`);
        await delay(DELAY_BETWEEN_MODALITIES_MS);
        continue;
      }

      // Falhar aqui derrubava a modalidade INTEIRA em silencio — foi assim que
      // a modalidade 6 (Pregao Eletronico, 348 paginas) sumiu de ciclos inteiros.
      if (primeira.tipo === 'falha') {
        paginasFalhadas.push({ modalidade, pagina: 1 });
        console.error(
          `[PNCP Sync] Modalidade ${modalidade}: pagina 1 nao veio (${primeira.motivo}) — ` +
          `modalidade inteira ficou de fora deste ciclo`,
        );
        await delay(DELAY_BETWEEN_MODALITIES_MS);
        continue;
      }

      const totalPaginas = primeira.dados.totalPaginas || 1;
      console.log(
        `[PNCP Sync] Modalidade ${modalidade}: ${totalPaginas} pagina(s), ~${primeira.dados.totalRegistros} registros`,
      );

      // 2) Processar todas as paginas
      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const atual = pagina === 1 ? primeira : await buscar(pagina);

        if (atual.tipo === 'falha') {
          paginasFalhadas.push({ modalidade, pagina });
          continue;
        }
        if (atual.tipo === 'vazio' || !atual.dados.data?.length) continue;

        const result = await processPage(prisma, atual.dados.data);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        totalErrors += result.errors;

        if (result.inserted > 0 || result.updated > 0) {
          console.log(
            `[PNCP Sync] Modalidade ${modalidade} pagina ${pagina}/${totalPaginas}: ` +
            `+${result.inserted} inseridos, ~${result.updated} atualizados, ${result.skipped} sem mudanca`,
          );
        }

        if (pagina < totalPaginas) await delay(atrasoEntrePaginasMs);
      }

      await delay(DELAY_BETWEEN_MODALITIES_MS);
    }

    // Segunda passada: paginas que falharam nao ficam perdidas sem uma nova chance.
    let paginasPerdidas = 0;
    const modalidadesIncompletas = new Set<number>();
    if (paginasFalhadas.length > 0) {
      const rec = await recuperarPaginas(prisma, paginasFalhadas, { url: urlBase, dataFinal, dataInicial });
      totalInserted += rec.inserted;
      totalUpdated += rec.updated;
      totalSkipped += rec.skipped;
      totalErrors += rec.errors;
      paginasPerdidas = rec.perdidas.length;
      rec.perdidas.forEach(x => modalidadesIncompletas.add(x.modalidade));
      console.log(
        `[PNCP Sync] Segunda passada: ${paginasFalhadas.length - paginasPerdidas} de ${paginasFalhadas.length} pagina(s) recuperada(s)`,
      );
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const durationStr = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

    const result: SyncResult = {
      modo,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
      paginasPerdidas,
      modalidadesIncompletas: [...modalidadesIncompletas],
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      duration: durationStr,
    };

    lastSyncResult = result;
    console.log(`
[PNCP Sync] ======================================`);
    console.log(`[PNCP Sync] ${modo.toUpperCase()} concluido em ${durationStr}`);
    console.log(`[PNCP Sync]   Inseridos: ${totalInserted}`);
    console.log(`[PNCP Sync]   Atualizados: ${totalUpdated}`);
    console.log(`[PNCP Sync]   Sem mudanca: ${totalSkipped}`);
    console.log(`[PNCP Sync]   Erros: ${totalErrors}`);
    if (paginasPerdidas > 0) {
      console.error(
        `[PNCP Sync]   PAGINAS PERDIDAS: ${paginasPerdidas} ` +
        `(ate ${paginasPerdidas * PAGE_SIZE} licitacoes) nas modalidades ${[...modalidadesIncompletas].join(', ')}`,
      );
    } else {
      console.log(`[PNCP Sync]   Paginas perdidas: 0`);
    }
    console.log(`[PNCP Sync] ======================================
`);

    return result;
  } catch (err: any) {
    lastSyncError = err.message;
    console.error(`[PNCP Sync] ERRO FATAL:`, err);
    throw err;
  } finally {
    isSyncing = false;
  }
}

// ── Backfill: preenche num_ativa em registros existentes ──

export async function backfillNumAtiva(prisma: PrismaClient): Promise<number> {
  // Busca registros sem num_ativa, ordenados por created_at
  const semNumAtiva = await prisma.contratacoes.findMany({
    where: {
      OR: [
        { num_ativa: null },
        { num_ativa: '' },
      ],
    },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  });

  if (semNumAtiva.length === 0) {
    console.log('[Backfill] Todos os registros ja possuem num_ativa');
    return 0;
  }

  console.log(`[Backfill] ${semNumAtiva.length} registros sem num_ativa, preenchendo...`);

  let nextNum = await getNextNumAtiva(prisma);

  // Atualiza em batches de 100
  for (let i = 0; i < semNumAtiva.length; i++) {
    await prisma.contratacoes.update({
      where: { id: semNumAtiva[i].id },
      data: { num_ativa: String(nextNum) },
    });
    nextNum++;

    if ((i + 1) % 1000 === 0) {
      console.log(`[Backfill] ${i + 1}/${semNumAtiva.length} atualizados...`);
    }
  }

  console.log(`[Backfill] Concluido: ${semNumAtiva.length} registros atualizados (num_ativa de ${nextNum - semNumAtiva.length} a ${nextNum - 1})`);
  return semNumAtiva.length;
}

// ── Cron ──────────────────────────────────────────────────

let cronIncremental: NodeJS.Timeout | null = null;
let cronCompleto: NodeJS.Timeout | null = null;

/** De quanto em quanto tempo cada varredura roda. */
const INTERVALO_INCREMENTAL_MS = 10 * 60 * 1000; // 10 min
const INTERVALO_COMPLETO_MS = 6 * 60 * 60 * 1000; // 6 h

/**
 * Duas varreduras com papeis diferentes:
 *
 * - INCREMENTAL, a cada 10 min: pergunta ao PNCP o que foi publicado nos ultimos
 *   dias. Sao ~91 paginas, entao termina rapido. E ela que garante que uma
 *   licitacao publicada e excluida no mesmo dia seja capturada — era exatamente
 *   o que o sistema antigo fazia ao consultar de 10 em 10 minutos.
 *
 * - COMPLETA, a cada 6 h: a varredura de 627 paginas por proposta aberta, que
 *   mantem atualizado o que ja foi importado e cobre qualquer coisa que a janela
 *   incremental nao tenha alcancado.
 */
export function startPncpCron(prisma: PrismaClient) {
  console.log(
    `[PNCP Cron] Incremental a cada ${INTERVALO_INCREMENTAL_MS / 60000} min | ` +
    `Completa a cada ${INTERVALO_COMPLETO_MS / 3600000} h (horizonte de ${HORIZONTE_DIAS} dias)`,
  );

  const executar = (modo: SyncModo, origem: string) => {
    if (isSyncing) {
      console.log(`[PNCP Cron] ${origem}: ciclo anterior ainda em andamento, aguardando o proximo horario`);
      return;
    }
    console.log(`[PNCP Cron] ${origem}...`);
    syncPncp(prisma, modo).catch(err => console.error(`[PNCP Cron] Erro na sync ${modo}:`, err.message));
  };

  // Primeira incremental logo apos o boot: e barata e ja cobre o buraco recente.
  setTimeout(() => executar('incremental', 'Primeira sync incremental'), 60_000);
  cronIncremental = setInterval(() => executar('incremental', 'Sync incremental agendada'), INTERVALO_INCREMENTAL_MS);

  // A completa entra depois, para nao competir com a primeira incremental.
  setTimeout(() => executar('completo', 'Primeira sync completa'), 10 * 60_000);
  cronCompleto = setInterval(() => executar('completo', 'Sync completa agendada'), INTERVALO_COMPLETO_MS);
}

export function stopPncpCron() {
  if (cronIncremental) { clearInterval(cronIncremental); cronIncremental = null; }
  if (cronCompleto) { clearInterval(cronCompleto); cronCompleto = null; }
  console.log(`[PNCP Cron] Parado`);
}
