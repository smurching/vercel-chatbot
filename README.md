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

This template is based on the [Vercel AI Chatbot](https://github.com/vercel/ai-chatbot) with Databricks-specific integrations. For general features and additional documentation, see the [original repository](https://github.com/vercel/ai-chatbot/blob/main/README.md).

## Key Databricks Features

- **Databricks Agent Integration**: Direct connection to Databricks Agent Serving endpoints
- **Databricks Authentication**: Uses Databricks authentication to identify end users of the chat app and securely manage their conversations.
- **Persistent Chat History**: Leverages Databricks Lakebase (Postgres) for storing conversations, with governance and tight lakehouse integration.

## Running Locally

### Prerequisites

1. **Databricks workspace** with OAuth M2M app configured
2. **PostgreSQL database**: [create a lakebase instance](https://docs.databricks.com/aws/en/oltp/instances/create/)
3. **Databricks credentials** for querying serving endpoints and connecting to the database instance. 

### Setup Steps

1. **Clone and install**:
   ```bash
   git clone https://github.com/your-repo/databricks-agent-chat
   cd databricks-agent-chat
   pnpm install
   ```

2. **Configure Databricks Service Principal**:

   Create a service principal in your Databricks workspace:
   - Go to Settings → Developer → OAuth Apps
   - Create a new OAuth application
   - Note down the `Client ID` and `Client Secret`
   - See [Databricks OAuth guide](https://docs.databricks.com/en/dev-tools/auth/oauth-m2m.html) for detailed steps

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your credentials:
   ```env
   # Required: Databricks workspace
   DATABRICKS_HOST=your-workspace.cloud.databricks.com
   DATABRICKS_CLIENT_ID=your-oauth-client-id
   DATABRICKS_CLIENT_SECRET=your-oauth-client-secret

   # Required: PostgreSQL database
   PGHOST=your-postgres-host
   PGDATABASE=your-database-name
   PGUSER=your-username
   PGPORT=5432

   # Optional: Additional features
   AI_GATEWAY_API_KEY=your-api-key  # For non-Vercel deployments
   BLOB_READ_WRITE_TOKEN=****       # For file uploads
   REDIS_URL=****                   # For resumable streams
   ```

4. **Run the application**:
   ```bash
   npm run dev
   ```

   Or using pnpm:
   ```bash
   pnpm dev
   ```

   The app starts on [localhost:3000](http://localhost:3000) and automatically:
   - Creates the database schema (`ai_chatbot`)
   - Runs all necessary migrations
   - Sets up OAuth token management

### Development Mode Caveats

**Important**: In development mode (`npm run dev`), conversations are stored on behalf of the **service principal**, not individual users. This means:

- All chat history is associated with the service principal account
- Multiple developers sharing the same service principal will see each other's conversations
- User authentication in dev mode uses the system username (e.g., your local machine username)

For production deployments, user authentication works properly with individual Databricks user accounts.

### Authentication Notes

Out of the box, this app supports a subset of Databricks unified auth. In particular, the following auth mechanisms are supported:
- **OAuth M2M**: you can set `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` to authenticate using service principal credentials to the database instance and serving endpoints
- **PAT**: you can use `DATABRICKS_HOST` and `DATABRICKS_TOKEN` to authenticate using a personal access token


## Deployment

This template can be deployed to Databricks Apps or other platforms. Database migrations run automatically at build time via the `npm run build` script.
