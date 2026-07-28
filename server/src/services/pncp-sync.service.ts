import { PrismaClient } from '@prisma/client';

// ── Configuracao ──────────────────────────────────────────
const PNCP_PROPOSTA_URL = 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta';
const MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const PAGE_SIZE = 50;
const DELAY_BETWEEN_PAGES_MS = 1000; // 1s entre paginas (evitar rate limit)
const DELAY_BETWEEN_MODALITIES_MS = 500;
const TENTATIVAS_POR_PAGINA = 3; // Uma falha de rede perdia a pagina inteira em silencio
const DELAY_ENTRE_TENTATIVAS_MS = 2000;

/**
 * Horizonte de busca, em dias.
 *
 * O endpoint /contratacoes/proposta filtra pelo ENCERRAMENTO do recebimento de
 * propostas. Com o valor antigo (30) uma licitacao publicada hoje com prazo de
 * 45 dias so era importada 15 dias depois, e a consulta do dia mostrava uma
 * fracao do que existia no PNCP. 180 dias cobre praticamente todos os prazos.
 */
const HORIZONTE_DIAS = 180;

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

export interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  startedAt: string;
  finishedAt: string;
  duration: string;
}

// ── Estado global do sync ─────────────────────────────────
let isSyncing = false;
let lastSyncResult: SyncResult | null = null;
let lastSyncError: string | null = null;

export function getSyncStatus() {
  return {
    isSyncing,
    lastSyncResult,
    lastSyncError,
  };
}

// ── Helpers ───────────────────────────────────────────────

/** Retorna a data do fim do horizonte de busca no formato yyyyMMdd */
function formatDataFinalHorizonte(): string {
  const d = new Date();
  d.setDate(d.getDate() + HORIZONTE_DIAS);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Formata data atual como yyyy-MM-dd'T'HH:mm:ss (sem timezone) */
function formatNow(): string {
  return new Date().toISOString().replace('Z', '').split('.')[0];
}

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Busca uma pagina da API PNCP */
async function fetchPncpPage(
  modalidade: number,
  pagina: number,
  dataFinal: string,
): Promise<PncpResponse | null> {
  const url = new URL(PNCP_PROPOSTA_URL);
  url.searchParams.set('dataFinal', dataFinal);
  url.searchParams.set('codigoModalidadeContratacao', String(modalidade));
  url.searchParams.set('pagina', String(pagina));
  url.searchParams.set('tamanhoPagina', String(PAGE_SIZE));

  // Sem retry, uma falha momentanea descartava as 50 licitacoes da pagina em silencio.
  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_PAGINA; tentativa++) {
    try {
      const res = await fetch(url.toString(), { headers: { accept: '*/*' } });
      if (res.ok) return (await res.json()) as PncpResponse;

      // 204 = pagina sem conteudo; nao adianta insistir.
      if (res.status === 204) return null;
      console.error(
        `[PNCP] HTTP ${res.status} modalidade ${modalidade} pagina ${pagina} (tentativa ${tentativa}/${TENTATIVAS_POR_PAGINA})`,
      );
    } catch (err) {
      console.error(
        `[PNCP] Erro de rede modalidade ${modalidade} pagina ${pagina} (tentativa ${tentativa}/${TENTATIVAS_POR_PAGINA}):`,
        err,
      );
    }
    if (tentativa < TENTATIVAS_POR_PAGINA) await delay(DELAY_ENTRE_TENTATIVAS_MS * tentativa);
  }

  console.error(`[PNCP] FALHA definitiva: modalidade ${modalidade} pagina ${pagina} nao foi importada`);
  return null;
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
    dt_criacao: item.dataAtualizacaoGlobal || null,
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

  for (const item of validos) {
    const key = chaveContratacao(item.numeroControlePNCP, item.unidadeOrgao?.codigoUnidade || null, item.modalidadeId);

    // A mesma contratacao pode vir repetida na pagina — nao inserir duas vezes.
    if (vistosNestaPagina.has(key)) { skipped++; continue; }
    vistosNestaPagina.add(key);

    const existente = existentes.get(key);

    if (!existente) {
      novos.push({
        ...camposDoPncp(item),
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

// ── Funcao principal de sync ──────────────────────────────

export async function syncPncp(prisma: PrismaClient): Promise<SyncResult> {
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

  try {
    const dataFinal = formatDataFinalHorizonte();
    console.log(`\n[PNCP Sync] ======================================`);
    console.log(`[PNCP Sync] Iniciando sync — dataFinal=${dataFinal} (horizonte de ${HORIZONTE_DIAS} dias)`);
    console.log(`[PNCP Sync] Modalidades: ${MODALIDADES.join(', ')}`);
    console.log(`[PNCP Sync] ======================================\n`);

    // num_ativa nao e mais atribuido na importacao — so quando a licitacao e cadastrada

    for (const modalidade of MODALIDADES) {
      // 1) Buscar pagina 1 para saber total de paginas
      const firstPage = await fetchPncpPage(modalidade, 1, dataFinal);

      if (!firstPage?.data?.length || !firstPage.data[0]?.numeroControlePNCP) {
        console.log(`[PNCP Sync] Modalidade ${modalidade}: sem dados`);
        await delay(DELAY_BETWEEN_MODALITIES_MS);
        continue;
      }

      const totalPaginas = firstPage.totalPaginas || 1;
      console.log(
        `[PNCP Sync] Modalidade ${modalidade}: ${totalPaginas} pagina(s), ~${firstPage.totalRegistros} registros`,
      );

      // 2) Processar todas as paginas
      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const pageData = pagina === 1 ? firstPage : await fetchPncpPage(modalidade, pagina, dataFinal);

        if (!pageData?.data?.length) {
          console.log(`[PNCP Sync] Modalidade ${modalidade} pagina ${pagina}: vazia`);
          continue;
        }

        const result = await processPage(prisma, pageData.data);
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

        // Delay entre paginas (igual ao Wait do N8N)
        if (pagina < totalPaginas) {
          await delay(DELAY_BETWEEN_PAGES_MS);
        }
      }

      // Delay entre modalidades
      await delay(DELAY_BETWEEN_MODALITIES_MS);
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const durationStr = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

    const result: SyncResult = {
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      duration: durationStr,
    };

    lastSyncResult = result;
    console.log(`\n[PNCP Sync] ======================================`);
    console.log(`[PNCP Sync] Concluido em ${durationStr}`);
    console.log(`[PNCP Sync]   Inseridos: ${totalInserted}`);
    console.log(`[PNCP Sync]   Atualizados: ${totalUpdated}`);
    console.log(`[PNCP Sync]   Sem mudanca: ${totalSkipped}`);
    console.log(`[PNCP Sync]   Erros: ${totalErrors}`);
    console.log(`[PNCP Sync] ======================================\n`);

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

// ── Cron (setInterval de 30 min) ──────────────────────────

let cronInterval: NodeJS.Timeout | null = null;

export function startPncpCron(prisma: PrismaClient) {
  const THIRTY_MINUTES = 30 * 60 * 1000;

  console.log(`[PNCP Cron] Agendado para rodar a cada 30 minutos (horizonte de ${HORIZONTE_DIAS} dias)`);

  // Com o horizonte maior um ciclo pode passar de 30 min. Nesse caso a proxima
  // execucao apenas aguarda, em vez de registrar erro a cada disparo.
  const executar = (origem: string) => {
    if (isSyncing) {
      console.log(`[PNCP Cron] ${origem}: ciclo anterior ainda em andamento, aguardando o proximo horario`);
      return;
    }
    console.log(`[PNCP Cron] ${origem}...`);
    syncPncp(prisma).catch(err => console.error('[PNCP Cron] Erro na sync:', err.message));
  };

  // Rodar a primeira vez apos 1 minuto (dar tempo do server iniciar)
  setTimeout(() => executar('Executando primeira sync'), 60_000);

  // Depois, a cada 30 minutos
  cronInterval = setInterval(() => executar('Executando sync agendada'), THIRTY_MINUTES);
}

export function stopPncpCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log(`[PNCP Cron] Parado`);
  }
}
