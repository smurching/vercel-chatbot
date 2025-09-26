<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chat SDK</h1>
</a>

<p align="center">
    Chat SDK is a free, open-source template built with Next.js and the AI SDK that helps you quickly build powerful chatbot applications.
</p>

<p align="center">
  <a href="https://chat-sdk.dev"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://ai-sdk.dev/docs/introduction)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports xAI (default), OpenAI, Fireworks, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [PostgreSQL](https://www.postgresql.org/) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage (optional)
- [Databricks Authentication](https://docs.databricks.com/en/dev-tools/auth/oauth-m2m.html)
  - OAuth-based authentication with your Databricks workspace
  - No password management required

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface. The default configuration includes [xAI](https://x.ai) models (`grok-2-vision-1212`, `grok-3-mini`) routed through the gateway.

### AI Gateway Authentication

**For Vercel deployments**: Authentication is handled automatically via OIDC tokens.

**For non-Vercel deployments**: You need to provide an AI Gateway API key by setting the `AI_GATEWAY_API_KEY` environment variable in your `.env.local` file.

With the [AI SDK](https://ai-sdk.dev/docs/introduction), you can also switch to direct LLM providers like [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://ai-sdk.dev/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of the Next.js AI Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot&env=AUTH_SECRET&envDescription=Generate%20a%20random%20secret%20to%20use%20for%20authentication&envLink=https%3A%2F%2Fgenerate-secret.vercel.app%2F32&project-name=my-awesome-chatbot&repository-name=my-awesome-chatbot&demo-title=AI%20Chatbot&demo-description=An%20Open-Source%20AI%20Chatbot%20Template%20Built%20With%20Next.js%20and%20the%20AI%20SDK%20by%20Vercel&demo-url=https%3A%2F%2Fchat.vercel.ai&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22blob%22%7D%5D)

## Running locally

### Quick Start (3 steps)

1. **Clone and install**:
   ```bash
   git clone https://github.com/your-repo/databricks-chatbot
   cd databricks-chatbot
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and set these **required** variables:
   ```env
   # Databricks workspace
   DATABRICKS_HOST=your-workspace.cloud.databricks.com

   # Databricks authentication (choose one option)
   # Option 1: OAuth credentials (recommended)
   DATABRICKS_CLIENT_ID=your-oauth-client-id
   DATABRICKS_CLIENT_SECRET=your-oauth-client-secret

   # Option 2: Personal Access Token (alternative)
   # DATABRICKS_TOKEN=your-personal-access-token

   # PostgreSQL database (choose one option)
   # Option 1: Individual variables (recommended for OAuth)
   PGHOST=your-postgres-host
   PGDATABASE=your-database-name
   PGUSER=your-username
   PGPORT=5432

   # Option 2: Connection string (alternative)
   # POSTGRES_URL=postgresql://username:password@host:port/database
   ```

3. **Run the application**:
   ```bash
   npm run dev
   ```

The app will automatically:
- Create the database schema (`ai_chatbot`)
- Run all necessary migrations
- Start on [localhost:8000](http://localhost:8000)

### Prerequisites

- **Databricks workspace** with OAuth app configured ([setup guide](https://docs.databricks.com/en/dev-tools/auth/oauth-m2m.html))
- **PostgreSQL database** (local, cloud, or managed service)

### Optional Features

Add these environment variables for additional features:
- `AI_GATEWAY_API_KEY`: For non-Vercel deployments
- `BLOB_READ_WRITE_TOKEN`: For file upload capabilities
- `REDIS_URL`: For resumable streaming

> **Note**: PGPASSWORD is not needed - it's automatically managed via OAuth token exchange.
