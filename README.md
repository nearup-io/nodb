# nodb

Open-source API gateway for your Mongo Atlas database with RAG support, semantic search, and CRUD.

<img src="https://github.com/nearup-io/nodb/blob/main/assets/curl-todos.gif" width="600" />

Prerequisites:

1. [Install Bun](https://bun.sh/docs/installation)
2. Copy `.env.example` to your `.env` file and set your variables

To install dependencies:

```bash
bun install
```

Run in development:

```bash
bun dev
```

To run MongoDB Atlas locally use docker-compose:

```bash
docker-compose up
```

## Deploy

### Render

For quick deploy you can use Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nearup-io/nodb)

## Search Index

Before you can do a semantic search or RAG you must create vector search index for your database. You can follow [here](https://www.mongodb.com/docs/atlas/atlas-vector-search/create-index/#procedure) how to create it. In the field where you define the index please use the following:

```json
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "type",
      "type": "filter"
    },
    {
      "path": "model",
      "type": "filter"
    }
  ]
}
```

`numDimensions` can be any number which depends on the dimension of the embedding vector model you want to use.

## Tests

Create `.env.test` file with the following content:

```
MONGODB_URL=...your url here...
JWT_SECRET=...your secret here...
```

Then run:

```bash
bun e2e-tests
```

#### Contact

1. Discord: https://discord.gg/QBGH49Bcp7
2. Email: hi@nodb.sh
