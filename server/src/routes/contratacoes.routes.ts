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
    if (q.ano_compra) where.ano_compra = q.ano_compra;

    // ordem navigation filters
    if (q.ordem_lt) where.ordem = { ...(where.ordem || {}), lt: Number(q.ordem_lt) };
    if (q.ordem_gt) where.ordem = { ...(where.ordem || {}), gt: Number(q.ordem_gt) };

    // orgao_pncp not null
    if (q.orgao_pncp_not_null === 'true') {
      where.orgao_pncp = { ...(typeof where.orgao_pncp === 'object' ? where.orgao_pncp : {}), not: null };
    }

    // Date range filters — campos String (comparação textual ISO)
    const stringDateFields = [
      'dt_publicacao', 'dt_encerramento_proposta',
      'dt_atualizacao', 'dt_criacao', 'dt_importacao',
      'dt_vigencia_ini', 'dt_vinculo_ativa',
    ];
    for (const field of stringDateFields) {
      if (q[field + '_gte']) {
        where[field] = { ...(where[field] || {}), gte: q[field + '_gte'] };
      }
      if (q[field + '_lte']) {
        where[field] = { ...(where[field] || {}), lte: q[field + '_lte'] };
      }
    }
    // created_at é DateTime real — precisa converter para Date
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

    // Exclude IDs filter (para pular registros já vistos)
    if (q.exclude_ids) {
      const excludeIds = q.exclude_ids.split(',');
      where.id = { ...(where.id || {}), notIn: excludeIds };
    }

    // Sorting
    const orderField = q.sort || 'dt_publicacao';
    const orderDir = q.order === 'asc' ? 'asc' : 'desc';
    const orderBy: any = { [orderField]: orderDir };

    // Include tipo_licitacao relation?
    const wantsTipo = q.include_tipo === 'true';

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

    // Agregacao por UF (layout Resumido) — conta no banco em vez de trazer
    // todos os registros para o cliente.
    if (q.group_by === 'uf') {
      const grupos = await fastify.prisma.contratacoes.groupBy({
        by: ['uf'],
        where,
        _count: { _all: true },
      });
      const resumo = grupos.map(g => ({ uf: g.uf, quantidade: g._count._all }));
      const total = resumo.reduce((s, g) => s + g.quantidade, 0);
      return reply.send({ resumo, total });
    }

    // Unidades únicas (layout Unidades) — agrupa no banco pelas colunas
    // exibidas, evitando linhas duplicadas por causa de várias licitações
    // da mesma unidade. _count traz a quantidade de licitações por unidade.
    if (q.group_by === 'unidades') {
      const grupos = await fastify.prisma.contratacoes.groupBy({
        by: ['uf', 'esfera', 'poder', 'orgao_pncp', 'cnpj', 'unidade', 'un_cod', 'municipio'],
        where,
        _count: { _all: true },
      });
      const data = grupos.map(g => ({
        uf: g.uf, esfera: g.esfera, poder: g.poder, orgao_pncp: g.orgao_pncp,
        cnpj: g.cnpj, unidade: g.unidade, un_cod: g.un_cod, municipio: g.municipio,
        qtd_licitacoes: g._count._all,
      }));
      return reply.send({ data, total: data.length });
    }

    // Select specific fields (reduz drasticamente o tempo: evita trazer
    // colunas grandes de texto/JSON quando o cliente só precisa de algumas).
    let select: any = undefined;
    if (q.select) {
      select = {};
      q.select.split(',').forEach(f => { select[f.trim()] = true; });
      if (wantsTipo) select.tipo_licitacao = { select: { id: true, sigla: true, descricao: true } };
    }

    // include só é usado quando NÃO há select (são mutuamente exclusivos no Prisma)
    const include = (wantsTipo && !select)
      ? { tipo_licitacao: { select: { id: true, sigla: true, descricao: true } } }
      : undefined;

    // Se paginacao ativa, retorna { data, total, page, per_page, total_pages }
    if (page && perPage) {
      const findManyArgs = {
        where,
        orderBy,
        ...(include ? { include } : {}),
        ...(select && !include ? { select } : {}),
        take: perPage,
        skip: (page - 1) * perPage,
      };

      // skip_count: na navegação entre páginas o total não muda, então
      // evitamos o count (caro em 122k registros) e devolvemos só os dados.
      if (q.skip_count === 'true') {
        const contratacoes = await fastify.prisma.contratacoes.findMany(findManyArgs);
        return reply.send({ data: contratacoes, page, per_page: perPage });
      }

      const [contratacoes, total] = await Promise.all([
        fastify.prisma.contratacoes.findMany(findManyArgs),
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

    // Remover campos de relação e campos que não são colunas diretas
    // (o frontend pode enviar o objeto inteiro incluindo relações expandidas)
    const relationFields = ['tipo_licitacao', 'marcacoes', 'user', 'id'];
    for (const field of relationFields) {
      delete body[field];
    }

    // Se cadastrado_por veio como UUID string, manter; se veio como objeto, remover
    if (body.cadastrado_por && typeof body.cadastrado_por === 'object') {
      delete body.cadastrado_por;
    }

    // Se cadastrado está sendo marcado como true, gera num_ativa se ainda não tem
    if (body.cadastrado === true) {
      const existing = await fastify.prisma.contratacoes.findUnique({
        where: { id },
        select: { num_ativa: true },
      });
      if (!existing?.num_ativa) {
        const maxResult = await fastify.prisma.$queryRaw<{ next_num: number }[]>`
          SELECT COALESCE(MAX(CAST(num_ativa AS INTEGER)), 0) + 1 as next_num
          FROM contratacoes
          WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
        `;
        body.num_ativa = String(maxResult[0]?.next_num || 1);
      }
    }

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

    // Gera num_ativa apenas se cadastrado=true (licitação sendo cadastrada)
    if (body.cadastrado === true && !body.num_ativa) {
      const maxResult = await fastify.prisma.$queryRaw<{ next_num: number }[]>`
        SELECT COALESCE(MAX(CAST(num_ativa AS INTEGER)), 0) + 1 as next_num
        FROM contratacoes
        WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
      `;
      body.num_ativa = String(maxResult[0]?.next_num || 1);
    }

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

  // GET /api/contratacoes/navigate — navegacao por num_ativa (cast numerico)
  // ?direction=prev&current=7712 → busca o registro com num_ativa < 7712 (maior mais proximo)
  // ?direction=next&current=7712 → busca o registro com num_ativa > 7712 (menor mais proximo)
  // ?direction=first → busca o registro com menor num_ativa
  // ?direction=last → busca o registro com maior num_ativa
  fastify.get('/api/contratacoes/navigate', { preHandler: [requireAuth] }, async (request, reply) => {
    const { direction, current } = request.query as { direction: string; current?: string };

    let sql: string;

    switch (direction) {
      case 'prev':
        if (!current) return reply.status(400).send({ error: 'current obrigatorio para direction=prev' });
        sql = `
          SELECT id, num_ativa, created_at
          FROM contratacoes
          WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
            AND CAST(num_ativa AS INTEGER) < ${Number(current)}
          ORDER BY CAST(num_ativa AS INTEGER) DESC
          LIMIT 1
        `;
        break;
      case 'next':
        if (!current) return reply.status(400).send({ error: 'current obrigatorio para direction=next' });
        sql = `
          SELECT id, num_ativa, created_at
          FROM contratacoes
          WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
            AND CAST(num_ativa AS INTEGER) > ${Number(current)}
          ORDER BY CAST(num_ativa AS INTEGER) ASC
          LIMIT 1
        `;
        break;
      case 'first':
        sql = `
          SELECT id, num_ativa, created_at
          FROM contratacoes
          WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
          ORDER BY CAST(num_ativa AS INTEGER) ASC
          LIMIT 1
        `;
        break;
      case 'last':
        sql = `
          SELECT id, num_ativa, created_at
          FROM contratacoes
          WHERE num_ativa IS NOT NULL AND num_ativa ~ '^[0-9]+$'
          ORDER BY CAST(num_ativa AS INTEGER) DESC
          LIMIT 1
        `;
        break;
      default:
        return reply.status(400).send({ error: 'direction deve ser prev, next, first ou last' });
    }

    const result = await fastify.prisma.$queryRawUnsafe<{ id: string; num_ativa: string; created_at: Date }[]>(sql);

    if (!result || result.length === 0) {
      return reply.send({ data: null });
    }

    return reply.send({ data: result[0] });
  });
}
