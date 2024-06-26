import createPrismaClient from "./postgresdb.ts";
import type { PrismaClient } from "@prisma/client";

async function initDbConnection(props?: {
  postgresDatabaseUrl?: string;
}): Promise<PrismaClient> {
  if (!!props?.postgresDatabaseUrl || !!Bun.env.POSTGRES_URL) {
    return createPrismaClient(
      props?.postgresDatabaseUrl ?? Bun.env.POSTGRES_URL!,
    );
  }
  throw new Error("POSTGRES URL MISSING");
}

export default initDbConnection;
