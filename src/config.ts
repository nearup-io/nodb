import { fromPairs, isEmpty } from "ramda";

const { NODB_DB_CONNECTIONS } = Bun.env;
if (!NODB_DB_CONNECTIONS) {
  throw new Error("Environment variable NODB_DB_CONNECTIONS is missing!");
}
const dbConnectionNames = NODB_DB_CONNECTIONS?.split(",");
if (isEmpty(dbConnectionNames)) {
  throw new Error("Database connections are missing!");
}

export type DbType = "mongodb" | "postgres" | "mysql" | "redis";
type Config = {
  dbType: DbType;
  dbs: Record<string, string>;
  mongodb: {
    maxListeners: number;
    maxPoolSize: number;
    autoIndex: boolean;
  };
};
const DB_TYPE = Bun.env.DB_TYPE as DbType;
const pairs: [string, string][] = dbConnectionNames.map((conn) => {
  const c = Bun.env[`NODB_${conn}`];
  return [conn, `${c}`];
});
const dbsConfig = fromPairs(pairs);
const config: Config = {
  dbType: DB_TYPE || "mongodb",
  mongodb: {
    maxListeners: 1,
    maxPoolSize: 1,
    autoIndex: true,
  },
  dbs: { ...dbsConfig },
};

export default config;
