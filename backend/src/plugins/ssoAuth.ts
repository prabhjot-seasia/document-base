import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { validateToken, hasPermission } from '../services/ssoClient';

export const ssoAuthPlugin = fp(async function (fastify: FastifyInstance): Promise<void> {
  fastify.decorate('authenticate', async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const userInfo = await validateToken(token);

    if (!userInfo.valid) {
      reply.code(401).send({ error: userInfo.error || 'Invalid token' });
      return;
    }

    request.user = userInfo;
  });

  fastify.decorate('requireWrite', async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (!request.user) {
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }

    if (!hasPermission(request.user, 'documents', 'write')) {
      reply.code(403).send({ error: 'Write permission required' });
      return;
    }
  });
});

// Augment Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWrite: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
