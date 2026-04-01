#!/bin/bash

set -e

DEFAULT_DB_HOST="host.docker.internal"
DEFAULT_DB_PORT="5432"
DEFAULT_DB_USER="postgres"
DEFAULT_DB_PASSWORD="postgres"
DEFAULT_DB_NAME="document_base"
DEFAULT_DB_SSL_MODE="disable"
DEFAULT_DOCKER_DB_PORT="5434"
DEFAULT_DOCBASE_BACKEND_PORT="8082"
DEFAULT_DOCBASE_BACKEND_HOST="0.0.0.0"
DEFAULT_DOCBASE_FRONTEND_PORT="3001"
DEFAULT_AUTH_BACKEND_URL="http://localhost:8080"
DEFAULT_AUTH_FRONTEND_URL="http://localhost:3000"
DEFAULT_CLIENT_ID="document-base-clientid"
DEFAULT_CLIENT_SECRET="document-base-clientsecret"
DEFAULT_MAX_UPLOAD_SIZE="52428800"
DEFAULT_USE_EXTERNAL_DB="false"

DB_HOST="$DEFAULT_DB_HOST"
DB_PORT="$DEFAULT_DB_PORT"
DB_USER="$DEFAULT_DB_USER"
DB_PASSWORD="$DEFAULT_DB_PASSWORD"
DB_NAME="$DEFAULT_DB_NAME"
DB_SSL_MODE="$DEFAULT_DB_SSL_MODE"
DB_PORT_EXTERNAL="$DEFAULT_DOCKER_DB_PORT"
SERVER_PORT="$DEFAULT_DOCBASE_BACKEND_PORT"
SERVER_HOST="$DEFAULT_DOCBASE_BACKEND_HOST"
FRONTEND_PORT="$DEFAULT_DOCBASE_FRONTEND_PORT"
DOCBASE_BACKEND_URL=""
DOCBASE_FRONTEND_URL=""
AUTH_SERVICE_URL="$DEFAULT_AUTH_BACKEND_URL"
AUTH_SERVICE_FRONTEND_URL="$DEFAULT_AUTH_FRONTEND_URL"
CLIENT_ID="$DEFAULT_CLIENT_ID"
CLIENT_SECRET="$DEFAULT_CLIENT_SECRET"
MAX_UPLOAD_SIZE="$DEFAULT_MAX_UPLOAD_SIZE"
USE_EXTERNAL_DB="$DEFAULT_USE_EXTERNAL_DB"

DO_BUILD=false
DO_START=false
DO_STOP=false
DO_RESTART=false
DO_LOGS=false
DO_STATUS=false
DO_CLEAN=false
DO_INIT_DB=false
DO_SEED=false
DO_PURGE=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]  $1${NC}"
}

print_success() {
    echo -e "${GREEN}[OK]    $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARN]  $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "   Document Base Setup Script"
    echo "=========================================="
    echo -e "${NC}"
}

show_help() {
    cat << EOF
Document Base Setup Script

USAGE:
    ./setup.sh [OPTIONS]

OPTIONS:
    Document Base URLs:
    --docbase-backend-url URL     DocBase backend URL (default: http://localhost:8082)
                                  Use when backend is on a different IP or hostname
    --docbase-frontend-url URL    DocBase frontend URL (default: http://localhost:3001)
                                  Use when frontend is on a different IP or hostname

    Document Base Ports:
    --docbase-backend-port PORT   DocBase backend API port (default: 8082)
    --docbase-frontend-port PORT  DocBase frontend UI port (default: 3001)

    Auth Service (external dependency):
    --auth-backend-url URL      Auth service backend API (default: http://localhost:8080)
                                Used for token exchange, token validation, and SSO redirects
    --auth-frontend-url URL     Auth service frontend UI (default: http://localhost:3000)
                                The SSO login page the user sees in the browser
    --client-id ID              SSO client ID (default: document-base-clientid)
    --client-secret SECRET      SSO client secret (default: document-base-clientsecret)

    Database Configuration:
    --db-host HOST              Database host (default: host.docker.internal)
    --db-port PORT              Database connection port (default: 5432)
    --db-user USER              Database username (default: postgres)
    --db-password PASSWORD      Database password (default: postgres)
    --db-name NAME              Database name (default: document_base)
    --db-ssl-mode MODE          Database SSL mode (default: disable)
    --use-external-db           Use external database instead of Docker

    Docker Configuration:
    --docker-db-port PORT       PostgreSQL host-side port in Docker mode (default: 5434)

    Actions:
    --build                     Build Docker images
    --start                     Build and start services
    --stop                      Stop services
    --restart                   Restart services
    --init-db                   Initialize external database (create DB)
    --seed                      Seed database with dummy PDFs and directories
    --purge-data                Delete ALL documents, directories, and tags (requires confirmation)
    --logs                      View logs
    --status                    Check service status
    --clean                     Remove all containers and volumes

    --help                      Show this help message

DEFAULT PORTS:
    Auth Backend:               8080    (--auth-backend-url, external dependency)
    Auth Frontend:              3000    (--auth-frontend-url, external dependency)
    DocBase Backend:            8082    (--docbase-backend-port)
    DocBase Frontend:           3001    (--docbase-frontend-port)
    PostgreSQL (Docker):        5434    (--docker-db-port)
    PostgreSQL (connection):    5432    (--db-port)

EXAMPLES:
    ./setup.sh --start                                                  # Start with defaults
    ./setup.sh --start --seed                                           # Start and seed data
    ./setup.sh --purge-data --seed                                      # Reset data

    # Port changes
    ./setup.sh --docbase-backend-port 9090 --start                      # Backend on 9090
    ./setup.sh --docbase-frontend-port 3005 --start                     # Frontend on 3005
    ./setup.sh --docker-db-port 5435 --start                            # Docker PostgreSQL on 5435
    ./setup.sh --docbase-backend-port 9090 --docbase-frontend-port 3005 \\
               --docker-db-port 5435 --start                            # All custom ports

    # DocBase on a different IP
    ./setup.sh --docbase-backend-url http://192.168.1.50:8082 \\
               --docbase-frontend-url http://192.168.1.50:3001 --start

    # Auth service on non-default ports/IP
    ./setup.sh --auth-backend-url http://192.168.1.10:8080 \\
               --auth-frontend-url http://192.168.1.10:3000 --start

    # External database
    ./setup.sh --use-external-db --db-host localhost --init-db --start
    ./setup.sh --use-external-db --db-port 5433 --start                 # Custom DB port

    # Full custom setup
    ./setup.sh --docbase-backend-port 9090 --docbase-frontend-port 3005 \\
               --auth-backend-url http://auth:8080 \\
               --auth-frontend-url http://auth:3000 \\
               --use-external-db --db-host db.example.com \\
               --client-id my-client-id --client-secret my-secret \\
               --start --seed

DEFAULT TEST CREDENTIALS (from auth-service):
    doc_admin  / Admin@123    (documents:read + documents:write)
    doc_reader / Admin@123    (documents:read only)
    admin      / Admin@123    (all permissions)
EOF
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --docbase-backend-url) DOCBASE_BACKEND_URL="$2"; shift 2 ;;
        --docbase-frontend-url) DOCBASE_FRONTEND_URL="$2"; shift 2 ;;
        --docbase-backend-port) SERVER_PORT="$2"; shift 2 ;;
        --docbase-frontend-port) FRONTEND_PORT="$2"; shift 2 ;;
        --auth-backend-url) AUTH_SERVICE_URL="$2"; shift 2 ;;
        --auth-frontend-url) AUTH_SERVICE_FRONTEND_URL="$2"; shift 2 ;;
        --client-id) CLIENT_ID="$2"; shift 2 ;;
        --client-secret) CLIENT_SECRET="$2"; shift 2 ;;
        --db-host) DB_HOST="$2"; shift 2 ;;
        --db-port) DB_PORT="$2"; shift 2 ;;
        --db-user) DB_USER="$2"; shift 2 ;;
        --db-password) DB_PASSWORD="$2"; shift 2 ;;
        --db-name) DB_NAME="$2"; shift 2 ;;
        --db-ssl-mode) DB_SSL_MODE="$2"; shift 2 ;;
        --docker-db-port) DB_PORT_EXTERNAL="$2"; shift 2 ;;
        --use-external-db) USE_EXTERNAL_DB="true"; shift ;;
        --build) DO_BUILD=true; shift ;;
        --start) DO_START=true; shift ;;
        --stop) DO_STOP=true; shift ;;
        --restart) DO_RESTART=true; shift ;;
        --init-db) DO_INIT_DB=true; shift ;;
        --seed) DO_SEED=true; shift ;;
        --purge-data) DO_PURGE=true; shift ;;
        --logs) DO_LOGS=true; shift ;;
        --status) DO_STATUS=true; shift ;;
        --clean) DO_CLEAN=true; shift ;;
        --help) show_help; exit 0 ;;
        *) print_error "Unknown option: $1. Use --help for usage." ;;
    esac
done

validate_config() {
    print_info "Validating configuration..."

    if ! [[ "$SERVER_PORT" =~ ^[0-9]+$ ]] || [ "$SERVER_PORT" -lt 1 ] || [ "$SERVER_PORT" -gt 65535 ]; then
        print_error "Invalid docbase backend port: $SERVER_PORT"
    fi

    if ! [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || [ "$FRONTEND_PORT" -lt 1 ] || [ "$FRONTEND_PORT" -gt 65535 ]; then
        print_error "Invalid docbase frontend port: $FRONTEND_PORT"
    fi

    if ! [[ "$DB_PORT" =~ ^[0-9]+$ ]] || [ "$DB_PORT" -lt 1 ] || [ "$DB_PORT" -gt 65535 ]; then
        print_error "Invalid database port: $DB_PORT"
    fi

    if ! [[ "$DB_PORT_EXTERNAL" =~ ^[0-9]+$ ]] || [ "$DB_PORT_EXTERNAL" -lt 1 ] || [ "$DB_PORT_EXTERNAL" -gt 65535 ]; then
        print_error "Invalid docker db port: $DB_PORT_EXTERNAL"
    fi

    if ! [[ "$MAX_UPLOAD_SIZE" =~ ^[0-9]+$ ]] || [ "$MAX_UPLOAD_SIZE" -lt 1 ]; then
        print_error "Invalid max upload size: $MAX_UPLOAD_SIZE"
    fi

    print_success "Configuration validated"
}

generate_env() {
    print_info "Generating backend/.env configuration..."

    cat > backend/.env << EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSL_MODE=${DB_SSL_MODE}
SERVER_PORT=${SERVER_PORT}
SERVER_HOST=${SERVER_HOST}
AUTH_SERVICE_URL=${AUTH_SERVICE_URL}
CLIENT_ID=${CLIENT_ID}
CLIENT_SECRET=${CLIENT_SECRET}
MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE}
SKIP_MIGRATIONS=false
EOF

    print_success "Generated backend/.env"
}

resolve_urls() {
    if [[ -z "$DOCBASE_BACKEND_URL" ]]; then
        DOCBASE_BACKEND_URL="http://localhost:${SERVER_PORT}"
    fi
    if [[ -z "$DOCBASE_FRONTEND_URL" ]]; then
        DOCBASE_FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
    fi
}

to_docker_url() {
    echo "${1//localhost/host.docker.internal}"
}

export_docker_vars() {
    resolve_urls
    export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME DB_SSL_MODE DB_PORT_EXTERNAL
    export SERVER_PORT SERVER_HOST
    export FRONTEND_PORT
    export DOCBASE_BACKEND_URL DOCBASE_FRONTEND_URL
    export CLIENT_ID CLIENT_SECRET
    export MAX_UPLOAD_SIZE
    export AUTH_SERVICE_URL
    export AUTH_SERVICE_FRONTEND_URL
    AUTH_SERVICE_URL_DOCKER="$(to_docker_url "$AUTH_SERVICE_URL")"
    export AUTH_SERVICE_URL_DOCKER
}

dc() {
    export_docker_vars
    if [[ "$USE_EXTERNAL_DB" == "true" ]]; then
        docker compose "$@"
    else
        docker compose --profile docker-db "$@"
    fi
}

do_init_db() {
    print_info "Initializing external database..."

    if ! command -v psql >/dev/null 2>&1; then
        print_error "psql not found. Install PostgreSQL client to use --init-db"
    fi

    local psql_host="$DB_HOST"
    if [[ "$psql_host" == "host.docker.internal" ]]; then
        psql_host="localhost"
    fi

    print_info "Testing database connection to ${psql_host}:${DB_PORT}..."
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$psql_host" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to database at ${psql_host}:${DB_PORT} with user ${DB_USER}"
    fi
    print_success "Database connection verified"

    print_info "Creating database ${DB_NAME} if it doesn't exist..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$psql_host" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
    print_success "Database ${DB_NAME} ready (migrations will run on backend startup)"
}

do_seed() {
    print_info "Seeding database with dummy documents and directories..."

    print_info "Waiting for backend to be ready..."
    local retries=30
    while ! curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; do
        retries=$((retries - 1))
        if [ "$retries" -le 0 ]; then
            print_error "Backend not ready after 30 attempts. Start services first with --start"
        fi
        sleep 2
    done

    (cd backend && npx ts-node src/seed-test-data.ts)

    print_success "Database seeded with dummy data"
}

do_purge_data() {
    print_warning "This will DELETE all documents, directories, tags, and pinned documents."
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        print_info "Cancelled."
        return 0
    fi

    local psql_host="$DB_HOST"
    if [[ "$psql_host" == "host.docker.internal" ]]; then
        psql_host="localhost"
    fi

    print_info "Purging all data..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$psql_host" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "TRUNCATE pinned_documents, document_tags, document_versions, documents, tags, directories CASCADE;" \
        > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        print_success "All data purged successfully"
    else
        print_error "Failed to purge data. Is the database running?"
    fi
}

do_build() {
    print_info "Building Docker images..."
    generate_env

    dc build

    print_success "Docker images built successfully"
}

do_start() {
    print_info "Building and starting services..."
    generate_env

    dc up -d --build

    resolve_urls
    print_success "Services started"
    print_info "DocBase Backend:   ${DOCBASE_BACKEND_URL}"
    print_info "DocBase Frontend:  ${DOCBASE_FRONTEND_URL}"
    print_info "Auth Backend:      ${AUTH_SERVICE_URL}"
    print_info "Auth Frontend:     ${AUTH_SERVICE_FRONTEND_URL}"
    echo ""
    print_info "Test credentials:"
    echo "  doc_admin  / Admin@123  (read + write)"
    echo "  doc_reader / Admin@123  (read only)"
    echo "  admin      / Admin@123  (all)"
}

do_stop() {
    print_info "Stopping services..."
    dc down
    print_success "Services stopped"
}

do_restart() {
    do_stop
    do_start
}

do_logs() {
    dc logs -f
}

do_status() {
    print_info "Checking service status..."
    echo ""

    dc ps 2>/dev/null || true
    echo ""

    resolve_urls
    if curl -sf "${DOCBASE_BACKEND_URL}/health" > /dev/null 2>&1; then
        print_success "DocBase Backend is running at ${DOCBASE_BACKEND_URL}"
    else
        print_warning "DocBase Backend is not responding at ${DOCBASE_BACKEND_URL}"
    fi

    if curl -sf "${DOCBASE_FRONTEND_URL}" > /dev/null 2>&1; then
        print_success "DocBase Frontend is running at ${DOCBASE_FRONTEND_URL}"
    else
        print_warning "DocBase Frontend is not responding at ${DOCBASE_FRONTEND_URL}"
    fi

    if curl -sf "${AUTH_SERVICE_URL}/health" > /dev/null 2>&1; then
        print_success "Auth Backend is running at ${AUTH_SERVICE_URL}"
    else
        print_warning "Auth Backend is not responding at ${AUTH_SERVICE_URL}"
    fi
}

do_clean() {
    print_warning "This will remove all containers, images, and volumes for document-base."
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        print_info "Cancelled."
        exit 0
    fi

    dc down -v --rmi all 2>/dev/null || true
    print_success "Cleaned up all document-base resources"
}

if [[ "$DO_BUILD" == "false" && "$DO_START" == "false" && "$DO_STOP" == "false" && \
      "$DO_RESTART" == "false" && "$DO_INIT_DB" == "false" && "$DO_SEED" == "false" && \
      "$DO_PURGE" == "false" && "$DO_LOGS" == "false" && \
      "$DO_STATUS" == "false" && "$DO_CLEAN" == "false" ]]; then
    show_help
    exit 0
fi

print_header
validate_config

[[ "$DO_CLEAN" == "true" ]] && do_clean
[[ "$DO_STOP" == "true" ]] && do_stop
[[ "$DO_INIT_DB" == "true" ]] && do_init_db

if [[ "$USE_EXTERNAL_DB" == "true" && "$DO_INIT_DB" == "false" && \
      ("$DO_START" == "true" || "$DO_BUILD" == "true" || "$DO_RESTART" == "true") ]]; then
    if command -v psql >/dev/null 2>&1; then
        local_host="$DB_HOST"
        [[ "$local_host" == "host.docker.internal" ]] && local_host="localhost"
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$local_host" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            print_warning "Database ${DB_NAME} not found on ${local_host}:${DB_PORT}, running init-db automatically..."
            do_init_db
        fi
    fi
fi

[[ "$DO_BUILD" == "true" ]] && do_build
[[ "$DO_START" == "true" ]] && do_start
[[ "$DO_PURGE" == "true" ]] && do_purge_data
[[ "$DO_SEED" == "true" ]] && do_seed
[[ "$DO_RESTART" == "true" ]] && do_restart
[[ "$DO_LOGS" == "true" ]] && do_logs
[[ "$DO_STATUS" == "true" ]] && do_status

exit 0
