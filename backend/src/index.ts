import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { config } from './config';
import { getDb, runMigrations } from './db';
import { corsPlugin } from './plugins/cors';
import { ssoAuthPlugin } from './plugins/ssoAuth';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
import { directoryRoutes } from './routes/directories';
import { documentRoutes } from './routes/documents';
import { tagRoutes } from './routes/tags';

async function main() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: config.upload.maxSize,
  });

  // Run database migrations
  if (!config.skipMigrations) {
    try {
      await runMigrations();
      fastify.log.info('Database migrations completed');
    } catch (err) {
      fastify.log.error(err as Error, 'Failed to run migrations');
      process.exit(1);
    }
  }

  // Register plugins
  await fastify.register(corsPlugin);
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: config.upload.maxSize,
    },
  });
  await fastify.register(ssoAuthPlugin);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(meRoutes);
  await fastify.register(directoryRoutes);
  await fastify.register(documentRoutes);
  await fastify.register(tagRoutes);

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    await fastify.close();
    await getDb().destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    fastify.log.info(`Server running on http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
