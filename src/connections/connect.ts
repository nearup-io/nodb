import mongoose from "mongoose";
import config from "../config";
import mongodbConnection from "./mongodb";
import { UserSchema } from "../models/user.model";
import { ApplicationSchema } from "../models/application.model";
import { EnvironmentSchema } from "../models/environment.model";
import { EntitySchema } from "../models/entity.model";

export const addDbConnection = async (db: string) => {
  const host = new URL(config.dbs[db]).host;
  const withHost = mongoose.connections.find((conn) => conn.host === host);
  if (withHost) {
    const useDb = new URL(config.dbs[db]).pathname.slice(1);
    const conn = withHost.useDb(useDb, { useCache: true });
    return conn;
  } else {
    const connectionString = Bun.env[`NODB_${db}`]!;
    const conn = await mongodbConnection(connectionString);
    return conn;
  }
};

export const getConnection = (dbParam: string): mongoose.Connection => {
  const dbConn = config.dbs[dbParam];
  if (!dbConn) {
    throw new Error(`Database ${dbParam} is not defined`);
  }
  const host = new URL(config.dbs[dbParam]).host;
  const withHost = mongoose.connections.find((conn) => conn.host === host);
  if (!withHost) {
    throw new Error(`Database ${dbParam} is not found`);
  }
  const conn = withHost.useDb(dbParam, { useCache: true });
  conn.model('User', UserSchema);
  conn.model('Application', ApplicationSchema);
  conn.model('Environment', EnvironmentSchema);
  conn.model('Entity', EntitySchema);
  return conn;
};

export const formDbConnections = async () => {
  const dbParams = Object.keys(config.dbs);
  for (let dbparam of dbParams) {
    console.log(`Connecting ${dbparam}...`);
    await addDbConnection(dbparam);
    console.log(`Connected ${dbparam}!`);
  }
};
