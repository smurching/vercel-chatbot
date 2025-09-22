#!/bin/bash

# Deployment script for Vercel Chatbot with Databricks Asset Bundle
set -e

# Default values
TARGET="dev"
SERVING_ENDPOINT=""
DB_ADMIN_USER=""
DB_ADMIN_PASS=""
ROLE_NAME="app_migrator"
ROLE_PASS=""
SKIP_DB_SETUP=false

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -t, --target TARGET              Deployment target (dev, staging, prod) [default: dev]"
    echo "  -e, --serving-endpoint ENDPOINT  Name of the serving endpoint"
    echo "  --db-admin-user USER            Database admin username"
    echo "  --db-admin-pass PASS            Database admin password"
    echo "  --role-name NAME                App database role name [default: app_migrator]"
    echo "  --role-pass PASS                App database role password"
    echo "  --skip-db-setup                 Skip database role setup"
    echo "  -h, --help                      Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -t dev -e agents_ml-bbqiu-annotationsv2 --db-admin-user admin --db-admin-pass mypass --role-pass rolepass"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -e|--serving-endpoint)
            SERVING_ENDPOINT="$2"
            shift 2
            ;;
        --db-admin-user)
            DB_ADMIN_USER="$2"
            shift 2
            ;;
        --db-admin-pass)
            DB_ADMIN_PASS="$2"
            shift 2
            ;;
        --role-name)
            ROLE_NAME="$2"
            shift 2
            ;;
        --role-pass)
            ROLE_PASS="$2"
            shift 2
            ;;
        --skip-db-setup)
            SKIP_DB_SETUP=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$SERVING_ENDPOINT" ]]; then
    log_error "Serving endpoint name is required. Use -e or --serving-endpoint"
    exit 1
fi

if [[ "$SKIP_DB_SETUP" = false ]]; then
    if [[ -z "$DB_ADMIN_USER" || -z "$DB_ADMIN_PASS" || -z "$ROLE_PASS" ]]; then
        log_error "Database setup requires --db-admin-user, --db-admin-pass, and --role-pass"
        log_info "Or use --skip-db-setup to skip database role creation"
        exit 1
    fi
fi

log_info "Starting deployment for target: $TARGET"

# Step 1: Validate bundle configuration
log_info "Validating bundle configuration..."
databricks bundle validate -t "$TARGET" --var serving_endpoint_name="$SERVING_ENDPOINT"

# Step 2: Deploy bundle (database instance and catalog)
log_info "Deploying Databricks bundle (database instance and catalog)..."
databricks bundle deploy -t "$TARGET" --var serving_endpoint_name="$SERVING_ENDPOINT"

# Step 3: Set up database role (if not skipped)
if [[ "$SKIP_DB_SETUP" = false ]]; then
    log_info "Setting up database role..."

    # Get the instance name from the bundle
    INSTANCE_NAME=$(databricks bundle summary -t "$TARGET" --output json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for resource in data.get('resources', {}).get('database_instances', {}).values():
    print(resource['name'])
    break
")

    if [[ -z "$INSTANCE_NAME" ]]; then
        log_error "Could not determine database instance name from bundle"
        exit 1
    fi

    log_info "Using database instance: $INSTANCE_NAME"

    # Run the database setup script
    python3 scripts/setup-database-role.py \
        --instance-name "$INSTANCE_NAME" \
        --admin-username "$DB_ADMIN_USER" \
        --admin-password "$DB_ADMIN_PASS" \
        --role-name "$ROLE_NAME" \
        --role-password "$ROLE_PASS"

    log_warn "Please update your 'postgres-url-secret' with the connection string printed above"
else
    log_warn "Skipping database role setup. Make sure your database role and secrets are configured correctly."
fi

# Step 4: Deploy the app
log_info "Deploying the application..."
databricks bundle deploy -t "$TARGET" --var serving_endpoint_name="$SERVING_ENDPOINT"

# Step 5: Show deployment summary
log_info "Deployment completed successfully!"
echo ""
databricks bundle summary -t "$TARGET"

log_info "Next steps:"
echo "1. Update your secrets in Databricks with the database connection string"
echo "2. Start the app: databricks bundle run vercel_chatbot -t $TARGET"
echo "3. Check the app status in the Databricks workspace"