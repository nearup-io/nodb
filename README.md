# nodb

Open-source API gateway for your Postgres database with RAG support, semantic search, and CRUD.

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

To run Postgres locally use docker-compose:

```bash
docker-compose -f .\docker-compose.dev.yml up postgres
```

To run the whole app in docker:
```bash
docker-compose -f .\docker-compose.dev.yml up
```

## Deploy

### Render

For quick deploy you can use Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nearup-io/nodb)

## Tests

Check out our [wiki page](https://github.com/nearup-io/nodb/wiki/E2E-tests-%E2%80%90-postgres) for e2e tests

#### Contact

1. Email: marko@nearup.io
