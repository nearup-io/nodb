import { Hono } from "hono";
import {
  handleWebhookMessage,
  type TelegramRequest,
} from "../../services/telegram.service.ts";

const app = new Hono();

// validation endpoint which is needed
app.get("/", async (c) => {
  const query = c.req.query();
  console.log("query", query);
  return c.text("true");
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as TelegramRequest;

  await handleWebhookMessage(body);

  return c.json({});
});

export default app;
