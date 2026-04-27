import { FastifyInstance } from 'fastify';
import { requireAuth, getUserId } from '../middleware/requireAuth.js';

export default async function contratacoesRoutes(fastify: FastifyInstance) {
  // GET /api/contratacoes — com filtros dinamicos
  fastify.get('/api/contratacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;

    const where: any = {};

    // Filtros booleanos
    if (q.cadastrado !== undefined) where.cadastrado = q.cadastrado === 'true';
    if (q.enviada !== undefined) where.enviada = q.enviada === 'true';
    // Nota: campo 'excluido' nao existe no schema — filtros ignorados

    // Texto search
    if (q.orgao_pncp) where.orgao_pncp = { contains: q.orgao_pncp, mode: 'insensitive' };
    if (q.municipio) where.municipio = { contains: q.municipio, mode: 'insensitive' };
    if (q.num_ativa) where.num_ativa = { contains: q.num_ativa, mode: 'insensitive' };
    if (q.cd_pn) where.cd_pn = { contains: q.cd_pn, mode: 'insensitive' };

    // Enum filters
    if (q.esfera) where.esfera = q.esfera;
    if (q.poder) where.poder = q.poder;
    if (q.descricao_modalidade) where.descricao_modalidade = q.descricao_modalidade;
    if (q.modalidade) where.modalidade = q.modalidade;

    // UF filter (single value or comma-separated list)
    if (q.uf) {
      where.uf = q.uf;
    } else if (q.ufs) {
      const ufs = q.ufs.split(',');
      where.uf = { in: ufs };
    }

    // ano_compra filter
    if (q.ano_compra) where.ano_compra = Number(q.ano_compra);

    // ordem navigation filters
    if (q.ordem_lt) where.ordem = { ...(where.ordem || {}), lt: Number(q.ordem_lt) };
    if (q.ordem_gt) where.ordem = { ...(where.ordem || {}), gt: Number(q.ordem_gt) };

    // orgao_pncp not null
    if (q.orgao_pncp_not_null === 'true') {
      where.orgao_pncp = { ...(typeof where.orgao_pncp === 'object' ? where.orgao_pncp : {}), not: null };
    }

    // Date range filters
    if (q.dt_publicacao_gte) {
      where.dt_publicacao = { ...(where.dt_publicacao || {}), gte: q.dt_publicacao_gte };
    }
    if (q.dt_publicacao_lte) {
      where.dt_publicacao = { ...(where.dt_publicacao || {}), lte: q.dt_publicacao_lte };
    }
    if (q.dt_encerramento_proposta_gte) {
      where.dt_encerramento_proposta = { ...(where.dt_encerramento_proposta || {}), gte: q.dt_encerramento_proposta_gte };
    }
    if (q.dt_encerramento_proposta_lte) {
      where.dt_encerramento_proposta = { ...(where.dt_encerramento_proposta || {}), lte: q.dt_encerramento_proposta_lte };
    }
    if (q.created_at_gte) {
      where.created_at = { ...(where.created_at || {}), gte: new Date(q.created_at_gte) };
    }
    if (q.created_at_lte) {
      where.created_at = { ...(where.created_at || {}), lte: new Date(q.created_at_lte) };
    }

    // IDs filter
    if (q.ids) {
      const ids = q.ids.split(',');
      where.id = { in: ids };
    }

    // Sorting
    const orderField = q.sort || 'dt_publicacao';
    const orderDir = q.order === 'asc' ? 'asc' : 'desc';
    const orderBy: any = { [orderField]: orderDir };

    // Include tipo_licitacao relation?
    const include = q.include_tipo === 'true'
      ? { tipo_licitacao: { select: { id: true, sigla: true, descricao: true } } }
      : undefined;

    // Limit
    const take = q.limit ? Number(q.limit) : undefined;

    // Paginacao (page + per_page)
    const page = q.page ? Number(q.page) : undefined;
    const perPage = q.per_page ? Number(q.per_page) : undefined;

    // Count only mode
    if (q.count_only === 'true') {
      const count = await fastify.prisma.contratacoes.count({ where });
      return reply.send({ count });
    }

    // Select specific fields
    let select: any = undefined;
    if (q.select) {
      select = {};
      q.select.split(',').forEach(f => { select[f.trim()] = true; });
    }

    // Se paginacao ativa, retorna { data, total, page, per_page, total_pages }
    if (page && perPage) {
      const [contratacoes, total] = await Promise.all([
        fastify.prisma.contratacoes.findMany({
          where,
          orderBy,
          ...(include ? { include } : {}),
          ...(select && !include ? { select } : {}),
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        fastify.prisma.contratacoes.count({ where }),
      ]);

      return reply.send({
        data: contratacoes,
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
      });
    }

    const contratacoes = await fastify.prisma.contratacoes.findMany({
      where,
      orderBy,
      ...(include ? { include } : {}),
      ...(select && !include ? { select } : {}),
      ...(take ? { take } : {}),
    });

    return reply.send(contratacoes);
  });

  // GET /api/contratacoes/:id
  fastify.get('/api/contratacoes/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const contratacao = await fastify.prisma.contratacoes.findUnique({
      where: { id },
      include: {
        tipo_licitacao: true,
        marcacoes: { include: { ramo: { select: { nome: true } } } },
      },
    });
    if (!contratacao) return reply.status(404).send({ error: 'Contratacao nao encontrada' });
    return reply.send(contratacao);
  });

  // PATCH /api/contratacoes/:id — atualiza campos individuais
  fastify.patch('/api/contratacoes/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const contratacao = await fastify.prisma.contratacoes.update({
      where: { id },
      data: body,
    });
    return reply.send(contratacao);
  });

  // PATCH /api/contratacoes/batch — atualiza varios de uma vez
  fastify.patch('/api/contratacoes/batch', { preHandler: [requireAuth] }, async (request, reply) => {
    const { ids, data } = request.body as { ids: string[]; data: Record<string, unknown> };
    if (!ids || !Array.isArray(ids)) return reply.status(400).send({ error: 'ids obrigatorio' });

    await fastify.prisma.contratacoes.updateMany({
      where: { id: { in: ids } },
      data,
    });
    return reply.send({ ok: true, count: ids.length });
  });

  // POST /api/contratacoes — criar
  fastify.post('/api/contratacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const contratacao = await fastify.prisma.contratacoes.create({ data: body as any });
    return reply.status(201).send(contratacao);
  });

  // ─── Marcacoes ─────────────────────────────────
  // GET /api/contratacoes/:id/marcacoes
  fastify.get('/api/contratacoes/:id/marcacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const marcacoes = await fastify.prisma.contratacoes_marcacoes.findMany({
      where: { contratacao_id: id },
      include: { ramo: { select: { id: true, nome: true } } },
    });
    return reply.send(marcacoes);
  });

  // POST /api/contratacoes/:id/marcacoes — substitui todas as marcacoes
  fastify.post('/api/contratacoes/:id/marcacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { ramo_ids } = request.body as { ramo_ids: string[] };

    await fastify.prisma.$transaction(async (tx) => {
      await tx.contratacoes_marcacoes.deleteMany({ where: { contratacao_id: id } });
      if (ramo_ids && ramo_ids.length > 0) {
        await tx.contratacoes_marcacoes.createMany({
          data: ramo_ids.map(ramo_id => ({ contratacao_id: id, ramo_id })),
        });
      }
    });

    return reply.send({ ok: true });
  });

  // GET /api/contratacoes-marcacoes — todas as marcacoes (para MarcacoesPendentes)
  fastify.get('/api/contratacoes-marcacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const marcacoes = await fastify.prisma.contratacoes_marcacoes.findMany({
      select: { contratacao_id: true, ramo_id: true },
    });
    return reply.send(marcacoes);
  });

  // ─── Relatorio Produtividade ────────────────────
  fastify.get('/api/contratacoes/relatorio/produtividade', { preHandler: [requireAuth] }, async (request, reply) => {
    const { dt_inicio, dt_fim } = request.query as { dt_inicio?: string; dt_fim?: string };

    const where: any = { cadastrado: true };
    if (dt_inicio) where.created_at = { ...(where.created_at || {}), gte: new Date(dt_inicio) };
    if (dt_fim) where.created_at = { ...(where.created_at || {}), lte: new Date(dt_fim) };

    const contratacoes = await fastify.prisma.contratacoes.findMany({
      where,
      select: {
        created_at: true,
        tipo_cadastro: true,
        cadastrado_por: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return reply.send(contratacoes);
  });

  // GET /api/contratacoes/check-num-ativa — verifica se num_ativa ja existe no mes
  fastify.get('/api/contratacoes/check-num-ativa', { preHandler: [requireAuth] }, async (request, reply) => {
    const { num_ativa, start_date, end_date } = request.query as {
      num_ativa: string; start_date: string; end_date: string;
    };

    const existing = await fastify.prisma.contratacoes.findFirst({
      where: {
        num_ativa,
        created_at: {
          gte: new Date(start_date),
          lt: new Date(end_date),
        },
      },
    });

    return reply.send({ exists: !!existing, data: existing });
  });
}
