import { Hono } from "hono";
import { logger } from "hono/logger";
import appsRoute from "./routes/applications";
import githubAuth from "./routes/auth/github";
import uiAuthRoute from "./routes/examples/auth";
import ragRoute from "./routes/rag";
import searchRoute from "./routes/search";
import mongoConnect from "./connections/mongodb.ts";
import webhooksRoute from "./routes/webhooks.ts";
import { cors } from "hono/cors";

const app = new Hono();
if (Bun.env.NODE_ENV === "development") {
  app.use(logger());
}

await mongoConnect();
app.use(
  cors({
    origin: "https://5806-109-92-19-84.ngrok-free.app",
  }),
);

app.route("/apps", appsRoute);
app.route("/search", searchRoute);
app.route("/knowledgebase", ragRoute);
app.route("/auth/github", githubAuth);
app.route("/examples/auth", uiAuthRoute);
app.route("/webhooks", webhooksRoute);

export default app;
