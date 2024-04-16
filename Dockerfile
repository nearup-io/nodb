FROM oven/bun:1

WORKDIR /src
COPY package.json bun.lockb /src/
RUN bun install --frozen-lockfile

COPY . /src

USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "app.ts" ]