import prisma from "./postgresdb.ts";
import mongoConnect from "./mongodb.ts";
import type { PrismaClient } from "@prisma/client";

async function initDbConnection(): Promise<PrismaClient | undefined> {
  if (Bun.env.database === "postgres") {
    return prisma;
  } else {
    await mongoConnect();
  }
}

export default initDbConnection;
