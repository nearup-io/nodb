import { Hono } from "hono";
import { logger } from "hono/logger";
import initDbConnection from "./connections/initDbConnection.ts";
import { cors } from "hono/cors";
import { clerkMiddleware } from "@hono/clerk-auth";
import { contextMiddleware } from "./middlewares";
import usersRoute from "./routes/users.ts";
import appsRoute from "./routes/applications.ts";
import searchRoute from "./routes/search.ts";
import ragRoute from "./routes/rag.ts";

export const startApp = async (props?: {
  postgresDatabaseUrl?: string;
}): Promise<{
  app: Hono;
  stopApp: () => Promise<void>;
}> => {
  const app = new Hono();
  if (Bun.env.NODE_ENV === "development") {
    app.use(logger());
  }

  const db = await initDbConnection(props);
  await db.$connect();
  console.log("connected to database");
  app.use(
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
    }),
  );
  app.use("*", clerkMiddleware());
  app.use(contextMiddleware(db));

  app.route("/users", usersRoute);

  app.route("/apps", appsRoute);
  app.use();
  app.route("/search", searchRoute);
  app.route("/knowledgebase", ragRoute);
  // app.route("/tokens");

  return {
    app,
    stopApp: async () => {
      await db.$disconnect();
      console.log("Disconnected from app database");
    },
  };
};
