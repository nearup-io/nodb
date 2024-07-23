import { startApp } from "./server.ts";
import wsManager from "./utils/websocket-manager.ts";

const { app } = await startApp();

Bun.serve({
  fetch: app.fetch,
  port: Bun.env.PORT || 3000,
  websocket: wsManager.websocket,
});
