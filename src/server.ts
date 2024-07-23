import { logger } from "hono/logger";
import initDbConnection from "./connections/initDbConnection.ts";
import { cors } from "hono/cors";
import { clerkMiddleware } from "@hono/clerk-auth";
import { contextMiddleware } from "./middlewares";
import usersRoute from "./routes/users.ts";
import appsRoute from "./routes/applications.ts";
import searchRoute from "./routes/search.ts";
import ragRoute from "./routes/rag.ts";
import tokenRoute from "./routes/tokens.ts";
import errorHandler from "./middlewares/error-handler.middleware.ts";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import wsRoutes from "./routes/websockets.ts";

export const startApp = async (props?: {
  postgresDatabaseUrl?: string;
}): Promise<{
  app: OpenAPIHono;
  stopApp: () => Promise<void>;
}> => {
  const app = new OpenAPIHono();
  if (Bun.env.NODE_ENV === "development") {
    app.use(logger());
  }
  app.onError(errorHandler);

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
  app.get("/ui", swaggerUI({ url: "/doc" }));
  app.route("/users", usersRoute);
  app.route("/apps", appsRoute);
  app.route("/search", searchRoute);
  app.route("/knowledgebase", ragRoute);
  app.route("/tokens", tokenRoute);
  app.route("/ws", wsRoutes);

  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: "0.1.0",
      title: "Nodb - API",
    },
    tags: [
      { name: "Applications", description: "Application management" },
      { name: "Environments", description: "Environment management" },
      { name: "Entities", description: "Entity management" },
      { name: "Rag", description: "Ai search" },
      { name: "Search", description: "Vector search" },
      { name: "Tokens", description: "Backend tokens" },
    ],
  });

  return {
    app,
    stopApp: async () => {
      await db.$disconnect();
      console.log("Disconnected from app database");
    },
  };
};
