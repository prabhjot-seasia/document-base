import { FastifyInstance } from 'fastify';

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    return reply.send({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      groups: user.groups,
      permissions: user.permissions,
    });
  });
}
