import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { config } from '../config.js';

export interface JwtPayload {
  sub: string;       // user id (UUID)
  email: string;
  role: string;      // 'admin' | 'user'
  full_name?: string;
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(fjwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: '7d' },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Token inválido ou expirado' });
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
