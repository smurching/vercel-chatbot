#!/usr/bin/env python3
"""
Script to create a database role with sufficient permissions for running database migrations.
This script should be run after the Lakebase instance is created but before deploying the app.
"""

import os
import sys
import argparse
import psycopg2
from urllib.parse import urlparse
from databricks.sdk import WorkspaceClient


def get_database_connection_info(instance_name):
    """Get database connection information from Databricks"""
    w = WorkspaceClient()

    try:
        # Get the database instance
        instances = w.database.list_database_instances()
        instance = None
        for inst in instances:
            if inst.name == instance_name:
                instance = inst
                break

        if not instance:
            raise ValueError(f"Database instance '{instance_name}' not found")

        # Get connection info
        connection_info = w.database.get_database_instance_connection_info(instance.name)

        return {
            'host': connection_info.host,
            'port': connection_info.port,
            'database': 'chatbot_db'  # Default database name from databricks.yml
        }
    except Exception as e:
        print(f"Error getting database connection info: {e}")
        sys.exit(1)


def create_database_role(connection_info, admin_username, admin_password, role_name, role_password):
    """Create a database role with migration permissions"""

    try:
        # Connect as admin user
        conn = psycopg2.connect(
            host=connection_info['host'],
            port=connection_info['port'],
            database=connection_info['database'],
            user=admin_username,
            password=admin_password
        )
        conn.autocommit = True
        cursor = conn.cursor()

        # Check if role exists
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role_name,))
        if cursor.fetchone():
            print(f"Role '{role_name}' already exists, updating password...")
            cursor.execute(f"ALTER ROLE {role_name} WITH PASSWORD %s", (role_password,))
        else:
            print(f"Creating role '{role_name}'...")
            cursor.execute(f"CREATE ROLE {role_name} WITH LOGIN PASSWORD %s", (role_password,))

        # Grant necessary permissions for migrations
        print(f"Granting permissions to '{role_name}'...")
        cursor.execute(f"GRANT CONNECT ON DATABASE {connection_info['database']} TO {role_name}")
        cursor.execute(f"GRANT CREATE ON DATABASE {connection_info['database']} TO {role_name}")
        cursor.execute(f"GRANT USAGE ON SCHEMA public TO {role_name}")
        cursor.execute(f"GRANT CREATE ON SCHEMA public TO {role_name}")
        cursor.execute(f"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO {role_name}")
        cursor.execute(f"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO {role_name}")
        cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {role_name}")
        cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {role_name}")

        print(f"Successfully created/updated role '{role_name}' with migration permissions")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Error creating database role: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Setup database role for migrations')
    parser.add_argument('--instance-name', required=True, help='Name of the Lakebase database instance')
    parser.add_argument('--admin-username', required=True, help='Admin username for database')
    parser.add_argument('--admin-password', required=True, help='Admin password for database')
    parser.add_argument('--role-name', default='app_migrator', help='Name of the role to create (default: app_migrator)')
    parser.add_argument('--role-password', required=True, help='Password for the new role')

    args = parser.parse_args()

    print(f"Setting up database role for instance: {args.instance_name}")

    # Get database connection info from Databricks
    connection_info = get_database_connection_info(args.instance_name)
    print(f"Connected to database at {connection_info['host']}:{connection_info['port']}")

    # Create the database role
    create_database_role(
        connection_info,
        args.admin_username,
        args.admin_password,
        args.role_name,
        args.role_password
    )

    # Print connection string for the new role
    postgres_url = f"postgresql://{args.role_name}:{args.role_password}@{connection_info['host']}:{connection_info['port']}/{connection_info['database']}"
    print(f"\nConnection string for the app:")
    print(f"POSTGRES_URL={postgres_url}")
    print(f"\nPlease store this connection string in your secrets management system.")


if __name__ == "__main__":
    main()