import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const tipoSchema = z.object({
  sigla: z.string().min(1),
  descricao: z.string().optional(),
});

export default async function tipoLicitacoesRoutes(fastify: FastifyInstance) {
  // GET /api/tipo-licitacoes
  fastify.get('/api/tipo-licitacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const { search } = request.query as { search?: string };

    // Ignora acento nos dois sentidos ("pregao" acha "PREGÃO").
    let where = {};
    if (search) {
      const encontrados = await fastify.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM tipo_licitacoes
        WHERE f_unaccent(sigla) ILIKE f_unaccent(${'%' + search + '%'})
           OR f_unaccent(coalesce(descricao, '')) ILIKE f_unaccent(${'%' + search + '%'})
      `;
      where = { id: { in: encontrados.map(t => t.id) } };
    }

    const tipos = await fastify.prisma.tipo_licitacoes.findMany({
      where,
      orderBy: { sigla: 'asc' },
    });
    return reply.send(tipos);
  });

  // GET /api/tipo-licitacoes/by-ids
  fastify.post('/api/tipo-licitacoes/by-ids', { preHandler: [requireAuth] }, async (request, reply) => {
    const { ids } = request.body as { ids: string[] };
    if (!ids || !Array.isArray(ids)) return reply.status(400).send({ error: 'ids obrigatorio' });

    const tipos = await fastify.prisma.tipo_licitacoes.findMany({
      where: { id: { in: ids } },
    });
    return reply.send(tipos);
  });

  // POST /api/tipo-licitacoes
  fastify.post('/api/tipo-licitacoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = tipoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const tipo = await fastify.prisma.tipo_licitacoes.create({ data: body.data });
    return reply.status(201).send(tipo);
  });

  // DELETE /api/tipo-licitacoes/:id
  fastify.delete('/api/tipo-licitacoes/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.tipo_licitacoes.delete({ where: { id } });
    return reply.status(204).send();
  });
}
