import { FastifyInstance, FastifyRequest } from 'fastify';
import { DocumentService } from '../services/documentService';
import { getDb } from '../db';
import { config } from '../config';

export async function documentRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new DocumentService(getDb());

  // Search documents
  fastify.get<{
    Querystring: {
      q?: string;
      tags?: string;
      directory_id?: string;
      archived?: string;
      page?: string;
      page_size?: string;
    };
  }>('/api/documents', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const result = await service.search({
      q: request.query.q,
      tags: request.query.tags,
      directory_id: request.query.directory_id,
      archived: request.query.archived,
      page: request.query.page ? parseInt(request.query.page, 10) : undefined,
      page_size: request.query.page_size ? parseInt(request.query.page_size, 10) : undefined,
    });
    return reply.send(result);
  });

  // Get pinned documents (must be before :id route)
  fastify.get('/api/documents/pinned', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const docs = await service.getPinnedDocuments();
    return reply.send(docs);
  });

  // Reorder pinned documents (must be before :id route)
  fastify.put<{ Body: { document_ids: string[] } }>('/api/documents/pinned/reorder', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    const body = request.body as { document_ids: string[] };
    if (!body?.document_ids || !Array.isArray(body.document_ids)) {
      return reply.code(400).send({ error: 'document_ids array is required' });
    }
    await service.reorderPinnedDocuments(body.document_ids);
    return reply.send({ success: true });
  });

  // Get document by ID
  fastify.get<{ Params: { id: string } }>('/api/documents/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const doc = await service.getById(request.params.id);
    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' });
    }
    return reply.send(doc);
  });

  // Get document versions
  fastify.get<{ Params: { id: string } }>('/api/documents/:id/versions', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const versions = await service.getVersions(request.params.id);
    return reply.send(versions);
  });

  // Download current version
  fastify.get<{ Params: { id: string } }>('/api/documents/:id/download', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const file = await service.getCurrentFileData(request.params.id);
    if (!file) {
      return reply.code(404).send({ error: 'Document or file not found' });
    }

    return reply
      .header('Content-Type', file.mime_type)
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`)
      .header('Content-Length', file.file_data.length)
      .send(file.file_data);
  });

  // Download specific version
  fastify.get<{ Params: { id: string; vid: string } }>('/api/documents/:id/versions/:vid/download', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const file = await service.getVersionFileData(request.params.vid);
    if (!file) {
      return reply.code(404).send({ error: 'Version not found' });
    }

    return reply
      .header('Content-Type', file.mime_type)
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`)
      .header('Content-Length', file.file_data.length)
      .send(file.file_data);
  });

  // View current version (inline PDF for viewer)
  fastify.get<{ Params: { id: string } }>('/api/documents/:id/view', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const file = await service.getCurrentFileData(request.params.id);
    if (!file) {
      return reply.code(404).send({ error: 'Document or file not found' });
    }

    return reply
      .header('Content-Type', file.mime_type)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name)}"`)
      .header('Content-Length', file.file_data.length)
      .send(file.file_data);
  });

  // View specific version (inline PDF for viewer)
  fastify.get<{ Params: { id: string; vid: string } }>('/api/documents/:id/versions/:vid/view', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const file = await service.getVersionFileData(request.params.vid);
    if (!file) {
      return reply.code(404).send({ error: 'Version not found' });
    }

    return reply
      .header('Content-Type', file.mime_type)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name)}"`)
      .header('Content-Length', file.file_data.length)
      .send(file.file_data);
  });

  // Upload new document (multipart)
  fastify.post('/api/documents', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const fields = data.fields as Record<string, any>;
    const name = fields.name?.value;
    const directoryId = fields.directory_id?.value;
    const tagsStr = fields.tags?.value || '';
    const startDate = fields.start_date?.value || null;
    const endDate = fields.end_date?.value || null;

    if (!name || !directoryId) {
      return reply.code(400).send({ error: 'name and directory_id are required' });
    }

    // Read file buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileData = Buffer.concat(chunks);

    if (fileData.length > config.upload.maxSize) {
      return reply.code(413).send({ error: `File exceeds maximum size of ${config.upload.maxSize} bytes` });
    }

    const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

    try {
      const result = await service.upload({
        name: name.trim(),
        directoryId,
        tags,
        startDate: startDate || null,
        endDate: endDate || null,
        fileData,
        fileName: data.filename,
        fileSize: fileData.length,
        uploadedBy: request.user!.username,
      });

      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Re-upload (new version)
  fastify.put<{ Params: { id: string } }>('/api/documents/:id', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const fields = data.fields as Record<string, any>;
    const tagsStr = fields.tags?.value || '';
    const startDate = fields.start_date?.value || null;
    const endDate = fields.end_date?.value || null;

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileData = Buffer.concat(chunks);

    if (fileData.length > config.upload.maxSize) {
      return reply.code(413).send({ error: `File exceeds maximum size of ${config.upload.maxSize} bytes` });
    }

    const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

    try {
      const result = await service.reupload(request.params.id, {
        tags: tags.length > 0 ? tags : undefined,
        startDate: startDate || null,
        endDate: endDate || null,
        fileData,
        fileName: data.filename,
        fileSize: fileData.length,
        uploadedBy: request.user!.username,
      });

      return reply.send(result);
    } catch (err: any) {
      if (err.message === 'Document not found') {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  // Delete document
  fastify.delete<{ Params: { id: string } }>('/api/documents/:id', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    try {
      await service.deleteDocument(request.params.id);
      return reply.code(204).send();
    } catch (err: any) {
      if (err.message === 'Document not found') {
        return reply.code(404).send({ error: err.message });
      }
      throw err;
    }
  });

  // Pin a document
  fastify.post<{ Params: { id: string } }>('/api/documents/:id/pin', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    try {
      await service.pinDocument(request.params.id, request.user!.username);
      return reply.send({ success: true });
    } catch (err: any) {
      if (err.message === 'Document not found') {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  // Unpin a document
  fastify.delete<{ Params: { id: string } }>('/api/documents/:id/pin', {
    preHandler: [fastify.authenticate, fastify.requireWrite],
  }, async (request, reply) => {
    await service.unpinDocument(request.params.id);
    return reply.send({ success: true });
  });
}
