import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, getUserId } from '../middleware/requireAuth.js';

/**
 * Relatórios de licitações enviados aos clientes.
 *
 * Um relatório reúne várias licitações sob um número (o "N.Relatório") e uma
 * data de envio, para um cliente. A tela "Licitações Enviadas > Por Cliente"
 * lista os ITENS desses relatórios — uma linha por licitação enviada.
 */

const itemSchema = z.object({
  num_relatorio: z.number().int().positive().optional(),
  cliente_id: z.string().uuid(),
  dt_envio: z.string().optional(),
  observacoes: z.string().nullable().optional(),
  contratacao_ids: z.array(z.string().uuid()).min(1),
});

export default async function relatoriosEnvioRoutes(fastify: FastifyInstance) {
  // GET /api/relatorios-envio — uma linha por licitação enviada (com filtros da tela)
  fastify.get('/api/relatorios-envio', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;

    // ── Filtros sobre o relatório ──
    const whereRelatorio: any = {};
    if (q.num_relatorio) {
      const n = Number(q.num_relatorio);
      if (!Number.isNaN(n)) whereRelatorio.num_relatorio = n;
    }
    if (q.cliente_id) whereRelatorio.cliente_id = q.cliente_id;
    if (q.cliente) {
      whereRelatorio.cliente = { nome: { contains: q.cliente, mode: 'insensitive' } };
    }

    // Periodo de emissao. "filtrar_por" escolhe a data usada, como na tela antiga:
    // dt_envio (padrao) ou a data de alteracao da propria licitacao.
    const filtrarPor = q.filtrar_por === 'dt_alteracao' ? 'dt_alteracao' : 'dt_envio';
    if (filtrarPor === 'dt_envio') {
      if (q.dt_inicio) whereRelatorio.dt_envio = { ...(whereRelatorio.dt_envio || {}), gte: new Date(q.dt_inicio) };
      if (q.dt_fim) whereRelatorio.dt_envio = { ...(whereRelatorio.dt_envio || {}), lte: new Date(q.dt_fim) };
    }

    // ── Filtros sobre a licitação ──
    const whereContratacao: any = {};
    if (q.num_ativa) whereContratacao.num_ativa = { contains: q.num_ativa, mode: 'insensitive' };
    if (q.uf) whereContratacao.uf = q.uf;
    if (q.descricao_modalidade) whereContratacao.descricao_modalidade = q.descricao_modalidade;
    if (q.orgao_pncp) whereContratacao.orgao_pncp = { contains: q.orgao_pncp, mode: 'insensitive' };
    if (filtrarPor === 'dt_alteracao') {
      if (q.dt_inicio) whereContratacao.dt_atualizacao = { ...(whereContratacao.dt_atualizacao || {}), gte: q.dt_inicio };
      if (q.dt_fim) whereContratacao.dt_atualizacao = { ...(whereContratacao.dt_atualizacao || {}), lte: q.dt_fim };
    }

    const where: any = {};
    if (Object.keys(whereRelatorio).length > 0) where.relatorio = whereRelatorio;
    if (Object.keys(whereContratacao).length > 0) where.contratacao = whereContratacao;

    // "Qtd Max Registros" da tela antiga
    const limiteBruto = q.limit ? Number(q.limit) : 150;
    const take = Number.isNaN(limiteBruto) ? 150 : Math.min(Math.max(limiteBruto, 1), 5000);

    if (q.count_only === 'true') {
      const count = await fastify.prisma.relatorios_envio_itens.count({ where });
      return reply.send({ count });
    }

    const itens = await fastify.prisma.relatorios_envio_itens.findMany({
      where,
      take,
      orderBy: [{ relatorio: { dt_envio: 'desc' } }, { created_at: 'desc' }],
      include: {
        relatorio: { include: { cliente: { select: { id: true, nome: true } } } },
        contratacao: {
          select: {
            id: true, num_ativa: true, uf: true, titulo: true, num_licitacao: true,
            ano_compra: true, orgao_pncp: true, dt_publicacao: true, dt_atualizacao: true,
            modalidade: true, descricao_modalidade: true, created_at: true,
            tipo_licitacao: { select: { id: true, sigla: true, descricao: true } },
          },
        },
      },
    });

    // Achatado em uma linha por licitação enviada — é o formato que a tela consome.
    const linhas = itens.map(i => ({
      id: i.id,
      contratacao_id: i.contratacao_id,
      num_relatorio: i.relatorio.num_relatorio,
      dt_envio: i.relatorio.dt_envio,
      cliente_id: i.relatorio.cliente_id,
      cliente_nome: i.relatorio.cliente?.nome || null,
      num_ativa: i.contratacao.num_ativa,
      contratacao_created_at: i.contratacao.created_at,
      uf: i.contratacao.uf,
      titulo: i.contratacao.titulo,
      num_licitacao: i.contratacao.num_licitacao,
      ano_compra: i.contratacao.ano_compra,
      orgao_pncp: i.contratacao.orgao_pncp,
      dt_publicacao: i.contratacao.dt_publicacao,
      dt_atualizacao: i.contratacao.dt_atualizacao,
      modalidade: i.contratacao.modalidade,
      descricao_modalidade: i.contratacao.descricao_modalidade,
      tipo_licitacao: i.contratacao.tipo_licitacao,
    }));

    return reply.send(linhas);
  });

  // GET /api/relatorios-envio/relatorios — os relatórios em si (cabeçalho + total de itens)
  fastify.get('/api/relatorios-envio/relatorios', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const where: any = {};
    if (q.cliente_id) where.cliente_id = q.cliente_id;
    if (q.dt_inicio) where.dt_envio = { ...(where.dt_envio || {}), gte: new Date(q.dt_inicio) };
    if (q.dt_fim) where.dt_envio = { ...(where.dt_envio || {}), lte: new Date(q.dt_fim) };

    const relatorios = await fastify.prisma.relatorios_envio.findMany({
      where,
      orderBy: { dt_envio: 'desc' },
      take: q.limit ? Math.min(Number(q.limit) || 150, 1000) : 150,
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { itens: true } },
      },
    });

    return reply.send(relatorios.map(r => ({
      id: r.id,
      num_relatorio: r.num_relatorio,
      dt_envio: r.dt_envio,
      cliente_id: r.cliente_id,
      cliente_nome: r.cliente?.nome || null,
      observacoes: r.observacoes,
      qtd_licitacoes: r._count.itens,
    })));
  });

  // POST /api/relatorios-envio — registra um envio (usado pelo fluxo de e-mail, a implementar)
  fastify.post('/api/relatorios-envio', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = itemSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Dados invalidos', details: body.error.flatten() });
    }
    const { num_relatorio, cliente_id, dt_envio, observacoes, contratacao_ids } = body.data;

    const criado = await fastify.prisma.$transaction(async (tx) => {
      // Numero sequencial do relatorio, quando nao vier informado.
      let numero = num_relatorio;
      if (numero == null) {
        const ultimo = await tx.relatorios_envio.findFirst({
          orderBy: { num_relatorio: 'desc' },
          select: { num_relatorio: true },
        });
        numero = (ultimo?.num_relatorio || 0) + 1;
      }

      const relatorio = await tx.relatorios_envio.create({
        data: {
          num_relatorio: numero,
          cliente_id,
          dt_envio: dt_envio ? new Date(dt_envio) : new Date(),
          enviado_por: getUserId(request),
          observacoes: observacoes ?? null,
        },
      });

      const ids = [...new Set(contratacao_ids)];
      await tx.relatorios_envio_itens.createMany({
        data: ids.map(contratacao_id => ({ relatorio_id: relatorio.id, contratacao_id })),
        skipDuplicates: true,
      });

      // As licitacoes enviadas passam a contar como enviadas.
      await tx.contratacoes.updateMany({ where: { id: { in: ids } }, data: { enviada: true } });

      return { ...relatorio, qtd_licitacoes: ids.length };
    });

    return reply.status(201).send(criado);
  });

  // DELETE /api/relatorios-envio/:id — desfaz um envio
  fastify.delete('/api/relatorios-envio/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const relatorio = await fastify.prisma.relatorios_envio.findUnique({
      where: { id },
      include: { itens: { select: { contratacao_id: true } } },
    });
    if (!relatorio) return reply.status(404).send({ error: 'Relatorio nao encontrado' });

    const ids = relatorio.itens.map(i => i.contratacao_id);

    await fastify.prisma.$transaction(async (tx) => {
      await tx.relatorios_envio.delete({ where: { id } }); // itens caem em cascata

      // Só volta a licitação para "não enviada" se ela não estiver em outro relatório.
      if (ids.length > 0) {
        const aindaEnviadas = await tx.relatorios_envio_itens.findMany({
          where: { contratacao_id: { in: ids } },
          select: { contratacao_id: true },
        });
        const comOutroEnvio = new Set(aindaEnviadas.map(i => i.contratacao_id));
        const paraReverter = ids.filter(cid => !comOutroEnvio.has(cid));
        if (paraReverter.length > 0) {
          await tx.contratacoes.updateMany({ where: { id: { in: paraReverter } }, data: { enviada: false } });
        }
      }
    });

    return reply.status(204).send();
  });
}
