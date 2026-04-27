import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth, getUserId } from '../middleware/requireAuth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'E-mail e senha são obrigatórios' });

    const { email, password } = body.data;

    const user = await fastify.prisma.users.findUnique({ where: { email } });
    if (!user) return reply.status(401).send({ error: 'E-mail ou senha incorretos' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.status(401).send({ error: 'E-mail ou senha incorretos' });

    const token = fastify.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name || undefined,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  });

  // POST /api/auth/register (somente admin pode criar usuários)
  fastify.post('/api/auth/register', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores podem criar usuários' });
    }

    const body = registerSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos', details: body.error.flatten() });

    const { email, password, full_name } = body.data;

    const existing = await fastify.prisma.users.findUnique({ where: { email } });
    if (existing) return reply.status(409).send({ error: 'E-mail já cadastrado' });

    const password_hash = await bcrypt.hash(password, 10);

    const user = await fastify.prisma.users.create({
      data: { email, password_hash, full_name, role: 'user' },
    });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  });

  // GET /api/auth/me — dados do usuário autenticado + permissões
  fastify.get('/api/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = getUserId(request);

    const user = await fastify.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        cpf: true,
        role: true,
        created_at: true,
      },
    });

    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' });

    const permissoes = await fastify.prisma.user_permissoes.findMany({
      where: { user_id: userId },
      include: { menu: true },
    });

    return reply.send({
      ...user,
      isAdmin: user.role === 'admin',
      permissoes: permissoes.map(p => ({
        menu_id: p.menu_id,
        menu_path: p.menu.path,
        menu_nome: p.menu.nome,
        abrir: p.abrir,
        salvar: p.salvar,
        excluir: p.excluir,
      })),
    });
  });

  // DELETE /api/auth/users/:id (somente admin)
  fastify.delete('/api/auth/users/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores podem excluir usuários' });
    }

    const { id } = request.params as { id: string };

    if (id === caller.sub) {
      return reply.status(400).send({ error: 'Não é possível excluir a si mesmo' });
    }

    await fastify.prisma.users.delete({ where: { id } }).catch(() => null);

    return reply.status(204).send();
  });

  // PATCH /api/auth/users/:id/role (somente admin)
  fastify.patch('/api/auth/users/:id/role', { preHandler: [requireAuth] }, async (request, reply) => {
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

  // GET /api/auth/users — lista todos os usuários (somente admin)
  fastify.get('/api/auth/users', { preHandler: [requireAuth] }, async (request, reply) => {
    const caller = request.user;
    if (caller.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores' });
    }

    const users = await fastify.prisma.users.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      },
      orderBy: { full_name: 'asc' },
    });

    return reply.send(users);
  });
}
