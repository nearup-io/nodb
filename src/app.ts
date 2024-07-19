import { startApp } from "./server.ts";

const { app } = await startApp();

export default { fetch: app.fetch, port: Bun.env.PORT || 3000 };
