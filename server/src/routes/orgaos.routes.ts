import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const orgaoSchema = z.object({
  nome_orgao: z.string().min(1),
  uf: z.string().nullable().optional(),
  cidade_ibge: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  emails: z.array(z.string()).optional().default([]),
  sites: z.array(z.string()).optional().default([]),
  observacoes: z.string().nullable().optional(),
  obs_pncp: z.string().nullable().optional(),
  compras_net: z.string().nullable().optional(),
  compras_mg: z.string().nullable().optional(),
});

export default async function orgaosRoutes(fastify: FastifyInstance) {
  // GET /api/orgaos
  fastify.get('/api/orgaos', { preHandler: [requireAuth] }, async (request, reply) => {
    const { search, uf, telefone, compras } = request.query as {
      search?: string; uf?: string; telefone?: string; compras?: string;
    };

    const where: any = {};

    if (search) {
      where.nome_orgao = { contains: search, mode: 'insensitive' };
    }
    if (uf) {
      where.uf = uf;
    }
    if (telefone) {
      where.telefone = { contains: telefone, mode: 'insensitive' };
    }
    if (compras) {
      where.OR = [
        { compras_net: { contains: compras, mode: 'insensitive' } },
        { compras_mg: { contains: compras, mode: 'insensitive' } },
      ];
    }

    const orgaos = await fastify.prisma.orgaos.findMany({
      where,
      orderBy: { nome_orgao: 'asc' },
    });
    return reply.send(orgaos);
  });

  // GET /api/orgaos/:id
  fastify.get('/api/orgaos/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgao = await fastify.prisma.orgaos.findUnique({ where: { id } });
    if (!orgao) return reply.status(404).send({ error: 'Orgao nao encontrado' });
    return reply.send(orgao);
  });

  // POST /api/orgaos
  fastify.post('/api/orgaos', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = orgaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos', details: body.error.flatten() });

    const orgao = await fastify.prisma.orgaos.create({ data: body.data });
    return reply.status(201).send(orgao);
  });

  // PUT /api/orgaos/:id
  fastify.put('/api/orgaos/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = orgaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const orgao = await fastify.prisma.orgaos.update({
      where: { id },
      data: body.data,
    });
    return reply.send(orgao);
  });

  // GET /api/orgaos/:id/grupos — grupos de um orgao
  fastify.get('/api/orgaos/:id/grupos', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const grupos = await fastify.prisma.orgaos_grupos.findMany({
      where: { orgao_id: id },
      select: { grupo_id: true },
    });
    return reply.send(grupos.map(g => g.grupo_id));
  });

  // PUT /api/orgaos/:id/grupos — substitui os grupos de um orgao
  fastify.put('/api/orgaos/:id/grupos', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { grupo_ids } = request.body as { grupo_ids: string[] };

    await fastify.prisma.$transaction(async (tx) => {
      await tx.orgaos_grupos.deleteMany({ where: { orgao_id: id } });
      if (grupo_ids && grupo_ids.length > 0) {
        await tx.orgaos_grupos.createMany({
          data: grupo_ids.map(grupo_id => ({ orgao_id: id, grupo_id })),
        });
      }
    });

    return reply.send({ ok: true });
  });

  // ─── Orgaos Vinculados ─────────────────────────
  // GET /api/orgaos-vinculados
  fastify.get('/api/orgaos-vinculados', { preHandler: [requireAuth] }, async (request, reply) => {
    const vinculados = await fastify.prisma.orgaos_vinculados.findMany({
      select: { cnpj: true, orgao_id: true, orgao_nome: true },
    });
    return reply.send(vinculados);
  });

  // POST /api/orgaos-vinculados/upsert
  fastify.post('/api/orgaos-vinculados/upsert', { preHandler: [requireAuth] }, async (request, reply) => {
    const { cnpj, orgao_id, orgao_nome } = request.body as {
      cnpj: string; orgao_id: string | null; orgao_nome: string | null;
    };

    const result = await fastify.prisma.$executeRaw`
      INSERT INTO orgaos_vinculados (id, cnpj, orgao_id, orgao_nome, created_at, updated_at)
      VALUES (gen_random_uuid(), ${cnpj}, ${orgao_id}, ${orgao_nome}, NOW(), NOW())
      ON CONFLICT (cnpj) DO UPDATE SET orgao_id = ${orgao_id}, orgao_nome = ${orgao_nome}, updated_at = NOW()
    `;

    return reply.send({ ok: true });
  });

  // GET /api/orgaos/sem-ibge — orgaos sem cidade_ibge
  fastify.get('/api/orgaos/sem-ibge', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgaos = await fastify.prisma.orgaos.findMany({
      where: {
        OR: [
          { cidade_ibge: null },
          { cidade_ibge: '' },
        ],
      },
      orderBy: { nome_orgao: 'asc' },
    });
    return reply.send(orgaos);
  });
}
