import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { syncPncp, getSyncStatus, getSyncConfig, backfillNumAtiva, type SyncModo } from '../services/pncp-sync.service.js';

export default async function pncpSyncRoutes(fastify: FastifyInstance) {
  // GET /api/pncp-sync/status — verificar status do sync
  fastify.get('/api/pncp-sync/status', { preHandler: [requireAuth] }, async (_request, reply) => {
    const status = getSyncStatus();
    return reply.send(status);
  });

  // GET /api/pncp-sync/config — configuracao das buscas (tela Config. Busca)
  fastify.get('/api/pncp-sync/config', { preHandler: [requireAuth] }, async (_request, reply) => {
    const config = getSyncConfig();

    // Nome de cada modalidade vem da propria base, e nao de uma lista fixa aqui,
    // para nao divergir do que o PNCP devolve.
    const nomes = await fastify.prisma.contratacoes.findMany({
      where: { id_codigo_modalidade: { in: config.modalidades }, modalidade: { not: null } },
      select: { id_codigo_modalidade: true, modalidade: true },
      distinct: ['id_codigo_modalidade'],
    });
    const porCodigo = new Map(nomes.map(n => [n.id_codigo_modalidade, n.modalidade]));

    // Quantas licitacoes de cada modalidade a base tem hoje.
    const totais = await fastify.prisma.contratacoes.groupBy({
      by: ['id_codigo_modalidade'],
      _count: { _all: true },
    });
    const porTotal = new Map(totais.map(t => [t.id_codigo_modalidade, t._count._all]));

    return reply.send({
      ...config,
      modalidades: config.modalidades.map(codigo => ({
        codigo,
        nome: porCodigo.get(codigo) ?? 'Sem licitacao importada ainda',
        totalNaBase: porTotal.get(codigo) ?? 0,
      })),
      status: getSyncStatus(),
    });
  });

  /**
   * POST /api/pncp-sync/conferir-planilha
   *
   * Recebe os numeros de controle PNCP de uma planilha (layout Detalhado) e
   * responde quais NAO estao no sistema. A planilha e lida no navegador; aqui
   * chega so a lista de numeros.
   */
  fastify.post('/api/pncp-sync/conferir-planilha', { preHandler: [requireAuth] }, async (request, reply) => {
    const { numeros } = request.body as { numeros?: unknown };

    if (!Array.isArray(numeros) || numeros.length === 0) {
      return reply.status(400).send({ error: 'Nenhum número PNCP recebido. Confira se a planilha tem a coluna NumPncp.' });
    }

    // A mesma licitacao pode aparecer repetida na planilha (acontece nos exports).
    const limpos = [...new Set(numeros.map(n => String(n ?? '').trim()).filter(Boolean))];
    if (limpos.length === 0) {
      return reply.status(400).send({ error: 'A coluna NumPncp veio vazia.' });
    }
    if (limpos.length > 50000) {
      return reply.status(413).send({ error: 'Planilha grande demais: máximo de 50.000 licitações por conferência.' });
    }

    // Consulta em lotes: um IN com dezenas de milhares de itens trava o Postgres.
    const LOTE = 5000;
    const encontradas: { num_licitacao: string | null; cadastrado: boolean | null; excluido: boolean | null; num_ativa: string | null }[] = [];
    for (let i = 0; i < limpos.length; i += LOTE) {
      const parte = await fastify.prisma.contratacoes.findMany({
        where: { num_licitacao: { in: limpos.slice(i, i + LOTE) } },
        select: { num_licitacao: true, cadastrado: true, excluido: true, num_ativa: true },
      });
      encontradas.push(...parte);
    }

    const presentes = new Set(encontradas.map(e => e.num_licitacao));
    const ausentes = limpos.filter(n => !presentes.has(n));

    return reply.send({
      totalNaPlanilha: numeros.length,
      totalDistintos: limpos.length,
      ausentes,
      resumo: {
        ausentes: ausentes.length,
        presentes: presentes.size,
        presentesCadastradas: encontradas.filter(e => e.cadastrado).length,
        presentesNaoCadastradas: encontradas.filter(e => !e.cadastrado && !e.excluido).length,
        presentesExcluidas: encontradas.filter(e => e.excluido).length,
      },
    });
  });

  // POST /api/pncp-sync/trigger — disparar sync manualmente
  // ?modo=incremental (rapido, publicadas nos ultimos dias) ou completo (padrao)
  fastify.post('/api/pncp-sync/trigger', { preHandler: [requireAuth] }, async (request, reply) => {
    const status = getSyncStatus();

    if (status.isSyncing) {
      return reply.status(409).send({ error: 'Sync ja esta em andamento' });
    }

    const modo: SyncModo = (request.query as any)?.modo === 'incremental' ? 'incremental' : 'completo';

    // Disparar em background (nao aguardar)
    syncPncp(fastify.prisma, modo).catch(err => {
      console.error('[PNCP Sync] Erro no trigger manual:', err.message);
    });

    return reply.send({ message: `Sync ${modo} iniciado em background`, modo, startedAt: new Date().toISOString() });
  });

  // POST /api/pncp-sync/backfill-num-ativa — preencher num_ativa em registros existentes
  fastify.post('/api/pncp-sync/backfill-num-ativa', { preHandler: [requireAuth] }, async (_request, reply) => {
    try {
      const count = await backfillNumAtiva(fastify.prisma);
      return reply.send({ message: `Backfill concluido: ${count} registros atualizados`, count });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/pncp-sync/run — disparar sync e aguardar resultado
  fastify.post('/api/pncp-sync/run', { preHandler: [requireAuth] }, async (request, reply) => {
    const status = getSyncStatus();

    if (status.isSyncing) {
      return reply.status(409).send({ error: 'Sync ja esta em andamento' });
    }

    const modo: SyncModo = (request.query as any)?.modo === 'incremental' ? 'incremental' : 'completo';

    try {
      const result = await syncPncp(fastify.prisma, modo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
  // GET /api/pncp/itens?cnpj=&ano=&sequencial=&pagina=&tamanhoPagina=
  // Espelho dos itens do edital (botão "Exibir Licitação" do Cadastro).
  // Passa pelo servidor porque a página do PNCP não abre em iframe
  // (X-Frame-Options: SAMEORIGIN).
  fastify.get('/api/pncp/itens', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = request.query as { cnpj?: string; ano?: string; sequencial?: string; pagina?: string; tamanhoPagina?: string };
    const cnpj = (q.cnpj || '').replace(/\D/g, '');
    const ano = (q.ano || '').replace(/\D/g, '');
    const sequencial = String(Number((q.sequencial || '').replace(/\D/g, '')) || '');
    if (cnpj.length !== 14 || ano.length !== 4 || !sequencial) {
      return reply.status(400).send({ error: 'Informe cnpj (14 dígitos), ano e sequencial da compra no PNCP.' });
    }
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const tamanhoPagina = Math.min(50, Math.max(1, Number(q.tamanhoPagina) || 10));
    const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`;

    const buscar = async (url: string) => {
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (res.status === 204 || res.status === 404) return null;
      if (!res.ok) throw new Error(`PNCP respondeu ${res.status}`);
      const texto = await res.text();
      return texto ? JSON.parse(texto) : null;
    };

    try {
      const [itens, total] = await Promise.all([
        buscar(`${base}?pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`),
        buscar(`${base}/quantidade`),
      ]);
      return reply.send({
        pagina,
        tamanhoPagina,
        total: Number(total) || 0,
        link: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`,
        itens: (Array.isArray(itens) ? itens : []).map((i: any) => ({
          numeroItem: i.numeroItem,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidadeMedida: i.unidadeMedida,
          valorUnitarioEstimado: i.valorUnitarioEstimado,
          valorTotal: i.valorTotal,
          orcamentoSigiloso: !!i.orcamentoSigiloso,
          situacao: i.situacaoCompraItemNome || null,
        })),
      });
    } catch (err: any) {
      return reply.status(502).send({ error: `Não foi possível consultar o PNCP: ${err.message}` });
    }
  });
}
