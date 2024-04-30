import { Hono } from "hono";
import { logger } from "hono/logger";
import appsRoute from "./routes/applications";
import githubAuth from "./routes/auth/github";
import uiAuthRoute from "./routes/examples/auth";
import searchRoute from "./routes/search";
import ragRoute from "./routes/rag";
import RedisClient from "./redis/connection.ts";

// await dbconnect();
const redisClient = new RedisClient();
await redisClient.connect();
const app = new Hono();
if (Bun.env.NODE_ENV === "development") {
  app.use(logger());
}
app.route("/apps", appsRoute);
app.route("/search", searchRoute);
app.route("/knowledgebase", ragRoute);
app.route("/auth/github", githubAuth);
app.route("/examples/auth", uiAuthRoute);

export default app;
