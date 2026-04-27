import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';

export default async function permissoesRoutes(fastify: FastifyInstance) {
  // GET /api/menus
  fastify.get('/api/menus', { preHandler: [requireAuth] }, async (request, reply) => {
    const menus = await fastify.prisma.menus.findMany({
      orderBy: { ordem: 'asc' },
      select: { id: true, nome: true, path: true, ordem: true, parent_id: true },
    });
    return reply.send(menus);
  });

  // GET /api/users — todos os usuarios com roles (para admin)
  fastify.get('/api/users', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores' });
    }

    const users = await fastify.prisma.users.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        cpf: true,
        role: true,
        created_at: true,
      },
      orderBy: { full_name: 'asc' },
    });

    // Mapear para formato compativel (profiles-like)
    const result = users.map(u => ({
      id: u.id,
      user_id: u.id,
      full_name: u.full_name,
      email: u.email,
      cpf: u.cpf,
      role: u.role,
      created_at: u.created_at,
    }));

    return reply.send(result);
  });

  // GET /api/users/:id/permissoes
  fastify.get('/api/users/:id/permissoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const permissoes = await fastify.prisma.user_permissoes.findMany({
      where: { user_id: id },
      select: { user_id: true, menu_id: true, abrir: true, salvar: true, excluir: true },
    });
    return reply.send(permissoes);
  });

  // GET /api/permissoes — todas as permissoes de todos os usuarios
  fastify.get('/api/permissoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores' });
    }

    const permissoes = await fastify.prisma.user_permissoes.findMany({
      select: { user_id: true, menu_id: true, abrir: true, salvar: true, excluir: true },
    });
    return reply.send(permissoes);
  });

  // PATCH /api/permissoes — atualiza uma permissao individual
  fastify.patch('/api/permissoes', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores' });
    }

    const { user_id, menu_id, field, value } = request.body as {
      user_id: string; menu_id: string; field: 'abrir' | 'salvar' | 'excluir'; value: boolean;
    };

    // Upsert: criar se nao existir, atualizar se existir
    const existing = await fastify.prisma.user_permissoes.findFirst({
      where: { user_id, menu_id },
    });

    if (existing) {
      await fastify.prisma.user_permissoes.update({
        where: { id: existing.id },
        data: { [field]: value },
      });
    } else {
      await fastify.prisma.user_permissoes.create({
        data: {
          user_id,
          menu_id,
          abrir: field === 'abrir' ? value : false,
          salvar: field === 'salvar' ? value : false,
          excluir: field === 'excluir' ? value : false,
        },
      });
    }

    return reply.send({ ok: true });
  });

  // GET /api/profiles — para compatibilidade com RelatorioProdutividade
  fastify.get('/api/profiles', { preHandler: [requireAuth] }, async (request, reply) => {
    const { user_ids } = request.query as { user_ids?: string };

    const where: any = {};
    if (user_ids) {
      where.id = { in: user_ids.split(',') };
    }

    const users = await fastify.prisma.users.findMany({
      where,
      select: { id: true, full_name: true, email: true },
    });

    // Retornar no formato compativel (user_id = id)
    return reply.send(users.map(u => ({
      user_id: u.id,
      full_name: u.full_name,
      email: u.email,
    })));
  });

  // PATCH /api/users/:id/role — mudar role
  fastify.patch('/api/users/:id/role', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores' });
    }

    const { id } = request.params as { id: string };
    const { role } = request.body as { role: 'admin' | 'user' };

    const user = await fastify.prisma.users.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, full_name: true, role: true },
    });

    return reply.send(user);
  });
}
