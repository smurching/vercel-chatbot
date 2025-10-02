<a href="https://docs.databricks.com/aws/en/generative-ai/agent-framework/chat-app">
  <h1 align="center">Databricks Agent Chat Template</h1>
</a>

<p align="center">
    A chat application template for interacting with Databricks Agent Serving endpoints, built with Next.js, Vercel AI SDK, and Databricks authentication.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>
<br/>


This template is based on the [Vercel AI Chatbot](https://github.com/vercel/ai-chatbot) with Databricks-specific integrations for agents/LLMs, authentication, and conversation history persistence.
For general features and additional documentation, see the [original repository](https://github.com/vercel/ai-chatbot/blob/main/README.md).

**NOTE: this template is fully functional, but missing some of the


## Key Databricks Features

- **Databricks Agent and Foundation Model Integration**: Direct connection to Databricks Agent and Foundation Model serving endpoints
- **Databricks Authentication**: Uses Databricks authentication to identify end users of the chat app and securely manage their conversations.
- **Persistent Chat History**: Leverages Databricks Lakebase (Postgres) for storing conversations, with governance and tight lakehouse integration.

## Prerequisites

1. **Databricks workspace access**
2. **Create a database instance**:
   - [Create a lakebase instance](https://docs.databricks.com/aws/en/oltp/instances/create/) for persisting chat history.
3. **Set up Databricks authentication**
   - Install the [Databricks CLI](https://docs.databricks.com/en/dev-tools/cli/install.html)
   - Run `databricks auth login [--profile name]` to configure authentication for your workspace, optionally under a named profile
   - Set the `DATABRICKS_CONFIG_PROFILE` environment variable to the name of the profile you created, or set it to "DEFAULT" if you didn't specify any profile name.

## Deployment

### Using Databricks Asset Bundles (Recommended)

This project includes a Databricks Asset Bundle (DAB) configuration that simplifies deployment by automatically creating and managing all required resources.

#### Prerequisites

1. **Databricks CLI**: Version 0.269.0 or higher
   ```bash
   databricks --version
   ```

2. **Authentication**: Set up your Databricks workspace credentials
   ```bash
   export DATABRICKS_HOST="https://your-workspace.cloud.databricks.com"
   export DATABRICKS_TOKEN="your-access-token"
   ```

3. **Model Serving Endpoint**: Create a serving endpoint in your Databricks workspace before deployment

#### Deploy with Databricks Asset Bundles

1. **Validate the bundle configuration**:
   ```bash
   databricks bundle validate -t dev --var serving_endpoint_name="your-serving-endpoint-name"
   ```

2. **Deploy the bundle** (creates Lakebase instance, database catalog, and app):
   ```bash
   databricks bundle deploy -t dev --var serving_endpoint_name="your-serving-endpoint-name"
   ```

   This creates:
   - **Lakebase database instance** with PostgreSQL native login
   - **Database catalog** registered in Unity Catalog
   - **App resource** ready to start

3. **View deployment summary**:
   ```bash
   databricks bundle summary -t dev
   ```

4. **Start the app**:
   ```bash
   databricks bundle run vercel_chatbot -t dev
   ```

#### Deployment Targets

The bundle supports multiple environments:

- **dev** (default): Development environment
- **staging**: Staging environment for testing
- **prod**: Production environment

To deploy to a specific target:
```bash
databricks bundle deploy -t staging --var serving_endpoint_name="your-endpoint"
```

#### Configuration

The bundle is configured in `databricks.yml` with these key components:

- **Database Instance**: Automatically provisions a Lakebase instance with configurable capacity
- **Database Catalog**: Registers the database in Unity Catalog for governance
- **App**: Deploys the chatbot application with access to the serving endpoint

### Manual Deployment (Alternative)

If you prefer manual deployment without bundles:

Set environment variables to specify the agent serving endpoint and database instance:

```bash
export SERVING_ENDPOINT="your-serving-endpoint-name"
export DATABASE_INSTANCE="your-database-instance-name"
```

Then, create the app:
```bash
databricks apps create --json '{
  "name": "my-agent-chatbot",
  "resources": [
    {
      "name": "serving-endpoint",
      "serving_endpoint": {
        "name": "'"$SERVING_ENDPOINT"'",
        "permission": "CAN_QUERY"
      }
    },
    {
        "name": "database",
        "database": {
            "instance_name": "'"$DATABASE_INSTANCE"'",
            "database_name": "databricks_postgres",
            "permission": "CAN_CONNECT_AND_CREATE"
         }
     }
  ]
}'
```

Upload the source code and deploy:

```bash
DATABRICKS_USERNAME=$(databricks current-user me | jq -r .userName)
databricks sync . "/Users/$DATABRICKS_USERNAME/e2e-chatbot-app"
databricks apps deploy my-agent-chatbot --source-code-path "/Workspace/Users/$DATABRICKS_USERNAME/e2e-chatbot-app"
```

## Running Locally

Before running the app locally, you should first deploy the app to Databricks following the steps 
in [Deployment](#deployment). This is the simplest way to get the required database instance set up with the correct permissions,
so that both you and your app service principal can connect to the database.


### Setup Steps

1. **Clone and install**:
   ```bash
   git clone https://github.com/databricks/app-templates
   cd e2e-chatbot-app
   pnpm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your credentials

3. **Run the application**:
   ```bash
   npm run dev
   ```

   Or using pnpm:
   ```bash
   pnpm dev
   ```

   The app starts on [localhost:3000](http://localhost:3000)

## Known limitations
* This chat app only supports the following Databricks serving endpoint types (Foundation Model API endpoints are not supported):
  * Custom code agents that implement the ResponsesAgent interface and support streaming output via `predict_stream`. This covers any agent built following the [recommended approach](https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent) for authoring agents.
  * Agent Bricks endpoints
* The following advanced output rendering features supported from within Databricks product UIs are not supported in this app:
  * Oauth tool call confirmation 
* Limited support for surfacing internal errors to users while generating streaming and non-streaming agent output
* Foundation models - using OpenAI provider, it sends an extra arg like stream_options.include_usage, FMAPI breaks on extra parameters
* When deployed, the chat app assumes it has access to an isolated database instance, and in particular that it is the owner of
  the `ai_chatbot` schema. If you'd like to share a database instance across chatbot apps (using different schemas to isolate the chat apps),
  update references to the `ai_chatbot` schema in the codebase, rerun `npm run drizzle-kit:generate` to regenerate database migrations, and then
* 
* No support for custom_inputs/custom_outputs
* No support for image/multi-modal inputs
* We assume one database per app (can’t share a database across apps without creating a new schema in the database)
* The most common and officially recommended authentication methods for Databricks are supported: Databricks CLI auth for local development, and Databricks service principal auth for deployed apps) 
  * subset of Databricks authentication methods are supported
* Streams are cached in memory, may not scale for very large #s of users.
* 
