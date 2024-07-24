# nodb
Open-source API gateway for your Postgres database with RAG support, semantic search, and CRUD.

## Quick Start

1. Prerequisites:
   - [Install Bun](https://bun.sh/docs/installation)
   - PostgreSQL database (local or Docker)
   - OpenAI or Anthropic account

2. Setup:
   - Clone the repository
   - Copy `.env.example` to `.env` and configure your variables (see Environment Variables section below)

3. Install dependencies:
   ```bash
   bun install
   ```

4. Run in development:
   ```bash
   bun dev
   ```

## Environment Variables

Copy `.env.example` to `.env` and configure the following variables:


- `POSTGRES_URL`: Your PostgreSQL connection string
- `PORT`: The port on which the server will run (optional, default: 3000)
- `AI_PROVIDER`: Choose either 'openai' or 'anthropic' (default: openai)
- `LLM_NAME`: The name of the LLM model you want to use (e.g., 'gpt-3.5-turbo-0125', empty by default)
- `EMBEDDING_MODEL`: The name of the embedding model (default: text-embedding-ada-002)
- `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI as AI provider)
- `ANTHROPIC_API_KEY`: Your Anthropic API key (required if using Anthropic as AI provider)
- `VOYAGE_API_KEY`: Your Voyage API key (optional)
- `CLERK_SECRET_KEY`: Your Clerk secret key (optional, can be useful if you want to build a dedicated frontend to this API)
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key (optional, can be useful if you want to build a dedicated frontend to this API)

Note: You must have either an OpenAI or Anthropic account to use the API locally. Choose the appropriate LLM provider and set the corresponding API key.

## PostgreSQL Setup

You can find detailed instructions on how to run Postgres (locally or in Docker) [here](https://github.com/nearup-io/nodb/wiki/Postgres-database).

## Deployment

### Fly.io
For quick deployment, you can use [fly.io](https://fly.io/). Follow our [wiki page](https://github.com/nearup-io/nodb/wiki/Deployment-on-fly.io) for instructions.

## Tests

Check out our [wiki page](https://github.com/nearup-io/nodb/wiki/E2E-tests-%E2%80%90-postgres) for e2e tests.

## Contact

Email: marko@nearup.io
