import Fastify from 'fastify';
import { config } from './config.js';

// Plugins
import corsPlugin from './plugins/cors.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';

// Routes
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import sitesRoutes from './routes/sites.routes.js';
import caixasEmailRoutes from './routes/caixas-email.routes.js';
import tipoLicitacoesRoutes from './routes/tipo-licitacoes.routes.js';
import grupoOrgaosRoutes from './routes/grupo-orgaos.routes.js';
import ramosAtividadeRoutes from './routes/ramos-atividade.routes.js';
import orgaosRoutes from './routes/orgaos.routes.js';
import contratacoesRoutes from './routes/contratacoes.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import permissoesRoutes from './routes/permissoes.routes.js';
import pncpSyncRoutes from './routes/pncp-sync.routes.js';

// Services
import { startPncpCron } from './services/pncp-sync.service.js';

async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // ── Plugins ──────────────────────────────────────────
  await fastify.register(corsPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);

  // ── Routes ───────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(sitesRoutes);
  await fastify.register(caixasEmailRoutes);
  await fastify.register(tipoLicitacoesRoutes);
  await fastify.register(grupoOrgaosRoutes);
  await fastify.register(ramosAtividadeRoutes);
  await fastify.register(orgaosRoutes);
  await fastify.register(contratacoesRoutes);
  await fastify.register(clientesRoutes);
  await fastify.register(permissoesRoutes);
  await fastify.register(pncpSyncRoutes);

  // ── Start ────────────────────────────────────────────
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`\n🚀 Server rodando em http://localhost:${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/api/health`);
    console.log(`   Login:        POST http://localhost:${config.port}/api/auth/login`);
    console.log(`   PNCP Sync:    POST http://localhost:${config.port}/api/pncp-sync/trigger`);

    // ── Iniciar cron do PNCP (30 em 30 min) ──
    startPncpCron(fastify.prisma);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
