# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Document management system with SSO integration via auth-service. Node.js (Fastify + TypeScript) backend, React frontend. Features PDF upload/versioning, directory hierarchy, tag-based search, role-based access via auth-service SSO.

## Development Commands

### Full Stack (Docker)
```bash
./setup.sh --build --start              # Build and start via setup script
./setup.sh --status                     # Check status
./setup.sh --logs                       # View logs
./setup.sh --stop                       # Stop services
```

### Backend (Node.js + TypeScript)
```bash
cd backend
cp .env.example .env                    # Configure environment
npm install                             # Install dependencies
npm run dev                             # Run dev server (port 8082)
npm run build                           # Build TypeScript
npm start                               # Run built server
```

### Frontend (React 19 / TypeScript)
```bash
cd frontend
npm install                             # Install dependencies
npm start                               # Dev server (port 3001)
npm run build                           # Production build
```

## Architecture

### Backend
```
routes → services → knex (database)
```
- **Entry point**: `backend/src/index.ts` — Fastify server setup, plugin registration, routes
- **Config**: `backend/src/config.ts` — dotenv-based configuration
- **Database**: `backend/src/db.ts` — Knex connection pool + inline migrations
- **Plugins**: `backend/src/plugins/` — CORS, SSO auth (preHandler hooks)
- **Routes**: `backend/src/routes/` — health, me, directories, documents, tags
- **Services**: `backend/src/services/` — directoryService, documentService, ssoClient
- **Types**: `backend/src/types/index.ts` — TypeScript interfaces

### SSO Auth Flow
1. Frontend detects no token → redirects to auth-service `/sso/login`
2. Auth-service authenticates → redirects back with authorization code
3. Frontend exchanges code for JWT via `/auth/token`
4. Backend validates JWT with auth-service `GET /sso/validate` (X-Client-ID + X-Client-Secret headers)

### Database
- PostgreSQL 15, Knex.js query builder
- Tables: directories, documents, document_versions, tags, document_tags, pinned_documents
- PDF files stored as BYTEA in document_versions.file_data
- Migrations auto-run on startup (skip with SKIP_MIGRATIONS=true)
- Connection pool: min 10, max 25

### Document Versioning
- Upload same name + directory → creates new version, archives old
- Archive sets is_archived=true and end_date on previous version
- All operations wrapped in Knex transactions

### Frontend Structure
- **AuthProvider** (`provider/authProvider.tsx`) — SSO auth (NO login page, auto-redirect)
- **PermissionContext** (`contexts/PermissionContext.tsx`) — RBAC permission checking
- **ProtectedRoute** (`routes/ProtectedRoute.tsx`) — auto-redirects to auth-service
- **Dashboard** (`components/Dashboard.tsx`) — header matches auth-service exactly

### Key Dependencies
- Backend: fastify, @fastify/cors, @fastify/multipart, knex, pg, axios, uuid
- Frontend: react, react-router-dom, axios

## Service Ports
- Backend API: 8082
- Frontend: 3001
- PostgreSQL: 5434 (external)
- Auth Service: 8080 (external dependency)

## Environment Configuration
Copy `backend/.env.example` to `backend/.env`. Key variables:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SERVER_PORT`, `SERVER_HOST`
- `AUTH_SERVICE_URL` — auth service base URL
- `CLIENT_ID`, `CLIENT_SECRET` — SSO client credentials
- `MAX_UPLOAD_SIZE` — max PDF upload size in bytes (default: 50MB)
- `SKIP_MIGRATIONS` — skip auto-migrations on startup

## Default Test Users (from auth-service)
- **doc_admin** / `Admin@123` — documents:read + documents:write
- **doc_reader** / `Admin@123` — documents:read only
- **admin** / `Admin@123` — all permissions

## API Endpoints

### Public
- `GET /health` — health check

### Authenticated (SSO Bearer token)
- `GET /api/me` — current user info + permissions
- `GET /api/directories` — directory tree
- `POST /api/directories` — create directory [write]
- `PUT /api/directories/:id` — rename directory [write]
- `DELETE /api/directories/:id` — delete directory [write]
- `GET /api/documents` — search documents (query: q, tags, directory_id, archived, page, page_size)
- `GET /api/documents/:id` — document details
- `GET /api/documents/:id/versions` — version history
- `GET /api/documents/:id/download` — download current version
- `GET /api/documents/:id/versions/:vid/download` — download specific version
- `POST /api/documents` — upload new document (multipart) [write]
- `PUT /api/documents/:id` — re-upload (new version, multipart) [write]
- `DELETE /api/documents/:id` — soft delete document [write]
- `GET /api/documents/pinned` — list pinned documents (ordered)
- `POST /api/documents/:id/pin` — pin a document [write]
- `DELETE /api/documents/:id/pin` — unpin a document [write]
- `PUT /api/documents/pinned/reorder` — reorder pinned documents (body: document_ids[]) [write]
- `GET /api/tags` — list all tags
- `GET /api/tags/search?q=term` — search/autocomplete tags

## Important Implementation Details

- **No login page** — ProtectedRoute auto-redirects to auth-service SSO
- **PDF only** — uploads accept application/pdf mime type
- **Soft deletes** — all queries filter WHERE deleted_at IS NULL
- **Materialized paths** — directory hierarchy uses path column (e.g., "/HR/Policies")
- **BYTEA storage** — PDFs stored in PostgreSQL, not filesystem
- **Header matches auth-service** — gradient #667eea to #764ba2, Seasia logo, user dropdown with services
- **Pinned documents** — write users can pin/unpin documents; pinned docs shown on home screen with drag-to-reorder
