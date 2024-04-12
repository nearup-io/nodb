import { html } from "hono/html";

export const Layout = ({
  googleLoginUrl,
  githubLoginUrl,
}: {
  googleLoginUrl: string;
  githubLoginUrl: string;
}) => {
  return html`<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Title</title>
      </head>
      <body style="padding: 0 2em; min-height: 100vh;">
        <div
          style="display: flex; flex: 1; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; width: 100%;"
        >
          <div><a href="${googleLoginUrl}">Login with Google</a></div>
          <div><a href="${githubLoginUrl}">Login with Github</a></div>
        </div>
      </body>
    </html>`;
};
