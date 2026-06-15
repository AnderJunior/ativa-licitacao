import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { syncPncp, getSyncStatus, backfillNumAtiva } from '../services/pncp-sync.service.js';

export default async function pncpSyncRoutes(fastify: FastifyInstance) {
  // GET /api/pncp-sync/status — verificar status do sync
  fastify.get('/api/pncp-sync/status', { preHandler: [requireAuth] }, async (_request, reply) => {
    const status = getSyncStatus();
    return reply.send(status);
  });

  // POST /api/pncp-sync/trigger — disparar sync manualmente
  fastify.post('/api/pncp-sync/trigger', { preHandler: [requireAuth] }, async (_request, reply) => {
    const status = getSyncStatus();

    if (status.isSyncing) {
      return reply.status(409).send({ error: 'Sync ja esta em andamento' });
    }

    // Disparar em background (nao aguardar)
    syncPncp(fastify.prisma).catch(err => {
      console.error('[PNCP Sync] Erro no trigger manual:', err.message);
    });

    return reply.send({ message: 'Sync iniciado em background', startedAt: new Date().toISOString() });
  });

  // POST /api/pncp-sync/backfill-num-ativa — preencher num_ativa em registros existentes
  fastify.post('/api/pncp-sync/backfill-num-ativa', { preHandler: [requireAuth] }, async (_request, reply) => {
    try {
      const count = await backfillNumAtiva(fastify.prisma);
      return reply.send({ message: `Backfill concluido: ${count} registros atualizados`, count });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/pncp-sync/run — disparar sync e aguardar resultado
  fastify.post('/api/pncp-sync/run', { preHandler: [requireAuth] }, async (_request, reply) => {
    const status = getSyncStatus();

    if (status.isSyncing) {
      return reply.status(409).send({ error: 'Sync ja esta em andamento' });
    }

    try {
      const result = await syncPncp(fastify.prisma);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
