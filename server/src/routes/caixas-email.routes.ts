import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const caixaSchema = z.object({
  sigla: z.string().min(1),
  descricao: z.string().min(1),
});

export default async function caixasEmailRoutes(fastify: FastifyInstance) {
  // GET /api/caixas-email
  fastify.get('/api/caixas-email', { preHandler: [requireAuth] }, async (request, reply) => {
    const caixas = await fastify.prisma.caixas_email.findMany({
      orderBy: { sigla: 'asc' },
    });
    return reply.send(caixas);
  });

  // POST /api/caixas-email
  fastify.post('/api/caixas-email', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = caixaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const caixa = await fastify.prisma.caixas_email.create({ data: body.data });
    return reply.status(201).send(caixa);
  });

  // PUT /api/caixas-email/:id
  fastify.put('/api/caixas-email/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = caixaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const caixa = await fastify.prisma.caixas_email.update({
      where: { id },
      data: body.data,
    });
    return reply.send(caixa);
  });

  // DELETE /api/caixas-email/:id
  fastify.delete('/api/caixas-email/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.caixas_email.delete({ where: { id } });
    return reply.status(204).send();
  });
}
