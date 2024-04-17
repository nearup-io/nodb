import { Hono } from "hono";
import { logger } from "hono/logger";
import dbconnect from "./mongoconnect";
import appsRoute from "./src/routes/applications";
import searchRoute from "./src/routes/search";
import githubAuth from "./src/routes/auth/github";
import uiAuthRoute from "./src/routes/examples/auth";

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
