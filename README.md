# nodb
Open-source API gateway for your Postgres database with RAG support, semantic search, and CRUD.
## Quick Start

1. Prerequisites:
   - OpenAI or Anthropic account
   - Docker

2. Setup:
   - Clone the repository
   - Copy `.env.example` to `.env` and configure your variables: 
     - `POSTGRES_URL`: Your PostgreSQL connection string
     - `PORT`: The port on which the server will run (default: 3000)
     - `AI_PROVIDER`: Choose either 'openai' or 'anthropic' (default: openai)
     - `LLM_NAME`: The name of the LLM model you want to use (default: 'gpt-4o-mini')
     - `EMBEDDING_MODEL`: The name of the embedding model (default: text-embedding-3-small)
     - `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI as AI provider)
     - `ANTHROPIC_API_KEY`: Your Anthropic API key (required if using Anthropic as AI provider)
     - `VOYAGE_API_KEY`: Your Voyage API key (required if using Anthropic as AI provider)
     - `CLERK_SECRET_KEY`: Your Clerk secret key (optional, can be useful if you want to build a dedicated frontend to this API)
     - `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key (optional, can be useful if you want to build a dedicated frontend to this API)

   Note: You must have either an OpenAI or Anthropic account to use the API locally. Choose the appropriate LLM provider and set the corresponding API key.
3. Update the embedding model length (if needed):
   
   The default embedding length is set to `1536`. If your chosen model requires a different length, you'll need to update the `prisma.schema` file by modifying the embedding line to: `embedding Unsupported("vector(YOUR_VECTOR_LENGTH_HERE)")?`. Additionally, update the      initial migration to reflect this change. (Alternatively, you can perform a global search and replace for the string "1536".)

5. Build and run the Docker container:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
The application will be available at `http://localhost:3000`.

## API Documentation:

Swagger OpenAPI documentation is available at the `/swagger` route

## PostgreSQL Setup

You can find detailed instructions on how to run Postgres (locally or in Docker) [here](https://github.com/nearup-io/nodb/wiki/Postgres-database).

## Deployment

### Fly.io
For quick deployment, you can use [fly.io](https://fly.io/). Follow our [wiki page](https://github.com/nearup-io/nodb/wiki/Deployment-on-fly.io) for instructions.

## Tests

Check out our [wiki page](https://github.com/nearup-io/nodb/wiki/E2E-tests-%E2%80%90-postgres) for e2e tests.

## Curl examples

1. Create a new application with environment:
```bash
curl -X POST http://localhost:3000/apps/myapp \
  -H "Content-Type: application/json" \
  -d '{
    "description": "some application description",
    "image": "applicationImage",
    "envName": "env-name",
    "envDescription": "environment description"
  }'
```
2. Create entities for a specific application, environment, and entity:
```bash
curl -X POST http://localhost:3000/apps/myapp/env-name/todos \
  -H "Content-Type: application/json" \
  -H "token: your-token-here" \
  -d '[
    {
      "title": "Buy groceries",
      "description": "Get milk, eggs, and bread",
      "status": "pending"
    },
    {
      "title": "Finish project report",
      "description": "Complete the quarterly project report",
      "status": "in progress"
    }
  ]'
```
3. Query your data

```bash
curl -X POST http://localhost:3000/knowledgebase/myapp/env-name \
  -H "Content-Type: application/json" \
  -H "token: your-token-here" \
  -d '{
    "query": "Which tasks have I already started in my todo list?"
  }'
```

## Contact

Email: marko@nearup.io
