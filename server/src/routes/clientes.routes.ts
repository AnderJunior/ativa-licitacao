import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const clienteSchema = z.object({
  nome: z.string().min(1),
  contato: z.string().nullable().optional(),
  fone: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  cod_interno: z.string().nullable().optional(),
  obs: z.string().nullable().optional(),
  cliente_ativo: z.boolean().optional(),
  cortesia_bloqueio: z.string().nullable().optional(),
  alterado_por: z.string().nullable().optional(),
});

export default async function clientesRoutes(fastify: FastifyInstance) {
  // GET /api/clientes
  fastify.get('/api/clientes', { preHandler: [requireAuth] }, async (request, reply) => {
    const clientes = await fastify.prisma.clientes.findMany({
      orderBy: { nome: 'asc' },
    });
    return reply.send(clientes);
  });

  // GET /api/clientes/:id — com todas as relacoes
  fastify.get('/api/clientes/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cliente = await fastify.prisma.clientes.findUnique({
      where: { id },
      include: {
        emails: true,
        perfis: {
          include: {
            ufs: true,
            atividades: true,
          },
        },
        grupos_orgaos: true,
      },
    });
    if (!cliente) return reply.status(404).send({ error: 'Cliente nao encontrado' });
    return reply.send(cliente);
  });

  // POST /api/clientes
  fastify.post('/api/clientes', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = clienteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const data: any = { ...body.data };
    if (data.cortesia_bloqueio) {
      data.cortesia_bloqueio = new Date(data.cortesia_bloqueio);
    }

    const cliente = await fastify.prisma.clientes.create({ data });
    return reply.status(201).send(cliente);
  });

  // PUT /api/clientes/:id
  fastify.put('/api/clientes/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = clienteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados invalidos' });

    const data: any = { ...body.data };
    if (data.cortesia_bloqueio) {
      data.cortesia_bloqueio = new Date(data.cortesia_bloqueio);
    } else if (data.cortesia_bloqueio === null) {
      data.cortesia_bloqueio = null;
    }

    const cliente = await fastify.prisma.clientes.update({ where: { id }, data });
    return reply.send(cliente);
  });

  // DELETE /api/clientes/:id
  fastify.delete('/api/clientes/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.prisma.clientes.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ─── Emails ────────────────────────────────────
  // GET /api/clientes/:id/emails
  fastify.get('/api/clientes/:id/emails', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const emails = await fastify.prisma.clientes_emails.findMany({
      where: { cliente_id: id },
    });
    return reply.send(emails);
  });

  // PUT /api/clientes/:id/emails — substitui todos os emails
  fastify.put('/api/clientes/:id/emails', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { emails } = request.body as { emails: { email: string; tipo: string }[] };

    await fastify.prisma.$transaction(async (tx) => {
      await tx.clientes_emails.deleteMany({ where: { cliente_id: id } });
      if (emails && emails.length > 0) {
        await tx.clientes_emails.createMany({
          data: emails.map(e => ({ cliente_id: id, email: e.email, tipo: e.tipo || 'Email' })),
        });
      }
    });

    const result = await fastify.prisma.clientes_emails.findMany({ where: { cliente_id: id } });
    return reply.send(result);
  });

  // ─── Perfis ────────────────────────────────────
  // GET /api/clientes/:id/perfis
  fastify.get('/api/clientes/:id/perfis', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perfis = await fastify.prisma.clientes_perfis.findMany({
      where: { cliente_id: id },
      include: { ufs: true, atividades: true },
    });
    return reply.send(perfis);
  });

  // PUT /api/clientes/:id/perfis — substitui todos os perfis com sub-dados
  fastify.put('/api/clientes/:id/perfis', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { perfis } = request.body as {
      perfis: {
        id?: string;
        nome: string;
        ufs: string[];
        atividades: string[];
      }[];
    };

    await fastify.prisma.$transaction(async (tx) => {
      // Remover perfis antigos (cascade remove ufs e atividades)
      await tx.clientes_perfis.deleteMany({ where: { cliente_id: id } });

      // Criar novos perfis
      for (const p of (perfis || [])) {
        const perfil = await tx.clientes_perfis.create({
          data: {
            cliente_id: id,
            nome: p.nome,
          },
        });

        if (p.ufs && p.ufs.length > 0) {
          await tx.clientes_perfis_ufs.createMany({
            data: p.ufs.map(uf => ({ perfil_id: perfil.id, uf })),
          });
        }

        if (p.atividades && p.atividades.length > 0) {
          await tx.clientes_perfis_atividades.createMany({
            data: p.atividades.map(ramo_id => ({ perfil_id: perfil.id, ramo_id })),
          });
        }
      }
    });

    const result = await fastify.prisma.clientes_perfis.findMany({
      where: { cliente_id: id },
      include: { ufs: true, atividades: true },
    });
    return reply.send(result);
  });

  // ─── Grupos de Orgaos ──────────────────────────
  // GET /api/clientes/:id/grupos-orgaos
  fastify.get('/api/clientes/:id/grupos-orgaos', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const grupos = await fastify.prisma.clientes_grupos_orgaos.findMany({
      where: { cliente_id: id },
    });
    return reply.send(grupos.map(g => g.grupo_id));
  });

  // PUT /api/clientes/:id/grupos-orgaos — substitui
  fastify.put('/api/clientes/:id/grupos-orgaos', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { grupo_ids } = request.body as { grupo_ids: string[] };

    await fastify.prisma.$transaction(async (tx) => {
      await tx.clientes_grupos_orgaos.deleteMany({ where: { cliente_id: id } });
      if (grupo_ids && grupo_ids.length > 0) {
        await tx.clientes_grupos_orgaos.createMany({
          data: grupo_ids.map(grupo_id => ({ cliente_id: id, grupo_id })),
        });
      }
    });

    return reply.send({ ok: true });
  });

  // POST /api/clientes/:id/save-all — salva tudo de uma vez (dados + emails + perfis + grupos)
  fastify.post('/api/clientes/:id/save-all', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { dados, emails, perfis, grupo_ids } = request.body as {
      dados: Record<string, unknown>;
      emails: { email: string; tipo: string }[];
      perfis: { nome: string; ufs: string[]; atividades: string[] }[];
      grupo_ids: string[];
    };

    await fastify.prisma.$transaction(async (tx) => {
      // Atualizar dados do cliente
      if (dados) {
        const clienteData: any = { ...dados };
        if (clienteData.cortesia_bloqueio) {
          clienteData.cortesia_bloqueio = new Date(clienteData.cortesia_bloqueio as string);
        }
        // Remove campos que nao sao do model
        delete clienteData.id;
        delete clienteData.created_at;
        delete clienteData.updated_at;
        delete clienteData.emails;
        delete clienteData.perfis;
        delete clienteData.grupos_orgaos;
        await tx.clientes.update({ where: { id }, data: clienteData });
      }

      // Emails
      if (emails !== undefined) {
        await tx.clientes_emails.deleteMany({ where: { cliente_id: id } });
        if (emails.length > 0) {
          await tx.clientes_emails.createMany({
            data: emails.map(e => ({ cliente_id: id, email: e.email, tipo: e.tipo || 'Email' })),
          });
        }
      }

      // Perfis
      if (perfis !== undefined) {
        await tx.clientes_perfis.deleteMany({ where: { cliente_id: id } });
        for (const p of perfis) {
          const perfil = await tx.clientes_perfis.create({
            data: { cliente_id: id, nome: p.nome },
          });
          if (p.ufs && p.ufs.length > 0) {
            await tx.clientes_perfis_ufs.createMany({
              data: p.ufs.map(uf => ({ perfil_id: perfil.id, uf })),
            });
          }
          if (p.atividades && p.atividades.length > 0) {
            await tx.clientes_perfis_atividades.createMany({
              data: p.atividades.map(ramo_id => ({ perfil_id: perfil.id, ramo_id })),
            });
          }
        }
      }

      // Grupos orgaos
      if (grupo_ids !== undefined) {
        await tx.clientes_grupos_orgaos.deleteMany({ where: { cliente_id: id } });
        if (grupo_ids.length > 0) {
          await tx.clientes_grupos_orgaos.createMany({
            data: grupo_ids.map(grupo_id => ({ cliente_id: id, grupo_id })),
          });
        }
      }
    });

    // Retornar cliente completo
    const cliente = await fastify.prisma.clientes.findUnique({
      where: { id },
      include: {
        emails: true,
        perfis: { include: { ufs: true, atividades: true } },
        grupos_orgaos: true,
      },
    });

    return reply.send(cliente);
  });
}
