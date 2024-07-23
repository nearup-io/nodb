import wsManager from "../utils/websocket-manager.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import backendTokenMiddleware from "../middlewares/backend-token.middleware.ts";

const wsApp = new OpenAPIHono();

wsApp.get(
  "/:appName",
  backendTokenMiddleware,
  wsManager.upgradeWebSocket((c) => {
    const { appName } = c.req.param();
    return {
      onOpen: (event, ws) => {
        wsManager.addClient({ appName, ws });
      },
      onClose: (event, ws) => {
        wsManager.closeConnection({ appName, ws });
      },
      onError: (error, ws) => {
        console.error("WebSocket error:", error);
        ws.close(1011, "Internal Server Error");
      },
    };
  }),
);

wsApp.get(
  "/:appName/:envName",
  backendTokenMiddleware,
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
