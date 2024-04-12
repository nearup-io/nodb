import { Hono } from "hono";
import { logger } from "hono/logger";
import mongoconnect from "./mongoconnect";
import appsRoute from "./src/routes/applications";
import githubAuth from "./src/routes/auth/github";
import uiAuthRoute from "./src/routes/examples/auth";

await mongoconnect();

const app = new Hono();
if (Bun.env.NODB_ENV === "dev") {
  app.use(logger());
}
app.route("/apps", appsRoute);
app.route("/auth/github", githubAuth);
app.route("/examples/auth", uiAuthRoute);
// app.route("/auth/google", googleAuth);

export default app;
