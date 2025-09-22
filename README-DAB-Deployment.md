# Databricks Asset Bundle (DAB) Deployment Guide

This guide explains how to deploy the Vercel Chatbot application using Databricks Asset Bundles with a Lakebase database backend.

## Architecture Overview

The deployment includes:
- **Lakebase Database Instance**: PostgreSQL-compatible database with native login
- **Database Catalog**: Unity Catalog registration for the database
- **Databricks App**: The Node.js chatbot application
- **Model Serving Endpoint**: External endpoint (created separately)

## Prerequisites

1. **Databricks CLI**: Version 0.250.0 or higher
   ```bash
   databricks -v
   ```

2. **Environment Variables**: Set up authentication
   ```bash
   export DATABRICKS_HOST="your-workspace-url"
   export DATABRICKS_TOKEN="your-access-token"
   ```

3. **Python Dependencies**: For database setup scripts
   ```bash
   pip install psycopg2-binary databricks-sdk
   ```

4. **Model Serving Endpoint**: Create this manually in Databricks workspace before deployment

## Deployment Options

### Option 1: Automated Deployment (Recommended)

Use the provided deployment script for a streamlined experience:

```bash
./scripts/deploy.sh \
  --target dev \
  --serving-endpoint "agents_ml-bbqiu-annotationsv2" \
  --db-admin-user "admin" \
  --db-admin-pass "your-admin-password" \
  --role-pass "your-app-role-password"
```

**Parameters:**
- `--target`: Deployment environment (`dev`, `staging`, `prod`)
- `--serving-endpoint`: Name of your model serving endpoint
- `--db-admin-user`: Database admin username (for role creation)
- `--db-admin-pass`: Database admin password
- `--role-pass`: Password for the application database role

### Option 2: Manual Step-by-Step Deployment

#### Step 1: Validate Bundle Configuration

```bash
databricks bundle validate -t dev --var serving_endpoint_name="agents_ml-bbqiu-annotationsv2"
```

#### Step 2: Deploy Database Infrastructure

```bash
databricks bundle deploy -t dev --var serving_endpoint_name="agents_ml-bbqiu-annotationsv2"
```

This creates:
- Lakebase database instance (`chatbot-lakebase-dev`)
- Database catalog (`chatbot_catalog_dev`)
- Database (`chatbot_db`)

#### Step 3: Set Up Database Role

Get the database instance connection info and create an application role:

```bash
python3 scripts/setup-database-role.py \
  --instance-name "chatbot-lakebase-dev" \
  --admin-username "admin" \
  --admin-password "your-admin-password" \
  --role-name "app_migrator" \
  --role-password "your-app-role-password"
```

The script will output a PostgreSQL connection string like:
```
postgresql://app_migrator:your-app-role-password@hostname:port/chatbot_db
```

#### Step 4: Update Secrets

Store the database connection string in Databricks secrets:

```bash
# Create or update the secret scope if needed
databricks secrets create-scope --scope "your-scope"

# Store the postgres URL
databricks secrets put --scope "your-scope" --key "postgres-url-secret" --string-value "postgresql://app_migrator:password@host:port/chatbot_db"
```

#### Step 5: Deploy the Application

```bash
databricks bundle deploy -t dev --var serving_endpoint_name="agents_ml-bbqiu-annotationsv2"
```

#### Step 6: Start the Application

```bash
databricks bundle run vercel_chatbot -t dev
```

## Configuration

### Bundle Variables

The `databricks.yml` supports these variables:

- `serving_endpoint_name`: Name of the model serving endpoint
- `database_instance_name`: Name of the Lakebase instance (auto-generated per target)

### Deployment Targets

- **dev**: Development environment with `CU_1` capacity
- **staging**: Staging environment for testing
- **prod**: Production environment

### Environment Variables in app.yaml

The application expects these environment variables:

- `POSTGRES_URL`: Database connection string (from secrets)
- `DATABRICKS_SERVING_ENDPOINT`: Serving endpoint name (from resources)
- `AUTH_SECRET`: Authentication secret (from secrets)
- `DATABRICKS_TOKEN`: Databricks access token (from secrets)

## Database Role Permissions

The deployment script creates an `app_migrator` role with these permissions:

- `CONNECT` on the database
- `CREATE` on the database and public schema
- `ALL PRIVILEGES` on tables and sequences
- Default privileges for future objects

These permissions allow the application to:
- Run database migrations
- Create and modify tables
- Insert, update, and delete data

## Troubleshooting

### Bundle Validation Errors

```bash
# Check bundle syntax
databricks bundle validate -t dev

# View detailed bundle configuration
databricks bundle summary -t dev
```

### Database Connection Issues

1. Verify the database instance is running:
   ```bash
   databricks workspace list-database-instances
   ```

2. Check connection info:
   ```bash
   databricks workspace get-database-instance-connection-info "chatbot-lakebase-dev"
   ```

3. Test database connectivity:
   ```bash
   python3 -c "
   import psycopg2
   conn = psycopg2.connect('your-connection-string')
   print('Connection successful')
   conn.close()
   "
   ```

### App Deployment Issues

1. Check app status:
   ```bash
   databricks bundle summary -t dev
   ```

2. View app logs:
   ```bash
   databricks apps logs vercel-chatbot-dev
   ```

3. Restart the app:
   ```bash
   databricks bundle run vercel_chatbot -t dev
   ```

## Security Considerations

1. **Database Passwords**: Use strong passwords and store them securely
2. **Network Access**: Lakebase instances are VPC-isolated by default
3. **Role Permissions**: The app role has minimal required permissions
4. **Secrets Management**: Use Databricks secrets for sensitive data

## Monitoring and Maintenance

1. **Database Monitoring**: Monitor instance health in Databricks workspace
2. **App Monitoring**: Check app metrics and logs regularly
3. **Backup Strategy**: Configure backup retention as needed
4. **Updates**: Use `databricks bundle deploy` to update configurations

## Cost Optimization

- **Development**: Use `CU_1` instances for lower costs
- **Production**: Scale up instance capacity based on load
- **Auto-termination**: Not applicable to Lakebase instances (always running)
- **Resource Tagging**: Use bundle tags for cost tracking

## Support

For issues with:
- **Bundle deployment**: Check Databricks CLI documentation
- **Lakebase instances**: Contact Databricks support
- **App configuration**: Review app.yaml and environment variables