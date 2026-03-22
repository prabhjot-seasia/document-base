# Document Base - Detailed Requirements & Prompt Document

## 1. Project Overview

**Document Base** is a document management system built as a microservice within the Seasia enterprise ecosystem. It integrates with the centralized **auth-service** for Single Sign-On (SSO) authentication and Role-Based Access Control (RBAC). The system enables organizations to upload, version, organize, search, and archive PDF documents through a responsive web interface.

### Architecture

```
                                    SSO / OAuth2
┌─────────────────┐      Token Validation     ┌─────────────────┐
│  Document Base  │◄─────────────────────────►│   Auth Service   │
│    Frontend     │                           │   (Port 8080)    │
│   (Port 3001)   │                           └─────────────────┘
└────────┬────────┘                                    ▲
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
│  - directories  │
│  - documents    │
│  - versions     │
│  - tags         │
│  - file data    │
└─────────────────┘
```

### Tech Stack

| Layer      | Technology                                           |
|------------|------------------------------------------------------|
| Backend    | Node.js, Fastify framework, TypeScript, Knex.js      |
| Frontend   | React 19, TypeScript, React Router DOM, Axios        |
| Database   | PostgreSQL 15                                        |
| Styling    | Vanilla CSS (matching auth-service design system)    |
| Auth       | SSO via auth-service OAuth2 authorization code flow  |
| File Store | PostgreSQL BYTEA (PDF binary stored in database)     |
| Container  | Docker + Docker Compose + setup.sh                   |

---

## 2. User Stories

### US-1: SSO Authentication (Auto-Redirect)
**As a** user visiting Document Base,
**I want** to be automatically redirected to the auth-service login page if I'm not logged in,
**So that** I can authenticate using my existing enterprise credentials without a separate login form.

**Acceptance Criteria:**
- No login page exists in Document Base
- Unauthenticated users are redirected to auth-service SSO login (`http://localhost:8080/sso/login`)
- After successful login, user is redirected back to Document Base with a valid JWT token
- The JWT token is stored in localStorage and sent with all API requests
- If token expires, automatic refresh is attempted; if refresh fails, redirect to auth-service login
- Logout blacklists the token at auth-service and clears local session

### US-2: View Documents (Read Permission)
**As a** user with `documents:read` permission,
**I want** to browse and view all documents in the system,
**So that** I can find and read the documents I need.

**Acceptance Criteria:**
- Documents are displayed in a searchable, filterable list/card layout
- Each document shows: name, directory path, tags, current version number, start date, end date
- Clicking a document opens its detail view with download option
- Document URL contains a permanent UUID identifier (e.g., `/documents/abc-123-def`)
- Read-only users cannot see Upload, Delete, or Directory management controls

### US-3: Free-Text Search
**As a** user,
**I want** to search documents by typing keywords,
**So that** I can quickly find documents by name or content description.

**Acceptance Criteria:**
- Search bar at the top of the Documents tab
- Search queries match against document names (case-insensitive)
- Results update as user types (debounced, 300ms delay)
- Empty search shows all documents
- Search results are paginated (20 per page)

### US-4: Tag-Based Search
**As a** user,
**I want** to filter documents by tags,
**So that** I can find documents categorized under specific topics.

**Acceptance Criteria:**
- Tag filter chips/pills displayed below the search bar
- Multiple tags can be selected simultaneously (AND logic)
- Available tags are fetched from the system with autocomplete
- Tags are displayed on each document in the results
- Clicking a tag in results adds it to the active filter

### US-5: Upload Document (Write Permission)
**As a** user with `documents:write` permission,
**I want** to upload PDF documents with metadata,
**So that** documents are organized and searchable.

**Acceptance Criteria:**
- Upload form with fields:
  - **Document Name** (required, text input)
  - **Directory** (required, tree selector from hierarchy)
  - **Tags** (optional, multi-input with autocomplete for existing tags, can create new)
  - **Start Date** (optional, date picker)
  - **End Date** (optional, date picker)
  - **File** (required, PDF only, max 50MB)
- Only `.pdf` files accepted (MIME type validation on both frontend and backend)
- Upload progress indicator shown during upload
- Success/error feedback after upload
- PDF binary data stored in PostgreSQL BYTEA column

### US-6: Document Versioning
**As a** user with `documents:write` permission,
**I want** to upload a new version of an existing document,
**So that** the latest version is always accessible while preserving history.

**Acceptance Criteria:**
- When uploading a document with the same name in the same directory, the system creates a new version
- The previous version's `end_date` is automatically set to the current timestamp
- The previous version is marked as `is_archived = true`
- Version numbers auto-increment (v1, v2, v3...)
- The document's `current_version_id` always points to the latest version
- Version history is viewable per document (all versions listed with metadata)
- Any specific version can be downloaded

### US-7: Directory Hierarchy Management (Write Permission)
**As a** user with `documents:write` permission,
**I want** to create and manage a directory tree structure,
**So that** documents are organized in a logical hierarchy.

**Acceptance Criteria:**
- Tree view displaying the full directory hierarchy
- Create new directory (with parent selection)
- Rename existing directory
- Delete empty directory (with confirmation)
- Delete non-empty directory shows warning about contained documents
- No duplicate directory names within the same parent
- Materialized path stored for efficient tree queries (e.g., `/HR/Policies/Leave`)

### US-8: Archive View
**As a** user with `documents:read` permission,
**I want** to browse archived (superseded) document versions,
**So that** I can access previous versions of documents when needed.

**Acceptance Criteria:**
- Separate "Archive" tab showing only archived document versions
- Same search/filter capabilities as the main Documents tab
- Each archived version shows: document name, version number, upload date, archived date (end_date)
- Download button for each archived version
- Archived versions are clearly distinguished with visual indicators

### US-9: Permanent Document Links
**As a** user,
**I want** document URLs to contain a permanent identifier,
**So that** I can bookmark and share links that always work.

**Acceptance Criteria:**
- Document detail URL format: `/documents/:uuid`
- The UUID is the document's primary key (stable across versions)
- Accessing the URL always shows the current (latest) version
- Specific version accessible via: `/documents/:uuid/versions/:version_id`
- Links work across sessions (as long as user has valid auth)

### US-10: Responsive Design (iPhone SE Minimum)
**As a** mobile user,
**I want** the application to work well on small screens,
**So that** I can access documents from my phone.

**Acceptance Criteria:**
- Minimum supported viewport: iPhone SE (375px wide)
- Responsive breakpoints matching auth-service:
  - Desktop: full layout
  - Tablet (<=768px): single-column forms, stacked tabs
  - Mobile (<=576px): hamburger menu, side drawer navigation, hidden username
  - Extra small (<=480px): compressed spacing
  - iPhone SE (<=375px): minimal padding, adjusted font sizes
- Touch-friendly tap targets (minimum 44x44px)
- Tables scroll horizontally on small screens
- File upload works on mobile browsers

### US-11: Top Menu (Exact Auth-Service Match)
**As a** user,
**I want** the top navigation bar to look and function identically to auth-service,
**So that** I have a consistent experience across all Seasia services.

**Acceptance Criteria:**
- Header gradient: `#667eea` to `#764ba2`
- Left side: Mobile hamburger (<=576px), Seasia logo, "Document Base" title
- Right side: User dropdown with avatar (first letter), username, dropdown arrow
- User dropdown contains:
  1. User avatar (gradient circle, 48px), username, email
  2. Role badges
  3. Divider
  4. Services section with SSO links (including auth-service link)
  5. Divider
  6. Logout button (red text)
- Services in dropdown constructed with SSO authorize URL pattern
- Dropdown animation: slide-down with opacity transition

### US-12: User Dropdown with Auth-Service Link
**As a** user,
**I want** the user dropdown to include a link to auth-service,
**So that** I can navigate to the auth-service dashboard for account management.

**Acceptance Criteria:**
- Auth-service appears in the Services section of the user dropdown
- Clicking it opens auth-service in a new tab via SSO (same pattern as auth-service's own service links)
- Other accessible services also listed (based on user's permissions)
- Services without `redirect_uri` shown as disabled

---

## 3. SSO Integration Flow

### OAuth2 Authorization Code Flow

```
User Browser          Document Base FE       Auth Service BE       Auth Service FE
     |                     |                      |                      |
     |--- GET / ---------->|                      |                      |
     |                     | No token?            |                      |
     |<-- Redirect --------|                      |                      |
     |                     |                      |                      |
     |--- GET /sso/login --------------------------->|                      |
     |    ?client_id=document-base-clientid        |                      |
     |    &redirect_uri=http://localhost:3001/auth/callback               |
     |    &response_type=code                      |                      |
     |    &scope=documents:read documents:write    |                      |
     |                     |                      |                      |
     |    (No SSO cookie)  |                      |                      |
     |<-- Redirect --------------------------------|                      |
     |    to auth-service login page              |                      |
     |                     |                      |                      |
     |--- Login form -------------------------------------------------------->|
     |    username/password                       |                      |
     |<-- POST /auth/login ----------------------->|                      |
     |    returns code (JWT)                      |                      |
     |                     |                      |                      |
     |--- Redirect -------->|                      |                      |
     |    /auth/callback?code=<jwt>               |                      |
     |                     |                      |                      |
     |                     | Store JWT            |                      |
     |                     | Call /api/me          |                      |
     |                     |--- GET /sso/validate ->|                      |
     |                     |    + X-Client-ID      |                      |
     |                     |    + X-Client-Secret   |                      |
     |                     |<-- User info ---------|                      |
     |                     |                      |                      |
     |<-- Dashboard -------|                      |                      |
```

### Token Validation (Every API Request)

The document-base backend validates every authenticated request by calling auth-service:

```
Document Base FE           Document Base BE           Auth Service BE
      |                          |                          |
      |--- API Request --------->|                          |
      |    Authorization: Bearer |                          |
      |                          |--- GET /sso/validate --->|
      |                          |    Authorization: Bearer |
      |                          |    X-Client-ID           |
      |                          |    X-Client-Secret       |
      |                          |<-- {valid, user_id,  ---|
      |                          |     permissions, ...}    |
      |                          |                          |
      |                          | Check documents:read/write
      |<-- Response -------------|                          |
```

### Auth-Service Registration (Already Exists)

The document-base-service is pre-registered in auth-service seed data:
- **Service ID**: `22222222-2222-2222-2222-222222222222`
- **Client ID**: `document-base-clientid`
- **Client Secret**: `document-base-clientsecret` (stored bcrypt hashed)
- **Redirect URI**: `http://localhost:3001`
- **Scopes**: `documents:read documents:write`

### Test Users

| Username    | Password  | Role                        | Permissions                 |
|-------------|-----------|-----------------------------|-----------------------------|
| admin       | Admin@123 | administrator               | All (including documents)   |
| doc_admin   | Admin@123 | document_administrator      | documents:read, documents:write |
| doc_reader  | Admin@123 | document_read_administrator | documents:read              |

---

## 4. Database Schema

### Entity Relationship

```
directories (1) <---- (N) documents (1) <---- (N) document_versions
                                    |
                                    +---- (N) document_tags (N) ----> (1) tags
```

### Table: directories

| Column     | Type         | Constraints                     | Description                    |
|------------|--------------|----------------------------------|-------------------------------|
| id         | UUID         | PK, DEFAULT uuid_generate_v4() | Primary key                    |
| name       | VARCHAR(255) | NOT NULL                        | Directory name                 |
| parent_id  | UUID         | FK -> directories(id), NULLABLE | Parent directory (NULL = root) |
| path       | TEXT         | NOT NULL                        | Materialized path e.g. "/HR/Policies" |
| created_by | VARCHAR(255) | NOT NULL                        | Username from SSO              |
| created_at | TIMESTAMPTZ  | DEFAULT NOW()                   | Creation timestamp             |
| updated_at | TIMESTAMPTZ  | DEFAULT NOW()                   | Last update timestamp          |
| deleted_at | TIMESTAMPTZ  | NULLABLE                        | Soft delete                    |

**Constraints**: UNIQUE(parent_id, name)
**Indexes**: parent_id, path, deleted_at

### Table: documents

| Column             | Type         | Constraints                     | Description                    |
|--------------------|--------------|----------------------------------|-------------------------------|
| id                 | UUID         | PK, DEFAULT uuid_generate_v4() | Permanent document identifier  |
| name               | VARCHAR(500) | NOT NULL                        | Document display name          |
| directory_id       | UUID         | FK -> directories(id), NOT NULL | Parent directory               |
| current_version_id | UUID         | FK -> document_versions(id)     | Points to latest version       |
| created_by         | VARCHAR(255) | NOT NULL                        | Username from SSO              |
| created_at         | TIMESTAMPTZ  | DEFAULT NOW()                   | Creation timestamp             |
| updated_at         | TIMESTAMPTZ  | DEFAULT NOW()                   | Last update timestamp          |
| deleted_at         | TIMESTAMPTZ  | NULLABLE                        | Soft delete                    |

**Constraints**: UNIQUE(directory_id, name)
**Indexes**: directory_id, name, deleted_at

### Table: document_versions

| Column         | Type         | Constraints                     | Description                    |
|----------------|--------------|----------------------------------|-------------------------------|
| id             | UUID         | PK, DEFAULT uuid_generate_v4() | Version identifier             |
| document_id    | UUID         | FK -> documents(id), NOT NULL   | Parent document                |
| version_number | INT          | NOT NULL, DEFAULT 1            | Auto-incrementing per document |
| file_data      | BYTEA        | NOT NULL                        | PDF binary content             |
| file_name      | VARCHAR(500) | NOT NULL                        | Original uploaded filename     |
| file_size      | BIGINT       | NOT NULL                        | File size in bytes             |
| mime_type      | VARCHAR(100) | NOT NULL, DEFAULT 'application/pdf' | MIME type              |
| start_date     | DATE         | NULLABLE                        | Document effective start date  |
| end_date       | DATE         | NULLABLE                        | Set when new version uploaded  |
| is_archived    | BOOLEAN      | DEFAULT FALSE                   | True when superseded           |
| uploaded_by    | VARCHAR(255) | NOT NULL                        | Username from SSO              |
| created_at     | TIMESTAMPTZ  | DEFAULT NOW()                   | Upload timestamp               |
| updated_at     | TIMESTAMPTZ  | DEFAULT NOW()                   | Last update timestamp          |
| deleted_at     | TIMESTAMPTZ  | NULLABLE                        | Soft delete                    |

**Constraints**: UNIQUE(document_id, version_number)
**Indexes**: document_id, is_archived

### Table: tags

| Column     | Type         | Constraints                     | Description         |
|------------|--------------|----------------------------------|---------------------|
| id         | UUID         | PK, DEFAULT uuid_generate_v4() | Tag identifier       |
| name       | VARCHAR(100) | NOT NULL, UNIQUE                | Tag name (lowercase) |
| created_at | TIMESTAMPTZ  | DEFAULT NOW()                   | Creation timestamp   |

### Table: document_tags (Junction)

| Column      | Type | Constraints                  | Description      |
|-------------|------|-------------------------------|-----------------|
| document_id | UUID | FK -> documents(id), NOT NULL | Document          |
| tag_id      | UUID | FK -> tags(id), NOT NULL      | Tag               |

**Constraints**: PRIMARY KEY (document_id, tag_id)
**Indexes**: tag_id

---

## 5. API Specification

### Public Endpoints

#### GET /health
Health check endpoint.
```json
Response 200: { "status": "ok", "service": "document-base" }
```

### Authenticated Endpoints (Bearer Token Required)

#### GET /api/me
Returns current user info from SSO validation.
```json
Response 200: {
  "user_id": "uuid",
  "username": "string",
  "email": "string",
  "roles": ["string"],
  "groups": ["string"],
  "permissions": [{"resource": "documents", "action": "read"}]
}
```

#### GET /api/directories
Returns full directory tree.
```json
Response 200: [{
  "id": "uuid",
  "name": "HR",
  "parent_id": null,
  "path": "/HR",
  "children": [{
    "id": "uuid",
    "name": "Policies",
    "parent_id": "parent-uuid",
    "path": "/HR/Policies",
    "children": []
  }]
}]
```

#### POST /api/directories (requires documents:write)
```json
Request: { "name": "Policies", "parent_id": "uuid-or-null" }
Response 201: { "id": "uuid", "name": "Policies", "parent_id": "uuid", "path": "/HR/Policies" }
```

#### PUT /api/directories/:id (requires documents:write)
```json
Request: { "name": "New Name" }
Response 200: { "id": "uuid", "name": "New Name", "path": "/HR/New Name" }
```

#### DELETE /api/directories/:id (requires documents:write)
```json
Response 200: { "message": "Directory deleted" }
Response 409: { "error": "Directory contains documents. Delete documents first." }
```

#### GET /api/documents
Search and list documents.
```
Query params:
  q         - Free-text search (matches document name, case-insensitive)
  tags      - Comma-separated tag names (AND filter)
  directory_id - Filter by directory UUID
  archived  - "true" to show only archived versions, "false" (default) for current
  page      - Page number (default: 1)
  page_size - Items per page (default: 20, max: 100)
```
```json
Response 200: {
  "documents": [{
    "id": "uuid",
    "name": "Leave Policy 2024",
    "directory": { "id": "uuid", "name": "Policies", "path": "/HR/Policies" },
    "current_version": {
      "id": "uuid",
      "version_number": 3,
      "file_name": "leave-policy-2024.pdf",
      "file_size": 245760,
      "start_date": "2024-01-01",
      "end_date": null,
      "uploaded_by": "doc_admin",
      "created_at": "2024-06-15T10:30:00Z"
    },
    "tags": [{"id": "uuid", "name": "hr"}, {"id": "uuid", "name": "leave"}],
    "created_by": "doc_admin",
    "created_at": "2024-01-15T08:00:00Z"
  }],
  "total": 150,
  "page": 1,
  "page_size": 20
}
```

#### GET /api/documents/:id
Get document details with current version and tags.
```json
Response 200: {
  "id": "uuid",
  "name": "Leave Policy 2024",
  "directory": { "id": "uuid", "name": "Policies", "path": "/HR/Policies" },
  "current_version": { ... },
  "tags": [...],
  "total_versions": 3,
  "created_by": "doc_admin",
  "created_at": "2024-01-15T08:00:00Z"
}
```

#### GET /api/documents/:id/versions
Get version history for a document.
```json
Response 200: [{
  "id": "uuid",
  "version_number": 3,
  "file_name": "leave-policy-v3.pdf",
  "file_size": 245760,
  "start_date": "2024-06-01",
  "end_date": null,
  "is_archived": false,
  "uploaded_by": "doc_admin",
  "created_at": "2024-06-15T10:30:00Z"
}, {
  "id": "uuid",
  "version_number": 2,
  "file_name": "leave-policy-v2.pdf",
  "file_size": 230400,
  "start_date": "2024-01-01",
  "end_date": "2024-06-15",
  "is_archived": true,
  "uploaded_by": "doc_admin",
  "created_at": "2024-03-01T09:00:00Z"
}]
```

#### GET /api/documents/:id/download
Download current version PDF.
```
Response 200: application/pdf binary stream
Headers: Content-Disposition: attachment; filename="leave-policy-2024.pdf"
```

#### GET /api/documents/:id/versions/:vid/download
Download specific version PDF.

#### POST /api/documents (requires documents:write)
Upload new document. Multipart form data.
```
Form fields:
  name         - Document name (required)
  directory_id - Directory UUID (required)
  tags         - Comma-separated tag names (optional)
  start_date   - YYYY-MM-DD (optional)
  end_date     - YYYY-MM-DD (optional)
  file         - PDF file (required, max 50MB)
```
```json
Response 201: {
  "id": "uuid",
  "name": "Leave Policy 2024",
  "version": 1,
  "message": "Document uploaded successfully"
}
```

#### PUT /api/documents/:id (requires documents:write)
Re-upload document (creates new version). Multipart form data.
```
Form fields:
  tags       - Updated tags (optional, replaces existing)
  start_date - New version start date (optional)
  end_date   - New version end date (optional)
  file       - PDF file (required, max 50MB)
```
```json
Response 200: {
  "id": "uuid",
  "name": "Leave Policy 2024",
  "version": 2,
  "message": "New version uploaded. Previous version archived."
}
```
**Side effects**: Previous version's `end_date` set to NOW(), `is_archived` set to TRUE.

#### DELETE /api/documents/:id (requires documents:write)
Soft-delete document and all versions.
```json
Response 200: { "message": "Document deleted" }
```

#### GET /api/tags
List all tags.
```json
Response 200: [{"id": "uuid", "name": "hr"}, {"id": "uuid", "name": "policy"}]
```

#### GET /api/tags/search?q=term
Search tags by name prefix (autocomplete).
```json
Response 200: [{"id": "uuid", "name": "hr"}, {"id": "uuid", "name": "hiring"}]
```

---

## 6. Permission Matrix

| Action                    | documents:read | documents:write |
|---------------------------|:--------------:|:---------------:|
| View Documents tab        |       Y        |        Y        |
| Search documents          |       Y        |        Y        |
| Filter by tags            |       Y        |        Y        |
| Download documents        |       Y        |        Y        |
| View document versions    |       Y        |        Y        |
| View Archive tab          |       Y        |        Y        |
| See Upload tab            |       N        |        Y        |
| Upload new document       |       N        |        Y        |
| Upload new version        |       N        |        Y        |
| Delete document           |       N        |        Y        |
| See Directories tab       |       N        |        Y        |
| Create directory          |       N        |        Y        |
| Rename directory          |       N        |        Y        |
| Delete directory          |       N        |        Y        |

---

## 7. Versioning & Archive Logic

### Upload New Document
1. Check if document with same name exists in the selected directory
2. If **no**: Create new `documents` record (version 1), create `document_versions` record, store PDF in `file_data`
3. If **yes**: Treat as version update (see below)

### Upload New Version (Same Name in Same Directory, or PUT /api/documents/:id)
1. Find existing document
2. Set current version's `end_date = NOW()`, `is_archived = TRUE`
3. Create new `document_versions` record with `version_number = previous + 1`
4. Update `documents.current_version_id` to point to new version
5. Store new PDF binary in `file_data`
6. All steps wrapped in a database transaction for atomicity

### Archive Hierarchy
- Archived versions remain in the same directory tree structure
- The Archive view shows a separate browsing experience filtering `is_archived = true`
- Version numbers are preserved (v1, v2, v3...)
- Each version retains its own start_date, end_date, and uploaded_by metadata

### Permanent Links
- Document URL: `/documents/:document_uuid` -> always shows current version
- Version URL: `/documents/:document_uuid/versions/:version_uuid` -> shows specific version
- Document UUID is stable - never changes across versions

---

## 8. UI Component Layout

### Dashboard Layout
```
+-----------------------------------------------------+
| hamburger  [Seasia Logo]  Document Base   [User v]   |  <- Gradient header
+-----------------------------------------------------+
| [Documents] [Upload*] [Directories*] [Archive]       |  <- Tabs (* = write only)
+-----------------------------------------------------+
|                                                      |
|                  Tab Content                         |
|                                                      |
+-----------------------------------------------------+
```

### Documents Tab (Search)
```
+-----------------------------------------------------+
| [Search documents...                              ]  |
| Tags: [hr x] [policy x] [+ Add tag]                 |
| Directory: [All v]                                   |
+-----------------------------------------------------+
| +--------------------------------------------------+|
| | PDF  Leave Policy 2024                    v3      ||
| | /HR/Policies  |  Tags: hr, leave, policy         ||
| | Start: 2024-06-01  |  Uploaded by: doc_admin     ||
| +--------------------------------------------------+|
| +--------------------------------------------------+|
| | PDF  IT Security Guidelines              v1      ||
| | /IT/Security  |  Tags: it, security              ||
| | Start: 2024-03-15  |  End: -                     ||
| +--------------------------------------------------+|
|                                                      |
| Showing 1-20 of 150  [< 1 2 3 4 ... 8 >]           |
+-----------------------------------------------------+
```

### Upload Tab
```
+-----------------------------------------------------+
| Upload Document                                      |
+-----------------------------------------------------+
| Document Name:  [________________________]           |
|                                                      |
| Directory:      [Select directory... v]              |
|                 +-- HR                               |
|                 |   +-- Policies                     |
|                 |   +-- Training                     |
|                 +-- IT                               |
|                 |   +-- Security                     |
|                 +-- Finance                          |
|                                                      |
| Tags:           [hr x] [policy x] [type to add...]  |
|                                                      |
| Start Date:     [2024-01-01]                         |
| End Date:       [          ] (optional)              |
|                                                      |
| File:           [Choose PDF...] leave-policy.pdf     |
|                                                      |
| [Upload Document]                                    |
+-----------------------------------------------------+
```

### Directory Manager Tab
```
+-----------------------------------------------------+
| Directory Management              [+ New Directory]  |
+-----------------------------------------------------+
| v HR                                    [edit] [del] |
|   +-- Policies                          [edit] [del] |
|   +-- Training                          [edit] [del] |
|   +-- Recruitment                       [edit] [del] |
| v IT                                    [edit] [del] |
|   +-- Security                          [edit] [del] |
|   +-- Infrastructure                    [edit] [del] |
| > Finance                               [edit] [del] |
| > Legal                                 [edit] [del] |
+-----------------------------------------------------+
```

---

## 9. Non-Functional Requirements

### Performance
- **Concurrent Users**: Support at least 300 concurrent users
- **Database Connection Pool**: min 10, max 25 (Knex.js pool)
- **API Pagination**: Default 20 items, max 100 per page
- **Search Debounce**: 300ms delay on frontend
- **Upload Limit**: 50MB max file size
- **Response Time**: API responses < 500ms (excluding file upload/download)

### Security
- All API calls require valid JWT from auth-service SSO
- File uploads validated for PDF MIME type on both frontend and backend
- SQL injection prevention via Knex.js parameterized queries
- XSS prevention via React's built-in escaping
- CORS configured for frontend origin
- No secrets in frontend code (client_secret only on backend)

### Responsive Design
- Minimum viewport: 375px (iPhone SE)
- CSS breakpoints: 375px, 480px, 576px, 768px
- Touch-friendly controls (44px minimum tap targets)
- Mobile-first progressive enhancement

### Reliability
- Soft deletes for all data (recoverable)
- Database transactions for versioning operations (archive + create atomic)
- Graceful error handling with user-friendly messages
- Health check endpoint for monitoring

---

## 10. Deployment

### Docker Compose Services
| Service  | Image/Build | Port (External:Internal) | Dependencies |
|----------|-------------|--------------------------|--------------|
| db       | postgres:15 | 5434:5432                | -            |
| backend  | ./backend   | 8082:8082                | db           |
| frontend | ./frontend  | 3001:80                  | backend      |

### setup.sh Script
Modeled after auth-service setup.sh with same CLI interface:
```bash
./setup.sh --build --start              # Build and start all services
./setup.sh --status                     # Check service status
./setup.sh --logs                       # View logs
./setup.sh --stop                       # Stop services
./setup.sh --restart                    # Restart services
./setup.sh --clean                      # Clean Docker resources
./setup.sh --server-port 9090           # Custom backend port
./setup.sh --frontend-port 3002         # Custom frontend port
./setup.sh --auth-service-url http://auth:8080  # Custom auth-service URL
./setup.sh --use-external-db --db-host localhost  # External database
```

### Environment Variables (Backend)

| Variable           | Default                    | Description                        |
|--------------------|----------------------------|------------------------------------|
| DB_HOST            | localhost                  | PostgreSQL host                    |
| DB_PORT            | 5434                       | PostgreSQL port                    |
| DB_USER            | postgres                   | Database user                      |
| DB_PASSWORD        | postgres                   | Database password                  |
| DB_NAME            | document_base              | Database name                      |
| DB_SSL_MODE        | disable                    | SSL mode                           |
| SERVER_PORT        | 8082                       | Backend server port                |
| AUTH_SERVICE_URL   | http://localhost:8080       | Auth service base URL              |
| CLIENT_ID          | document-base-clientid     | SSO client ID                      |
| CLIENT_SECRET      | document-base-clientsecret | SSO client secret (plain text)     |
| MAX_UPLOAD_SIZE    | 52428800                   | Max upload size in bytes (50MB)    |
| SKIP_MIGRATIONS    | false                      | Skip auto-migrations on startup    |

### Environment Variables (Frontend)

| Variable                   | Default                 | Description              |
|----------------------------|-------------------------|--------------------------|
| REACT_APP_API_URL          | http://localhost:8082   | Backend API base URL     |
| REACT_APP_AUTH_SERVICE_URL | http://localhost:8080   | Auth service base URL    |
| REACT_APP_CLIENT_ID        | document-base-clientid | SSO client ID            |

### Prerequisites
- Auth-service running on port 8080 with document-base-service registered
- Docker and Docker Compose installed
- Node.js 20+ (for local development)
