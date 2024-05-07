import { Hono } from "hono";
import { logger } from "hono/logger";
import { formDbConnections } from "./connections/connect";
import appsRoute from "./routes/applications";
import githubAuth from "./routes/auth/github";
import uiAuthRoute from "./routes/examples/auth";
import ragRoute from "./routes/rag";
import searchRoute from "./routes/search";

const app = new Hono();
if (Bun.env.NODE_ENV === "development") {
  app.use(logger());
}

await formDbConnections();

app.route("/:db/apps", appsRoute);
app.route("/:db/search", searchRoute);
app.route("/:db/knowledgebase", ragRoute);
app.route("/auth/github", githubAuth);
app.route("/examples/auth", uiAuthRoute);

export default app;
