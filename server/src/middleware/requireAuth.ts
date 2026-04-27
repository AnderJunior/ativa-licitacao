import { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Não autenticado' });
  }
}

export function getUserId(request: FastifyRequest): string {
  return request.user.sub;
}
