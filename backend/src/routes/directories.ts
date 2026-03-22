import { FastifyInstance, FastifyRequest } from 'fastify';
import { DirectoryService } from '../services/directoryService';
import { getDb } from '../db';

export async function directoryRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new DirectoryService(getDb());

  // List directory tree
  fastify.get('/api/directories', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    const tree = await service.getAll();
    return reply.send(tree);
  });

  // Get directory by ID
  fastify.get<{ Params: { id: string } }>('/api/directories/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const dir = await service.getById(request.params.id);
    if (!dir) {
      return reply.code(404).send({ error: 'Directory not found' });
    }
    return reply.send(dir);
  });

  // Create directory
  fastify.post<{ Body: { name: string; parent_id?: string } }>('/api/directories', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    const { name, parent_id } = request.body;
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Name is required' });
    }

    try {
      const dir = await service.create(name.trim(), parent_id || null, request.user!.username);
      return reply.code(201).send(dir);
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('not found')) {
        return reply.code(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // Rename directory
  fastify.put<{ Params: { id: string }; Body: { name: string } }>('/api/directories/:id', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    const { name } = request.body;
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Name is required' });
    }

    try {
      const dir = await service.update(request.params.id, name.trim());
      return reply.send(dir);
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return reply.code(404).send({ error: err.message });
      }
      if (err.message.includes('already exists')) {
        return reply.code(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // Delete directory
  fastify.delete<{ Params: { id: string } }>('/api/directories/:id', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    try {
      await service.delete(request.params.id);
      return reply.code(204).send();
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return reply.code(404).send({ error: err.message });
      }
      if (err.message.includes('contains')) {
        return reply.code(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
