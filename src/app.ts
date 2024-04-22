import { Hono } from "hono";
import { logger } from "hono/logger";
import dbconnect from "./mongoconnect";
import appsRoute from "./routes/applications";
import githubAuth from "./routes/auth/github";
import uiAuthRoute from "./routes/examples/auth";
import searchRoute from "./routes/search";

await dbconnect();

const app = new Hono();
if (Bun.env.NODE_ENV === "development") {
  app.use(logger());
}
app.route("/apps", appsRoute);
app.route("/search", searchRoute);
app.route("/auth/github", githubAuth);
app.route("/examples/auth", uiAuthRoute);
// app.route("/auth/google", googleAuth);

export default app;