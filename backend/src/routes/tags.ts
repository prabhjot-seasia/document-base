import { FastifyInstance } from 'fastify';
import { getDb } from '../db';

export async function tagRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getDb();

  // List all tags
  fastify.get('/api/tags', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    const tags = await db('tags').select('id', 'name', 'created_at').orderBy('name');
    return reply.send(tags);
  });

  // Search/autocomplete tags
  fastify.get<{ Querystring: { q?: string } }>('/api/tags/search', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { q } = request.query;
    if (!q || !q.trim()) {
      const tags = await db('tags').select('id', 'name', 'created_at').orderBy('name').limit(20);
      return reply.send(tags);
    }

    const tags = await db('tags')
      .where('name', 'ILIKE', `%${q.trim()}%`)
      .select('id', 'name', 'created_at')
      .orderBy('name')
      .limit(20);

    return reply.send(tags);
  });
}
