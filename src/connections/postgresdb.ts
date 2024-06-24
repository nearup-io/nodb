import { PrismaClient } from "@prisma/client";

const createPrismaClient = async (databaseUrl: string) => {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
  });
};
export default createPrismaClient;
