import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getGithubLoginUrl } from "../../services/auth.service";
import { Layout } from "./components/Layout";

const app = new Hono();

app.get("/", (c) => {
  const githubRedirectUrl = Bun.env.GITHUB_CALLBACK_URL;
  if (!githubRedirectUrl) {
    throw new HTTPException(400, {
      message: "Missing Github redirect url",
    });
  }
  const githubLoginUrl = getGithubLoginUrl({ redirectUrl: githubRedirectUrl });
  return c.html(Layout({ githubLoginUrl, googleLoginUrl: "" }));
});

export default app;
