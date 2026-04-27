import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const ramoSchema = z.object({
  nome: z.string().min(1),
  e_grupo: z.boolean().optional(),
  grupo_relacionado: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

export default async function ramosAtividadeRoutes(fastify: FastifyInstance) {
  // GET /api/ramos-atividade
  fastify.get('/api/ramos-atividade', { preHandler: [requireAuth] }, async (request, reply) => {
    const ramos = await fastify.prisma.ramos_de_atividade.findMany({
      orderBy: { nome: 'asc' },
    });
    return reply.send(ramos);
  });

  // POST /api/ramos-atividade
  fastify.post('/api/ramos-atividade', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = ramoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const ramo = await fastify.prisma.ramos_de_atividade.create({ data: body.data });
    return reply.status(201).send(ramo);
  });

  // PATCH /api/ramos-atividade/:id
  fastify.patch('/api/ramos-atividade/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const ramo = await fastify.prisma.ramos_de_atividade.update({
      where: { id },
      data: body,
    });
    return reply.send(ramo);
  });

  // DELETE /api/ramos-atividade/:id
  fastify.delete('/api/ramos-atividade/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.ramos_de_atividade.delete({ where: { id } });
    return reply.status(204).send();
  });
}
