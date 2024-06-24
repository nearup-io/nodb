import { Hono } from "hono";
import { logger } from "hono/logger";
import appsRoute from "./routes/applications";
import ragRoute from "./routes/rag";
import searchRoute from "./routes/search";
import usersRoute from "./routes/users.ts";
import authMiddleware from "./middlewares/auth.middleware.ts";
import contextMiddleware from "./middlewares/context.middleware.ts";
import { clerkMiddleware } from "@hono/clerk-auth";
import { cors } from "hono/cors";
import initDbConnection from "./connections/initDbConnection.ts";

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

export default app;
