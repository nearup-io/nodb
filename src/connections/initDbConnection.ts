import createPrismaClient from "./postgresdb.ts";
import mongoConnect from "./mongodb.ts";
import type { PrismaClient } from "@prisma/client";

async function initDbConnection(props?: {
  postgresDatabaseUrl?: string;
}): Promise<PrismaClient | undefined> {
  if (!!props?.postgresDatabaseUrl || !!Bun.env.POSTGRES_URL) {
    return createPrismaClient(
      props?.postgresDatabaseUrl ?? Bun.env.POSTGRES_URL!,
    );
  } else {
    await mongoConnect();
  }
}

export default initDbConnection;
