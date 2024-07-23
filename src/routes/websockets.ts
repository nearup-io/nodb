import wsManager from "../utils/websocket-manager.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import backendTokenMiddleware from "../middlewares/backend-token.middleware.ts";

const wsApp = new OpenAPIHono();

wsApp.use(backendTokenMiddleware);

wsApp.get(
  "/:appName/:envName",
  wsManager.upgradeWebSocket((c) => {
    const { appName, envName } = c.req.param();
    return {
      onOpen: (event, ws) => {
        wsManager.addClient({ appName, envName, ws });
      },
      onClose: (event, ws) => {
        wsManager.closeConnection({ appName, envName, ws });
      },
      onError: (error, ws) => {
        console.error("WebSocket error:", error);
        ws.close(1011, "Internal Server Error");
      },
    };
  }),
);

export default wsApp;
