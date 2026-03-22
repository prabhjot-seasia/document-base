import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { DocumentWithDetails, DocumentVersion, Tag, PaginatedResponse, PinnedDocument } from '../types';

export class DocumentService {
  constructor(private db: Knex) {}

  async search(params: {
    q?: string;
    tags?: string;
    directory_id?: string;
    archived?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<DocumentWithDetails>> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.page_size || 20));
    const offset = (page - 1) * pageSize;
    const showArchived = params.archived === 'true';

    let query = this.db('documents as d')
      .join('directories as dir', 'd.directory_id', 'dir.id')
      .whereNull('d.deleted_at')
      .whereNull('dir.deleted_at');

    let countQuery = this.db('documents as d')
      .join('directories as dir', 'd.directory_id', 'dir.id')
      .whereNull('d.deleted_at')
      .whereNull('dir.deleted_at');

    // For archived view, join archived versions directly; otherwise join current version
    if (showArchived) {
      query = query
        .join('document_versions as dv', function () {
          this.on('dv.document_id', '=', 'd.id');
        })
        .where('dv.is_archived', true)
        .whereNull('dv.deleted_at');
      countQuery = countQuery
        .join('document_versions as dv', function () {
          this.on('dv.document_id', '=', 'd.id');
        })
        .where('dv.is_archived', true)
        .whereNull('dv.deleted_at');
    } else {
      query = query.leftJoin('document_versions as dv', 'd.current_version_id', 'dv.id');
    }

    // Free-text search (searches both name and tags)
    if (params.q) {
      const searchTerm = `%${params.q}%`;
      const qLower = params.q.trim().toLowerCase();
      query = query.where(function () {
        this.where('d.name', 'ILIKE', searchTerm)
          .orWhereIn('d.id', function () {
            this.select('dt.document_id')
              .from('document_tags as dt')
              .join('tags as t', 'dt.tag_id', 't.id')
              .where('t.name', 'ILIKE', `%${qLower}%`);
          });
      });
      countQuery = countQuery.where(function () {
        this.where('d.name', 'ILIKE', searchTerm)
          .orWhereIn('d.id', function () {
            this.select('dt.document_id')
              .from('document_tags as dt')
              .join('tags as t', 'dt.tag_id', 't.id')
              .where('t.name', 'ILIKE', `%${qLower}%`);
          });
      });
    }

    // Directory filter
    if (params.directory_id) {
      query = query.where('d.directory_id', params.directory_id);
      countQuery = countQuery.where('d.directory_id', params.directory_id);
    }

    // Tag filter
    if (params.tags) {
      const tagNames = params.tags.split(',').map((t) => t.trim().toLowerCase());
      if (tagNames.length > 0) {
        query = query.whereIn('d.id', function () {
          this.select('dt.document_id')
            .from('document_tags as dt')
            .join('tags as t', 'dt.tag_id', 't.id')
            .whereIn('t.name', tagNames)
            .groupBy('dt.document_id')
            .havingRaw('COUNT(DISTINCT t.name) = ?', [tagNames.length]);
        });
        countQuery = countQuery.whereIn('d.id', function () {
          this.select('dt.document_id')
            .from('document_tags as dt')
            .join('tags as t', 'dt.tag_id', 't.id')
            .whereIn('t.name', tagNames)
            .groupBy('dt.document_id')
            .havingRaw('COUNT(DISTINCT t.name) = ?', [tagNames.length]);
        });
      }
    }

    // Archive filtering is handled by the join above

    // Count total (for archived view, count versions not documents)
    const totalResult = await countQuery.count(showArchived ? 'dv.id as count' : 'd.id as count').first();
    const total = Number(totalResult?.count || 0);

    // Fetch documents
    const rows = await query
      .leftJoin('pinned_documents as pd', 'd.id', 'pd.document_id')
      .select(
        'd.id',
        'd.name',
        'd.created_by',
        'd.created_at',
        'dir.id as dir_id',
        'dir.name as dir_name',
        'dir.path as dir_path',
        'dv.id as version_id',
        'dv.version_number',
        'dv.file_name',
        'dv.file_size',
        'dv.start_date',
        'dv.end_date',
        'dv.is_archived as version_archived',
        'dv.uploaded_by',
        'dv.created_at as version_created_at',
        'pd.id as pinned_id'
      )
      .orderBy('d.updated_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    // Fetch tags for all documents
    const docIds = rows.map((r: any) => r.id);
    const tagRows = docIds.length > 0
      ? await this.db('document_tags as dt')
          .join('tags as t', 'dt.tag_id', 't.id')
          .whereIn('dt.document_id', docIds)
          .select('dt.document_id', 't.id', 't.name')
      : [];

    const tagMap = new Map<string, Tag[]>();
    for (const tr of tagRows) {
      if (!tagMap.has(tr.document_id)) {
        tagMap.set(tr.document_id, []);
      }
      tagMap.get(tr.document_id)!.push({ id: tr.id, name: tr.name, created_at: '' });
    }

    const documents: DocumentWithDetails[] = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      directory: {
        id: r.dir_id,
        name: r.dir_name,
        path: r.dir_path,
      },
      current_version: r.version_id
        ? {
            id: r.version_id,
            document_id: r.id,
            version_number: r.version_number,
            file_name: r.file_name,
            file_size: Number(r.file_size),
            mime_type: 'application/pdf',
            start_date: r.start_date,
            end_date: r.end_date,
            is_archived: r.version_archived,
            uploaded_by: r.uploaded_by,
            created_at: r.version_created_at,
            updated_at: r.version_created_at,
            deleted_at: null,
          }
        : null,
      tags: tagMap.get(r.id) || [],
      created_by: r.created_by,
      created_at: r.created_at,
      is_pinned: !!r.pinned_id,
    }));

    return { documents, total, page, page_size: pageSize };
  }

  async getById(id: string): Promise<DocumentWithDetails | null> {
    const row = await this.db('documents as d')
      .join('directories as dir', 'd.directory_id', 'dir.id')
      .leftJoin('document_versions as dv', 'd.current_version_id', 'dv.id')
      .where('d.id', id)
      .whereNull('d.deleted_at')
      .select(
        'd.id', 'd.name', 'd.created_by', 'd.created_at',
        'dir.id as dir_id', 'dir.name as dir_name', 'dir.path as dir_path',
        'dv.id as version_id', 'dv.version_number', 'dv.file_name', 'dv.file_size',
        'dv.start_date', 'dv.end_date', 'dv.is_archived as version_archived',
        'dv.uploaded_by', 'dv.created_at as version_created_at'
      )
      .first();

    if (!row) return null;

    // Get tags
    const tags = await this.db('document_tags as dt')
      .join('tags as t', 'dt.tag_id', 't.id')
      .where('dt.document_id', id)
      .select('t.id', 't.name', 't.created_at');

    // Get version count
    const versionCount = await this.db('document_versions')
      .where({ document_id: id })
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    return {
      id: row.id,
      name: row.name,
      directory: { id: row.dir_id, name: row.dir_name, path: row.dir_path },
      current_version: row.version_id
        ? {
            id: row.version_id,
            document_id: row.id,
            version_number: row.version_number,
            file_name: row.file_name,
            file_size: Number(row.file_size),
            mime_type: 'application/pdf',
            start_date: row.start_date,
            end_date: row.end_date,
            is_archived: row.version_archived,
            uploaded_by: row.uploaded_by,
            created_at: row.version_created_at,
            updated_at: row.version_created_at,
            deleted_at: null,
          }
        : null,
      tags,
      total_versions: Number(versionCount?.count || 0),
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }

  async getVersions(documentId: string): Promise<Omit<DocumentVersion, 'file_data'>[]> {
    return this.db('document_versions')
      .where({ document_id: documentId })
      .whereNull('deleted_at')
      .select('id', 'document_id', 'version_number', 'file_name', 'file_size',
        'mime_type', 'start_date', 'end_date', 'is_archived', 'uploaded_by',
        'created_at', 'updated_at', 'deleted_at')
      .orderBy('version_number', 'desc');
  }

  async getVersionFileData(versionId: string): Promise<{ file_data: Buffer; file_name: string; mime_type: string } | null> {
    const row = await this.db('document_versions')
      .where({ id: versionId })
      .whereNull('deleted_at')
      .select('file_data', 'file_name', 'mime_type')
      .first();
    return row || null;
  }

  async getCurrentFileData(documentId: string): Promise<{ file_data: Buffer; file_name: string; mime_type: string } | null> {
    const doc = await this.db('documents').where({ id: documentId }).whereNull('deleted_at').first();
    if (!doc || !doc.current_version_id) return null;
    return this.getVersionFileData(doc.current_version_id);
  }

  async upload(params: {
    name: string;
    directoryId: string;
    tags: string[];
    startDate: string | null;
    endDate: string | null;
    fileData: Buffer;
    fileName: string;
    fileSize: number;
    uploadedBy: string;
  }): Promise<{ id: string; name: string; version: number }> {
    return this.db.transaction(async (trx) => {
      // Check if document exists in same directory
      const existing = await trx('documents')
        .where({ directory_id: params.directoryId, name: params.name })
        .whereNull('deleted_at')
        .first();

      if (existing) {
        // Create new version
        return this.createNewVersion(trx, existing.id, params);
      }

      // Create new document
      const docId = uuidv4();
      const versionId = uuidv4();
      const now = new Date().toISOString();

      // Insert document first (without version reference)
      await trx('documents').insert({
        id: docId,
        name: params.name,
        directory_id: params.directoryId,
        current_version_id: null,
        created_by: params.uploadedBy,
        created_at: now,
        updated_at: now,
      });

      // Insert version (document now exists for FK)
      await trx('document_versions').insert({
        id: versionId,
        document_id: docId,
        version_number: 1,
        file_data: params.fileData,
        file_name: params.fileName,
        file_size: params.fileSize,
        mime_type: 'application/pdf',
        start_date: params.startDate,
        end_date: params.endDate,
        is_archived: false,
        uploaded_by: params.uploadedBy,
        created_at: now,
        updated_at: now,
      });

      // Update document with version reference
      await trx('documents')
        .where({ id: docId })
        .update({ current_version_id: versionId });

      // Handle tags
      await this.setDocumentTags(trx, docId, params.tags);

      return { id: docId, name: params.name, version: 1 };
    });
  }

  async reupload(documentId: string, params: {
    tags?: string[];
    startDate: string | null;
    endDate: string | null;
    fileData: Buffer;
    fileName: string;
    fileSize: number;
    uploadedBy: string;
  }): Promise<{ id: string; name: string; version: number }> {
    return this.db.transaction(async (trx) => {
      const doc = await trx('documents')
        .where({ id: documentId })
        .whereNull('deleted_at')
        .first();

      if (!doc) throw new Error('Document not found');

      const result = await this.createNewVersion(trx, documentId, {
        ...params,
        name: doc.name,
        directoryId: doc.directory_id,
        tags: params.tags || [],
      });

      // Update tags if provided
      if (params.tags && params.tags.length > 0) {
        await this.setDocumentTags(trx, documentId, params.tags);
      }

      return result;
    });
  }

  async getPinnedDocuments(): Promise<DocumentWithDetails[]> {
    const rows = await this.db('pinned_documents as pd')
      .join('documents as d', 'pd.document_id', 'd.id')
      .join('directories as dir', 'd.directory_id', 'dir.id')
      .leftJoin('document_versions as dv', 'd.current_version_id', 'dv.id')
      .whereNull('d.deleted_at')
      .whereNull('dir.deleted_at')
      .select(
        'd.id', 'd.name', 'd.created_by', 'd.created_at',
        'dir.id as dir_id', 'dir.name as dir_name', 'dir.path as dir_path',
        'dv.id as version_id', 'dv.version_number', 'dv.file_name', 'dv.file_size',
        'dv.start_date', 'dv.end_date', 'dv.is_archived as version_archived',
        'dv.uploaded_by', 'dv.created_at as version_created_at',
        'pd.sort_order', 'pd.pinned_by', 'pd.pinned_at'
      )
      .orderBy('pd.sort_order', 'asc');

    const docIds = rows.map((r: any) => r.id);
    const tagRows = docIds.length > 0
      ? await this.db('document_tags as dt')
          .join('tags as t', 'dt.tag_id', 't.id')
          .whereIn('dt.document_id', docIds)
          .select('dt.document_id', 't.id', 't.name')
      : [];

    const tagMap = new Map<string, Tag[]>();
    for (const tr of tagRows) {
      if (!tagMap.has(tr.document_id)) tagMap.set(tr.document_id, []);
      tagMap.get(tr.document_id)!.push({ id: tr.id, name: tr.name, created_at: '' });
    }

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      directory: { id: r.dir_id, name: r.dir_name, path: r.dir_path },
      current_version: r.version_id
        ? {
            id: r.version_id, document_id: r.id, version_number: r.version_number,
            file_name: r.file_name, file_size: Number(r.file_size), mime_type: 'application/pdf',
            start_date: r.start_date, end_date: r.end_date, is_archived: r.version_archived,
            uploaded_by: r.uploaded_by, created_at: r.version_created_at,
            updated_at: r.version_created_at, deleted_at: null,
          }
        : null,
      tags: tagMap.get(r.id) || [],
      created_by: r.created_by,
      created_at: r.created_at,
      is_pinned: true,
    }));
  }

  async pinDocument(documentId: string, pinnedBy: string): Promise<void> {
    const doc = await this.db('documents').where({ id: documentId }).whereNull('deleted_at').first();
    if (!doc) throw new Error('Document not found');

    const existing = await this.db('pinned_documents').where({ document_id: documentId }).first();
    if (existing) return; // Already pinned

    // Get max sort_order
    const maxOrder = await this.db('pinned_documents').max('sort_order as max').first();
    const nextOrder = (maxOrder?.max || 0) + 1;

    await this.db('pinned_documents').insert({
      id: uuidv4(),
      document_id: documentId,
      sort_order: nextOrder,
      pinned_by: pinnedBy,
    });
  }

  async unpinDocument(documentId: string): Promise<void> {
    await this.db('pinned_documents').where({ document_id: documentId }).delete();
  }

  async reorderPinnedDocuments(orderedDocumentIds: string[]): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (let i = 0; i < orderedDocumentIds.length; i++) {
        await trx('pinned_documents')
          .where({ document_id: orderedDocumentIds[i] })
          .update({ sort_order: i + 1 });
      }
    });
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = await this.db('documents').where({ id }).whereNull('deleted_at').first();
    if (!doc) throw new Error('Document not found');

    const now = new Date().toISOString();
    await this.db.transaction(async (trx) => {
      await trx('pinned_documents').where({ document_id: id }).delete();
      await trx('document_versions')
        .where({ document_id: id })
        .update({ deleted_at: now });
      await trx('documents')
        .where({ id })
        .update({ deleted_at: now, current_version_id: null });
    });
  }

  private async createNewVersion(
    trx: Knex.Transaction,
    documentId: string,
    params: {
      name: string;
      directoryId: string;
      tags: string[];
      startDate: string | null;
      endDate: string | null;
      fileData: Buffer;
      fileName: string;
      fileSize: number;
      uploadedBy: string;
    }
  ): Promise<{ id: string; name: string; version: number }> {
    const now = new Date().toISOString();

    // Archive current version
    const currentDoc = await trx('documents').where({ id: documentId }).first();
    if (currentDoc?.current_version_id) {
      await trx('document_versions')
        .where({ id: currentDoc.current_version_id })
        .update({
          is_archived: true,
          end_date: now.split('T')[0], // Date only
          updated_at: now,
        });
    }

    // Get next version number
    const maxVersion = await trx('document_versions')
      .where({ document_id: documentId })
      .max('version_number as max')
      .first();
    const nextVersion = (maxVersion?.max || 0) + 1;

    // Create new version
    const versionId = uuidv4();
    await trx('document_versions').insert({
      id: versionId,
      document_id: documentId,
      version_number: nextVersion,
      file_data: params.fileData,
      file_name: params.fileName,
      file_size: params.fileSize,
      mime_type: 'application/pdf',
      start_date: params.startDate,
      end_date: params.endDate,
      is_archived: false,
      uploaded_by: params.uploadedBy,
      created_at: now,
      updated_at: now,
    });

    // Update document pointer
    await trx('documents')
      .where({ id: documentId })
      .update({ current_version_id: versionId, updated_at: now });

    return { id: documentId, name: params.name, version: nextVersion };
  }

  private async setDocumentTags(trx: Knex.Transaction, documentId: string, tagNames: string[]): Promise<void> {
    // Remove existing tags
    await trx('document_tags').where({ document_id: documentId }).delete();

    if (tagNames.length === 0) return;

    // Upsert tags
    for (const name of tagNames) {
      const normalizedName = name.trim().toLowerCase();
      if (!normalizedName) continue;

      let tag = await trx('tags').where({ name: normalizedName }).first();
      if (!tag) {
        const tagId = uuidv4();
        await trx('tags').insert({ id: tagId, name: normalizedName });
        tag = { id: tagId, name: normalizedName };
      }

      await trx('document_tags').insert({
        document_id: documentId,
        tag_id: tag.id,
      });
    }
  }
}
