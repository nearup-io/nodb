import { Hono } from "hono";
import { logger } from "hono/logger";
import dbconnect from "./mongoconnect.ts";
import appsRoute from "./routes/applications.ts";
import githubAuth from "./routes/auth/github.ts";
import uiAuthRoute from "./routes/examples/auth.ts";

await dbconnect();

const app = new Hono();
if (Bun.env.NODE_ENV === "development") {
  app.use(logger());
}
app.route("/apps", appsRoute);
app.route("/auth/github", githubAuth);
app.route("/examples/auth", uiAuthRoute);
// app.route("/auth/google", googleAuth);

export default app;
