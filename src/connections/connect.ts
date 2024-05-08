import mongoose from "mongoose";
import config from "../config";
import {
  type Application,
  ApplicationSchema,
} from "../models/application.model";
import { type Entity, EntitySchema } from "../models/entity.model";
import {
  type Environment,
  EnvironmentSchema,
} from "../models/environment.model";
import { type User, UserSchema } from "../models/user.model";
import mongodbConnection from "./mongodb";
import { ConnectionError } from "../utils/service-errors";
import * as R from "ramda";

export const addDbConnection = async (db: string) => {
  const connectionString = Bun.env[`NODB_${db}`]!;
  const conn = await mongodbConnection(connectionString);
  conn.model("User", UserSchema);
  conn.model("Application", ApplicationSchema);
  conn.model("Environment", EnvironmentSchema);
  conn.model("Entity", EntitySchema);
  return conn;
};

export const getConnection = (dbParam: string): mongoose.Connection => {
  const dbConn = config.dbs[dbParam];
  if (!dbConn) {
    throw new ConnectionError(`Database "${dbParam}" is not defined`);
  }
  const host = R.drop(1, new URL(dbConn).host.split(".")).join(".");
  const dbPath = new URL(dbConn).pathname.slice(1);
  if (!dbPath) {
    throw new ConnectionError(`Database name is missing for ${dbParam}`);
  }
  const withHost = mongoose.connections.find((conn) =>
    conn.host?.includes(host),
  );
  if (!withHost) {
    throw new ConnectionError(`Database ${dbParam} is not found`);
  }
  const conn = withHost.useDb(dbPath, { useCache: true });
  const models = conn.modelNames();
  if (!models.includes("User")) conn.model("User", UserSchema);
  if (!models.includes("Application"))
    conn.model("Application", ApplicationSchema);
  if (!models.includes("Environment"))
    conn.model("Environment", EnvironmentSchema);
  if (!models.includes("Entity")) conn.model("Entity", EntitySchema);
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

export const getUserModel = (conn: mongoose.Connection) =>
  conn.model<User>("User");

export const getApplicationModel = (conn: mongoose.Connection) =>
  conn.model<Application>("Application");

export const getEnvironmentModel = (conn: mongoose.Connection) =>
  conn.model<Environment>("Environment");

export const getEntityModel = (conn: mongoose.Connection) =>
  conn.model<Entity>("Entity");
