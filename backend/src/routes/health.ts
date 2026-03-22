import { FastifyInstance } from 'fastify';
import { getDb } from '../db';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    try {
      await getDb().raw('SELECT 1');
      return reply.send({ status: 'ok', database: 'connected' });
    } catch {
      return reply.code(503).send({ status: 'error', database: 'disconnected' });
    }
  });
}
