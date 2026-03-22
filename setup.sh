#!/bin/bash

# Document Base Setup Script
# This script sets up the document management service with configurable parameters

set -e

# Default values
DEFAULT_DB_HOST="localhost"
DEFAULT_DB_PORT="5434"
DEFAULT_DB_USER="postgres"
DEFAULT_DB_PASSWORD="postgres"
DEFAULT_DB_NAME="document_base"
DEFAULT_DB_SSL_MODE="disable"
DEFAULT_SERVER_PORT="8082"
DEFAULT_SERVER_HOST="0.0.0.0"
DEFAULT_FRONTEND_PORT="3001"
DEFAULT_AUTH_SERVICE_URL="http://localhost:8080"
DEFAULT_CLIENT_ID="document-base-clientid"
DEFAULT_CLIENT_SECRET="document-base-clientsecret"
DEFAULT_MAX_UPLOAD_SIZE="52428800"
DEFAULT_USE_EXTERNAL_DB="false"

# Current values (start with defaults)
DB_HOST="$DEFAULT_DB_HOST"
DB_PORT="$DEFAULT_DB_PORT"
DB_USER="$DEFAULT_DB_USER"
DB_PASSWORD="$DEFAULT_DB_PASSWORD"
DB_NAME="$DEFAULT_DB_NAME"
DB_SSL_MODE="$DEFAULT_DB_SSL_MODE"
SERVER_PORT="$DEFAULT_SERVER_PORT"
SERVER_HOST="$DEFAULT_SERVER_HOST"
FRONTEND_PORT="$DEFAULT_FRONTEND_PORT"
AUTH_SERVICE_URL="$DEFAULT_AUTH_SERVICE_URL"
CLIENT_ID="$DEFAULT_CLIENT_ID"
CLIENT_SECRET="$DEFAULT_CLIENT_SECRET"
MAX_UPLOAD_SIZE="$DEFAULT_MAX_UPLOAD_SIZE"
USE_EXTERNAL_DB="$DEFAULT_USE_EXTERNAL_DB"

# Actions
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

# Colors for output
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
    Database Configuration:
    --db-host HOST              Database host (default: localhost)
    --db-port PORT              Database port (default: 5434)
    --db-user USER              Database username (default: postgres)
    --db-password PASSWORD      Database password (default: postgres)
    --db-name NAME              Database name (default: document_base)
    --db-ssl-mode MODE          Database SSL mode (default: disable)
    --use-external-db           Use external database instead of Docker

    Server Configuration:
    --server-port PORT          Backend server port (default: 8082)
    --frontend-port PORT        Frontend port (default: 3001)
    --auth-service-url URL      Auth service URL (default: http://localhost:8080)

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

EXAMPLES:
    ./setup.sh --start
    ./setup.sh --build --start
    ./setup.sh --status
    ./setup.sh --start --seed
    ./setup.sh --purge-data --seed
    ./setup.sh --use-external-db --db-host localhost --init-db --start
    ./setup.sh --auth-service-url http://auth:8080 --start

DEFAULT TEST CREDENTIALS:
    doc_admin / Admin@123    (documents:read + documents:write)
    doc_reader / Admin@123   (documents:read only)
    admin / Admin@123        (all permissions)
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --db-host) DB_HOST="$2"; shift 2 ;;
        --db-port) DB_PORT="$2"; shift 2 ;;
        --db-user) DB_USER="$2"; shift 2 ;;
        --db-password) DB_PASSWORD="$2"; shift 2 ;;
        --db-name) DB_NAME="$2"; shift 2 ;;
        --db-ssl-mode) DB_SSL_MODE="$2"; shift 2 ;;
        --use-external-db) USE_EXTERNAL_DB="true"; shift ;;
        --server-port) SERVER_PORT="$2"; shift 2 ;;
        --frontend-port) FRONTEND_PORT="$2"; shift 2 ;;
        --auth-service-url) AUTH_SERVICE_URL="$2"; shift 2 ;;
        --client-id) CLIENT_ID="$2"; shift 2 ;;
        --client-secret) CLIENT_SECRET="$2"; shift 2 ;;
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

# Validate configuration
validate_config() {
    print_info "Validating configuration..."

    if ! [[ "$SERVER_PORT" =~ ^[0-9]+$ ]] || [ "$SERVER_PORT" -lt 1 ] || [ "$SERVER_PORT" -gt 65535 ]; then
        print_error "Invalid server port: $SERVER_PORT"
    fi

    if ! [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || [ "$FRONTEND_PORT" -lt 1 ] || [ "$FRONTEND_PORT" -gt 65535 ]; then
        print_error "Invalid frontend port: $FRONTEND_PORT"
    fi

    if ! [[ "$DB_PORT" =~ ^[0-9]+$ ]] || [ "$DB_PORT" -lt 1 ] || [ "$DB_PORT" -gt 65535 ]; then
        print_error "Invalid database port: $DB_PORT"
    fi

    if ! [[ "$MAX_UPLOAD_SIZE" =~ ^[0-9]+$ ]] || [ "$MAX_UPLOAD_SIZE" -lt 1 ]; then
        print_error "Invalid max upload size: $MAX_UPLOAD_SIZE"
    fi

    print_success "Configuration validated"
}

# Generate backend .env
generate_env() {
    print_info "Generating backend/.env configuration..."

    local db_host="$DB_HOST"
    if [[ "$USE_EXTERNAL_DB" == "false" ]]; then
        db_host="localhost"
    fi

    cat > backend/.env << EOF
# Database Configuration
DB_HOST=${db_host}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSL_MODE=${DB_SSL_MODE}

# Server Configuration
SERVER_PORT=${SERVER_PORT}
SERVER_HOST=${SERVER_HOST}

# Auth Service Configuration (SSO)
AUTH_SERVICE_URL=${AUTH_SERVICE_URL}
CLIENT_ID=${CLIENT_ID}
CLIENT_SECRET=${CLIENT_SECRET}

# Upload Configuration
MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE}

# Migrations
SKIP_MIGRATIONS=false
EOF

    print_success "Generated backend/.env"
}

# Docker compose with profile
dc() {
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

    # Test connection
    print_info "Testing database connection to ${DB_HOST}:${DB_PORT}..."
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to database at ${DB_HOST}:${DB_PORT} with user ${DB_USER}"
    fi
    print_success "Database connection verified"

    # Create database if it doesn't exist
    print_info "Creating database ${DB_NAME} if it doesn't exist..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
    print_success "Database ${DB_NAME} ready (migrations will run on backend startup)"
}

do_seed() {
    print_info "Seeding database with dummy documents and directories..."

    # Wait for backend to be healthy (migrations must have run)
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

    print_info "Purging all data..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
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

    print_success "Services started"
    print_info "Backend API:  http://localhost:${SERVER_PORT}"
    print_info "Frontend:     http://localhost:${FRONTEND_PORT}"
    print_info "Auth Service: ${AUTH_SERVICE_URL}"
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

    # Check backend health
    if curl -sf "http://localhost:${SERVER_PORT}/health" > /dev/null 2>&1; then
        print_success "Backend is running at http://localhost:${SERVER_PORT}"
    else
        print_warning "Backend is not responding at http://localhost:${SERVER_PORT}"
    fi

    # Check frontend
    if curl -sf "http://localhost:${FRONTEND_PORT}" > /dev/null 2>&1; then
        print_success "Frontend is running at http://localhost:${FRONTEND_PORT}"
    else
        print_warning "Frontend is not responding at http://localhost:${FRONTEND_PORT}"
    fi

    # Check auth service
    if curl -sf "${AUTH_SERVICE_URL}/health" > /dev/null 2>&1; then
        print_success "Auth service is running at ${AUTH_SERVICE_URL}"
    else
        print_warning "Auth service is not responding at ${AUTH_SERVICE_URL}"
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

# Execute actions
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

# Auto-init external DB if it doesn't exist
if [[ "$USE_EXTERNAL_DB" == "true" && "$DO_INIT_DB" == "false" && \
      ("$DO_START" == "true" || "$DO_BUILD" == "true" || "$DO_RESTART" == "true") ]]; then
    if command -v psql >/dev/null 2>&1; then
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            print_warning "Database ${DB_NAME} not found on ${DB_HOST}:${DB_PORT}, running init-db automatically..."
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
