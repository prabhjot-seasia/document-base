import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { Directory, DirectoryTree } from '../types';

export class DirectoryService {
  constructor(private db: Knex) {}

  async getAll(): Promise<DirectoryTree[]> {
    const dirs = await this.db<Directory>('directories')
      .whereNull('deleted_at')
      .orderBy('path');

    return this.buildTree(dirs);
  }

  async getById(id: string): Promise<Directory | null> {
    const dir = await this.db<Directory>('directories')
      .where({ id })
      .whereNull('deleted_at')
      .first();
    return dir || null;
  }

  async create(name: string, parentId: string | null, createdBy: string): Promise<Directory> {
    let path: string;

    if (parentId) {
      const parent = await this.getById(parentId);
      if (!parent) {
        throw new Error('Parent directory not found');
      }
      path = `${parent.path}/${name}`;
    } else {
      path = `/${name}`;
    }

    // Check for duplicate name in same parent
    const existing = await this.db<Directory>('directories')
      .where({ parent_id: parentId, name })
      .whereNull('deleted_at')
      .first();

    if (existing) {
      throw new Error('Directory with this name already exists in the same parent');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await this.db('directories').insert({
      id,
      name,
      parent_id: parentId,
      path,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    });

    return (await this.getById(id))!;
  }

  async update(id: string, name: string): Promise<Directory> {
    const dir = await this.getById(id);
    if (!dir) {
      throw new Error('Directory not found');
    }

    // Check for duplicate name in same parent
    const existing = await this.db<Directory>('directories')
      .where({ parent_id: dir.parent_id, name })
      .whereNot({ id })
      .whereNull('deleted_at')
      .first();

    if (existing) {
      throw new Error('Directory with this name already exists in the same parent');
    }

    const oldPath = dir.path;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = parentPath ? `${parentPath}/${name}` : `/${name}`;

    await this.db.transaction(async (trx) => {
      // Update this directory
      await trx('directories')
        .where({ id })
        .update({ name, path: newPath, updated_at: new Date().toISOString() });

      // Update all children paths
      await trx.raw(
        `UPDATE directories SET path = ? || substring(path from ?) WHERE path LIKE ? AND deleted_at IS NULL AND id != ?`,
        [newPath, oldPath.length + 1, `${oldPath}/%`, id]
      );
    });

    return (await this.getById(id))!;
  }

  async delete(id: string): Promise<void> {
    const dir = await this.getById(id);
    if (!dir) {
      throw new Error('Directory not found');
    }

    // Check for documents in this directory
    const docCount = await this.db('documents')
      .where({ directory_id: id })
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    if (docCount && Number(docCount.count) > 0) {
      throw new Error('Directory contains documents. Delete documents first.');
    }

    // Check for child directories
    const childCount = await this.db('directories')
      .where({ parent_id: id })
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    if (childCount && Number(childCount.count) > 0) {
      throw new Error('Directory contains subdirectories. Delete them first.');
    }

    await this.db('directories')
      .where({ id })
      .update({ deleted_at: new Date().toISOString() });
  }

  private buildTree(dirs: Directory[]): DirectoryTree[] {
    const map = new Map<string, DirectoryTree>();
    const roots: DirectoryTree[] = [];

    // Create tree nodes
    for (const dir of dirs) {
      map.set(dir.id, { ...dir, children: [] });
    }

    // Build hierarchy
    for (const dir of dirs) {
      const node = map.get(dir.id)!;
      if (dir.parent_id && map.has(dir.parent_id)) {
        map.get(dir.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
