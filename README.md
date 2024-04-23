# nodb

Open-source API gateway for your Mongo Atlas database with RAG support, semantic search, auth and CRUD.

Prerequisites:

1. [Install Bun](https://bun.sh/docs/installation)
2. Copy `.env.example` to your `.env` file and set your variables

To install dependencies:

```bash
bun install
```

To run:

```bash
bun start
```

## Deploy

### Render

For quick deploy you can use Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nearup-io/nodb)

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
