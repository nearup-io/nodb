import { Hono } from "hono";
import { logger } from "hono/logger";
import initDbConnection from "./connections/initDbConnection.ts";
import { cors } from "hono/cors";
import { clerkMiddleware } from "@hono/clerk-auth";
import contextMiddleware from "./middlewares/context.middleware.ts";
import usersRoute from "./routes/users.ts";
import authMiddleware from "./middlewares/auth.middleware.ts";
import appsRoute from "./routes/applications.ts";
import searchRoute from "./routes/search.ts";
import ragRoute from "./routes/rag.ts";

export const startApp = async (): Promise<Hono> => {
  const app = new Hono();
  if (Bun.env.NODE_ENV === "development") {
    app.use(logger());
  }

  const db = await initDbConnection();
  app.use(
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
    }),
  );
  app.use("*", clerkMiddleware());
  app.use(contextMiddleware(db));

  app.route("/users", usersRoute);

  app.use(authMiddleware);

  app.route("/apps", appsRoute);
  app.route("/search", searchRoute);
  app.route("/knowledgebase", ragRoute);

  return app;
};
