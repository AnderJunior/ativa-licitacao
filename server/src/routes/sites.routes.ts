import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const siteSchema = z.object({
  dominio: z.string().min(1),
  site: z.string().min(1),
});

export default async function sitesRoutes(fastify: FastifyInstance) {
  // GET /api/sites
  fastify.get('/api/sites', { preHandler: [requireAuth] }, async (request, reply) => {
    const sites = await fastify.prisma.sites.findMany({
      orderBy: { dominio: 'asc' },
    });
    return reply.send(sites);
  });

  // POST /api/sites
  fastify.post('/api/sites', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = siteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const site = await fastify.prisma.sites.create({ data: body.data });
    return reply.status(201).send(site);
  });

  // POST /api/sites/by-urls — check which URLs already exist
  fastify.post('/api/sites/by-urls', { preHandler: [requireAuth] }, async (request, reply) => {
    const { urls } = request.body as { urls: string[] };
    if (!urls || !Array.isArray(urls)) return reply.status(400).send({ error: 'urls obrigatorio' });

    const sites = await fastify.prisma.sites.findMany({
      where: { site: { in: urls } },
      select: { site: true },
    });
    return reply.send(sites);
  });

  // PUT /api/sites/:id
  fastify.put('/api/sites/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = siteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const site = await fastify.prisma.sites.update({
      where: { id },
      data: body.data,
    });
    return reply.send(site);
  });

  // DELETE /api/sites/:id
  fastify.delete('/api/sites/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.sites.delete({ where: { id } });
    return reply.status(204).send();
  });
}
