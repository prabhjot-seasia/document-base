import knex, { Knex } from 'knex';
import { config } from './config';

let db: Knex;

export function getDb(): Knex {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        ssl: config.db.ssl,
      },
      pool: {
        min: 10,
        max: 25,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
      },
    });
  }
  return db;
}

export async function runMigrations(): Promise<void> {
  const db = getDb();

  // Create uuid-ossp extension
  await db.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Check if directories table exists
  const hasDirectories = await db.schema.hasTable('directories');
  if (!hasDirectories) {
    await db.schema.createTable('directories', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.string('name', 255).notNullable();
      table.uuid('parent_id').nullable().references('id').inTable('directories').onDelete('CASCADE');
      table.text('path').notNullable();
      table.string('created_by', 255).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(db.fn.now());
      table.timestamp('deleted_at', { useTz: true }).nullable();
      table.unique(['parent_id', 'name']);
    });

    await db.schema.raw('CREATE INDEX idx_directories_parent_id ON directories(parent_id)');
    await db.schema.raw('CREATE INDEX idx_directories_path ON directories(path)');
    await db.schema.raw('CREATE INDEX idx_directories_deleted_at ON directories(deleted_at)');
  }

  // Check if documents table exists
  const hasDocuments = await db.schema.hasTable('documents');
  if (!hasDocuments) {
    await db.schema.createTable('documents', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.string('name', 500).notNullable();
      table.uuid('directory_id').notNullable().references('id').inTable('directories');
      table.uuid('current_version_id').nullable();
      table.string('created_by', 255).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(db.fn.now());
      table.timestamp('deleted_at', { useTz: true }).nullable();
      table.unique(['directory_id', 'name']);
    });

    await db.schema.raw('CREATE INDEX idx_documents_directory_id ON documents(directory_id)');
    await db.schema.raw('CREATE INDEX idx_documents_name ON documents(name)');
    await db.schema.raw('CREATE INDEX idx_documents_deleted_at ON documents(deleted_at)');
  }

  // Check if document_versions table exists
  const hasVersions = await db.schema.hasTable('document_versions');
  if (!hasVersions) {
    await db.schema.createTable('document_versions', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
      table.integer('version_number').notNullable().defaultTo(1);
      table.binary('file_data').notNullable();
      table.string('file_name', 500).notNullable();
      table.bigInteger('file_size').notNullable();
      table.string('mime_type', 100).notNullable().defaultTo('application/pdf');
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.boolean('is_archived').defaultTo(false);
      table.string('uploaded_by', 255).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(db.fn.now());
      table.timestamp('deleted_at', { useTz: true }).nullable();
      table.unique(['document_id', 'version_number']);
    });

    await db.schema.raw('CREATE INDEX idx_document_versions_document_id ON document_versions(document_id)');
    await db.schema.raw('CREATE INDEX idx_document_versions_archived ON document_versions(is_archived)');

    // Add FK for current_version_id now that document_versions exists
    await db.schema.raw(`
      ALTER TABLE documents
      ADD CONSTRAINT fk_current_version
      FOREIGN KEY (current_version_id) REFERENCES document_versions(id)
    `);
  }

  // Check if tags table exists
  const hasTags = await db.schema.hasTable('tags');
  if (!hasTags) {
    await db.schema.createTable('tags', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.string('name', 100).notNullable().unique();
      table.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now());
    });
  }

  // Check if document_tags table exists
  const hasDocTags = await db.schema.hasTable('document_tags');
  if (!hasDocTags) {
    await db.schema.createTable('document_tags', (table) => {
      table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
      table.uuid('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE');
      table.primary(['document_id', 'tag_id']);
    });

    await db.schema.raw('CREATE INDEX idx_document_tags_tag_id ON document_tags(tag_id)');
  }

  // Check if pinned_documents table exists
  const hasPinnedDocs = await db.schema.hasTable('pinned_documents');
  if (!hasPinnedDocs) {
    await db.schema.createTable('pinned_documents', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
      table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.string('pinned_by', 255).notNullable();
      table.timestamp('pinned_at', { useTz: true }).defaultTo(db.fn.now());
      table.unique(['document_id']);
    });

    await db.schema.raw('CREATE INDEX idx_pinned_documents_sort_order ON pinned_documents(sort_order)');
  }

  // Fix unique constraints to be partial (exclude soft-deleted records)
  // This allows re-creating records with the same name after soft delete
  try {
    await db.raw(`
      ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_directory_id_name_unique
    `);
    await db.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS documents_directory_id_name_unique
      ON documents (directory_id, name)
      WHERE deleted_at IS NULL
    `);
  } catch (e) {
    // Index may already exist as partial
  }

  try {
    await db.raw(`
      ALTER TABLE directories DROP CONSTRAINT IF EXISTS directories_parent_id_name_unique
    `);
    await db.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS directories_parent_id_name_unique
      ON directories (parent_id, name)
      WHERE deleted_at IS NULL
    `);
  } catch (e) {
    // Index may already exist as partial
  }

  console.log('Database migrations completed successfully');
}
