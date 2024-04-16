FROM oven/bun:latest

WORKDIR /usr/src/app

COPY package*.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .

ENV NODE_ENV production

CMD ["bun", "run", "app.ts"]