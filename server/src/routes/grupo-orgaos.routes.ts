import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const grupoSchema = z.object({
  nome: z.string().min(1),
});

export default async function grupoOrgaosRoutes(fastify: FastifyInstance) {
  // GET /api/grupo-orgaos
  fastify.get('/api/grupo-orgaos', { preHandler: [requireAuth] }, async (request, reply) => {
    const grupos = await fastify.prisma.grupo_de_orgaos.findMany({
      orderBy: { nome: 'asc' },
    });
    return reply.send(grupos);
  });

  // POST /api/grupo-orgaos
  fastify.post('/api/grupo-orgaos', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = grupoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const grupo = await fastify.prisma.grupo_de_orgaos.create({ data: body.data });
    return reply.status(201).send(grupo);
  });

  // DELETE /api/grupo-orgaos/:id
  fastify.delete('/api/grupo-orgaos/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.grupo_de_orgaos.delete({ where: { id } });
    return reply.status(204).send();
  });
}
