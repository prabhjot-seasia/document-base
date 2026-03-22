export interface SSOUserInfo {
  valid: boolean;
  user_id: string;
  username: string;
  email: string;
  roles: string[];
  groups: string[];
  permissions: Permission[];
  service_id?: string;
  service_name?: string;
  expires_at?: number;
  error?: string;
}

export interface Permission {
  resource: string;
  action: string;
}

export interface Directory {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DirectoryTree extends Directory {
  children: DirectoryTree[];
}

export interface Document {
  id: string;
  name: string;
  directory_id: string;
  current_version_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_data?: Buffer;
  file_name: string;
  file_size: number;
  mime_type: string;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

export interface PinnedDocument {
  id: string;
  document_id: string;
  sort_order: number;
  pinned_by: string;
  pinned_at: string;
}

export interface DocumentWithDetails {
  id: string;
  name: string;
  directory: {
    id: string;
    name: string;
    path: string;
  };
  current_version: Omit<DocumentVersion, 'file_data'> | null;
  tags: Tag[];
  total_versions?: number;
  created_by: string;
  created_at: string;
  is_pinned?: boolean;
}

export interface PaginatedResponse<T> {
  documents: T[];
  total: number;
  page: number;
  page_size: number;
}

// Fastify request augmentation
declare module 'fastify' {
  interface FastifyRequest {
    user?: SSOUserInfo;
  }
}
