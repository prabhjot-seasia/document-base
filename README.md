# Document Base

Document management system with SSO integration for the Seasia enterprise ecosystem. Upload, version, organize, search, and archive PDF documents with role-based access control.

## Architecture

```
                                SSO / OAuth2
┌─────────────────┐      Token Validation     ┌─────────────────┐
│  Document Base  │<─────────────────────────>│   Auth Service   │
│    Frontend     │                           │   (Port 8080)    │
│   (Port 3001)   │                           └─────────────────┘
└────────┬────────┘                                    ^
         │ REST API                                    │
┌────────▼────────┐         GET /sso/validate          │
│  Document Base  │────────────────────────────────────┘
│    Backend      │
│   (Port 8082)   │
└────────┬────────┘
         │ Knex.js
┌────────▼────────┐
│   PostgreSQL    │
│   (Port 5434)   │
└─────────────────┘
```

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Backend    | Node.js, Fastify, TypeScript, Knex.js             |
| Frontend   | React 19, TypeScript, React Router DOM, Axios     |
| Database   | PostgreSQL 15                                     |
| Auth       | SSO via auth-service OAuth2 authorization code flow|
| File Store | PostgreSQL BYTEA (PDF binary stored in database)  |
| Container  | Docker + Docker Compose                           |

## Prerequisites

- **Auth-service** running on port 8080 with document-base-service registered
- **Docker** and **Docker Compose** installed
- **Node.js 20+** (for local development or seeding)

## Quick Start

```bash
# Build and start all services
./setup.sh --start

# Build, start, and seed with 100 dummy documents
./setup.sh --start --seed

# Check status
./setup.sh --status
```

## Setup Script

```bash
./setup.sh --start                      # Build and start all services
./setup.sh --start --seed               # Build, start, and seed with dummy data
./setup.sh --stop                       # Stop services
./setup.sh --restart                    # Restart services
./setup.sh --status                     # Check service status
./setup.sh --logs                       # View logs (follow mode)
./setup.sh --seed                       # Seed database with 100 dummy PDFs
./setup.sh --purge-data                 # Delete all data (with confirmation)
./setup.sh --purge-data --seed          # Reset and re-seed data
./setup.sh --clean                      # Remove all containers and volumes
./setup.sh --init-db                    # Initialize external database
```

### Port Configuration

```bash
# DocBase ports
./setup.sh --docbase-backend-port 9090 --start          # Backend on 9090
./setup.sh --docbase-frontend-port 3005 --start         # Frontend on 3005
./setup.sh --docker-db-port 5435 --start                # Docker PostgreSQL on 5435
./setup.sh --docbase-backend-port 9090 \
           --docbase-frontend-port 3005 \
           --docker-db-port 5435 --start                # All custom ports

# Auth service on non-default ports
./setup.sh --auth-backend-url http://localhost:9090 \
           --auth-frontend-url http://localhost:3005 --start

# External database with custom port
./setup.sh --use-external-db --db-port 5433 --start
./setup.sh --use-external-db --db-host mydb.example.com --init-db --start
```

## Local Development

### Backend

```bash
cd backend
cp .env.example .env                    # Configure environment
npm install
npm run dev                             # Dev server on port 8082
```

### Frontend

```bash
cd frontend
npm install
npm start                               # Dev server on port 3001
```

## Service Ports

| Service    | Port |
|------------|------|
| Frontend   | 3001 |
| Backend API| 8082 |
| PostgreSQL | 5434 |
| Auth Service (external) | 8080 |

## Test Credentials

| Username     | Password    | Permissions                        |
|--------------|-------------|------------------------------------|
| `admin`      | `Admin@123` | All permissions                    |
| `doc_admin`  | `Admin@123` | documents:read + documents:write   |
| `doc_reader` | `Admin@123` | documents:read only                |

## Features

- **PDF Upload & Versioning** -- Upload PDFs, auto-version on re-upload to same name/directory
- **Directory Hierarchy** -- Create nested directory trees with materialized paths
- **Tag-Based Search** -- Tag documents, filter by multiple tags (AND logic), autocomplete
- **Full-Text Search** -- Search documents by name with debounced input
- **Pinned Documents** -- Pin important documents to the home screen, drag to reorder
- **Archive View** -- Browse superseded document versions separately
- **Role-Based Access** -- Read-only and read-write roles enforced via SSO permissions
- **Responsive Design** -- Works down to iPhone SE (375px) viewport
- **Soft Deletes** -- All deletions are recoverable

## API Endpoints

### Public

| Method | Endpoint    | Description   |
|--------|-------------|---------------|
| GET    | `/health`   | Health check  |

### Authenticated (Bearer token required)

| Method | Endpoint                              | Permission | Description                    |
|--------|---------------------------------------|------------|--------------------------------|
| GET    | `/api/me`                             | any        | Current user info              |
| GET    | `/api/directories`                    | read       | Directory tree                 |
| POST   | `/api/directories`                    | write      | Create directory               |
| PUT    | `/api/directories/:id`                | write      | Rename directory               |
| DELETE | `/api/directories/:id`                | write      | Delete directory               |
| GET    | `/api/documents`                      | read       | Search/list documents          |
| GET    | `/api/documents/:id`                  | read       | Document details               |
| GET    | `/api/documents/:id/versions`         | read       | Version history                |
| GET    | `/api/documents/:id/download`         | read       | Download current version       |
| GET    | `/api/documents/:id/versions/:vid/download` | read | Download specific version      |
| POST   | `/api/documents`                      | write      | Upload document (multipart)    |
| PUT    | `/api/documents/:id`                  | write      | Upload new version (multipart) |
| DELETE | `/api/documents/:id`                  | write      | Soft delete document           |
| GET    | `/api/documents/pinned`               | read       | List pinned documents          |
| POST   | `/api/documents/:id/pin`              | write      | Pin a document                 |
| DELETE | `/api/documents/:id/pin`              | write      | Unpin a document               |
| PUT    | `/api/documents/pinned/reorder`       | write      | Reorder pinned documents       |
| GET    | `/api/tags`                           | read       | List all tags                  |
| GET    | `/api/tags/search?q=term`             | read       | Search/autocomplete tags       |

## Environment Variables

### Backend (`backend/.env`)

| Variable         | Default                      | Description                     |
|------------------|------------------------------|---------------------------------|
| `DB_HOST`        | `localhost`                  | PostgreSQL host                 |
| `DB_PORT`        | `5434`                       | PostgreSQL port                 |
| `DB_USER`        | `postgres`                   | Database user                   |
| `DB_PASSWORD`    | `postgres`                   | Database password               |
| `DB_NAME`        | `document_base`              | Database name                   |
| `SERVER_PORT`    | `8082`                       | Backend server port             |
| `AUTH_SERVICE_URL`| `http://localhost:8080`     | Auth service base URL           |
| `CLIENT_ID`      | `document-base-clientid`     | SSO client ID                   |
| `CLIENT_SECRET`  | `document-base-clientsecret` | SSO client secret               |
| `MAX_UPLOAD_SIZE`| `52428800`                   | Max upload size in bytes (50MB) |
| `SKIP_MIGRATIONS`| `false`                      | Skip auto-migrations on startup |

### Frontend (build-time)

| Variable                     | Default                    | Description            |
|------------------------------|----------------------------|------------------------|
| `REACT_APP_API_URL`          | `http://localhost:8082`    | Backend API base URL   |
| `REACT_APP_AUTH_SERVICE_URL` | `http://localhost:8080`    | Auth service base URL  |
| `REACT_APP_CLIENT_ID`        | `document-base-clientid`   | SSO client ID          |

## Project Structure

```
document-base/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Fastify server entry point
│   │   ├── config.ts             # Environment configuration
│   │   ├── db.ts                 # Knex connection + migrations
│   │   ├── plugins/              # CORS, SSO auth middleware
│   │   ├── routes/               # health, me, directories, documents, tags
│   │   ├── services/             # Business logic (directory, document, SSO)
│   │   ├── types/                # TypeScript interfaces
│   │   └── seed-test-data.ts     # Seed script (100 dummy PDFs)
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Router setup
│   │   ├── components/           # Dashboard, Search, Upload, Viewer, etc.
│   │   ├── contexts/             # PermissionContext (RBAC)
│   │   ├── provider/             # AuthProvider (SSO)
│   │   ├── routes/               # ProtectedRoute, AuthCallback
│   │   └── utils/                # API client
│   ├── Dockerfile
│   └── nginx.conf
├── tests/
│   └── bdd/                      # Cucumber BDD tests
├── docker-compose.yml
└── setup.sh
```

