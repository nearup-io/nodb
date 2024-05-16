import { Hono } from "hono";
import { logger } from "hono/logger";
import appsRoute from "./routes/applications";
import ragRoute from "./routes/rag";
import searchRoute from "./routes/search";
import mongoConnect from "./connections/mongodb.ts";
import webhooksRoute from "./routes/webhooks.ts";
import { cors } from "hono/cors";
import users from "./routes/users.ts";
import { clerkMiddleware } from "@hono/clerk-auth";
import contextMiddleware from "./middlewares/context.middleware.ts";
import authMiddleware from "./middlewares/auth.middleware.ts";

const app = new Hono();
if (Bun.env.NODE_ENV === "development") {
  app.use(logger());
}

await mongoConnect();
app.use(contextMiddleware);
app.use(
  cors({
    origin: [
      "https://5806-109-92-19-84.ngrok-free.app",
      "http://localhost:5173",
    ],
  }),
);

app.route("/webhooks", webhooksRoute);

app.use(clerkMiddleware());
app.route("/users", users);

app.use(authMiddleware);
// TODO auth middleware could be included here
app.route("/apps", appsRoute);
app.route("/search", searchRoute);
app.route("/knowledgebase", ragRoute);

export default app;
