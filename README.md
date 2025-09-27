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

## Key Databricks Features

- **Databricks Agent and Foundation Model Integration**: Direct connection to Databricks Agent and Foundation Model serving endpoints
- **Databricks Authentication**: Uses Databricks authentication to identify end users of the chat app and securely manage their conversations.
- **Persistent Chat History**: Leverages Databricks Lakebase (Postgres) for storing conversations, with governance and tight lakehouse integration.

## Running Locally

### Prerequisites

1. **Databricks workspace**
2. **PostgreSQL database**: [create a lakebase instance](https://docs.databricks.com/aws/en/oltp/instances/create/) for persisting chat history.
3. **Databricks credentials (for local development)**: [set up Databricks credentials](#running-locally) to enable querying serving endpoints and connecting to the database instance. 

### Setup Steps

1. **Clone and install**:
   ```bash
   git clone https://github.com/databricks/app-templates
   cd e2e-chatbot-app
   pnpm install
   ```

2. **Configure Databricks Authentication**:

   - Install the [Databricks CLI](https://docs.databricks.com/en/dev-tools/cli/install.html)
   - Run `databricks auth login [--profile name]` to configure authentication for your workspace, optionally under a named profile
   - Set the `DATABRICKS_CONFIG_PROFILE` environment variable to the name of the profile you created, or set it to "DEFAULT" if you didn't specify any profile name.


3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your credentials

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

### Authentication Notes

Out of the box, this app supports a subset of Databricks unified auth. In particular, the following auth mechanisms are supported:
- **OAuth M2M**: you can set `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` to authenticate using service principal credentials to the database instance and serving endpoints
- **PAT**: you can use `DATABRICKS_HOST` and `DATABRICKS_TOKEN` to authenticate using a personal access token


## Deployment

This template can be deployed to Databricks Apps or other platforms. Database migrations run automatically at build time via the `npm run build` script.
