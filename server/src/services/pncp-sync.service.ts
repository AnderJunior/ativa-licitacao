import { PrismaClient } from '@prisma/client';

// ── Configuracao ──────────────────────────────────────────
const PNCP_PROPOSTA_URL = 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta';
const MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const PAGE_SIZE = 50;
const DELAY_BETWEEN_PAGES_MS = 1000; // 1s entre paginas (evitar rate limit)
const DELAY_BETWEEN_MODALITIES_MS = 500;

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

/** Retorna data 30 dias a frente no formato yyyyMMdd */
function formatDate30DaysAhead(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
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

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: '*/*' },
    });
    if (!res.ok) {
      console.error(`[PNCP] HTTP ${res.status} ao buscar modalidade ${modalidade} pagina ${pagina}`);
      return null;
    }
    return (await res.json()) as PncpResponse;
  } catch (err) {
    console.error(`[PNCP] Erro de rede modalidade ${modalidade} pagina ${pagina}:`, err);
    return null;
  }
}

/**
 * Processa uma pagina de resultados PNCP:
 * - Verifica quais ja existem no banco
 * - Insere os novos
 */
async function processPage(
  prisma: PrismaClient,
  items: PncpContratacao[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Buscar quais num_licitacao ja existem no banco (batch lookup)
  const numLicitacoes = items
    .filter(i => i.numeroControlePNCP)
    .map(i => i.numeroControlePNCP);

  const existingRecords = await prisma.contratacoes.findMany({
    where: { num_licitacao: { in: numLicitacoes } },
    select: { num_licitacao: true, un_cod: true, id_codigo_modalidade: true },
  });

  // Criar um Set para lookup rapido: "numLicitacao|unCod|modalidadeId"
  const existingSet = new Set(
    existingRecords.map(r => `${r.num_licitacao}|${r.un_cod}|${r.id_codigo_modalidade}`),
  );

  for (const item of items) {
    if (!item.numeroControlePNCP) continue;

    const key = `${item.numeroControlePNCP}|${item.unidadeOrgao?.codigoUnidade}|${item.modalidadeId}`;

    if (existingSet.has(key)) {
      skipped++;
      continue;
    }

    try {
      await prisma.contratacoes.create({
        data: {
          num_licitacao: item.numeroControlePNCP,
          id_codigo_modalidade: item.modalidadeId,
          regiao: '',
          uf: item.unidadeOrgao?.ufSigla || null,
          titulo: `${item.tipoInstrumentoConvocatorioNome || ''} nº ${item.numeroCompra || ''}`,
          municipio: item.unidadeOrgao?.municipioNome || null,
          unidade: item.unidadeOrgao?.nomeUnidade || null,
          un_cod: item.unidadeOrgao?.codigoUnidade || null,
          orgao_pncp: item.orgaoEntidade?.razaoSocial || null,
          cnpj: item.orgaoEntidade?.cnpj || null,
          modalidade: item.modalidadeNome || null,
          conteudo: item.objetoCompra || null,
          dt_criacao: item.dataAtualizacaoGlobal || null,
          dt_importacao: formatNow(),
          dt_publicacao: item.dataPublicacaoPncp || null,
          dt_atualizacao: item.dataAtualizacao || null,
          dt_vigencia_ini: item.dataAberturaProposta || null,
          poder: item.orgaoEntidade?.poderId === 'N'
            ? 'Não se aplica'
            : (item.orgaoEntidade?.poderId || null),
          valor_estimado: item.valorTotalEstimado || null,
          link_processo: `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          ano_compra: item.anoCompra || null,
          sequencial_compra: item.sequencialCompra || null,
          dt_encerramento_proposta: item.dataEncerramentoProposta || null,
          tipo_cadastro: 'pncp',
        },
      });
      inserted++;
    } catch (err: any) {
      errors++;
      // Pode ser unique constraint violation se dois itens identicos chegarem na mesma batch
      if (!err.message?.includes('Unique constraint')) {
        console.error(`[PNCP] Erro ao inserir ${item.numeroControlePNCP}:`, err.message);
      }
    }
  }

  return { inserted, skipped, errors };
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
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    const dataFinal = formatDate30DaysAhead();
    console.log(`\n[PNCP Sync] ======================================`);
    console.log(`[PNCP Sync] Iniciando sync — dataFinal=${dataFinal}`);
    console.log(`[PNCP Sync] Modalidades: ${MODALIDADES.join(', ')}`);
    console.log(`[PNCP Sync] ======================================\n`);

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
        totalSkipped += result.skipped;
        totalErrors += result.errors;

        if (result.inserted > 0) {
          console.log(
            `[PNCP Sync] Modalidade ${modalidade} pagina ${pagina}/${totalPaginas}: ` +
            `+${result.inserted} inseridos, ${result.skipped} existentes`,
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
    console.log(`[PNCP Sync]   Ja existiam: ${totalSkipped}`);
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

// ── Cron (setInterval de 30 min) ──────────────────────────

let cronInterval: NodeJS.Timeout | null = null;

export function startPncpCron(prisma: PrismaClient) {
  const THIRTY_MINUTES = 30 * 60 * 1000;

  console.log(`[PNCP Cron] Agendado para rodar a cada 30 minutos`);

  // Rodar a primeira vez apos 1 minuto (dar tempo do server iniciar)
  setTimeout(() => {
    console.log(`[PNCP Cron] Executando primeira sync...`);
    syncPncp(prisma).catch(err => console.error('[PNCP Cron] Erro na sync:', err.message));
  }, 60_000);

  // Depois, a cada 30 minutos
  cronInterval = setInterval(() => {
    console.log(`[PNCP Cron] Executando sync agendada...`);
    syncPncp(prisma).catch(err => console.error('[PNCP Cron] Erro na sync:', err.message));
  }, THIRTY_MINUTES);
}

export function stopPncpCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log(`[PNCP Cron] Parado`);
  }
}
