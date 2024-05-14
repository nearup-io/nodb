import { Hono } from "hono";
import {
  handleWebhookMessage,
  type WebhookMessage,
} from "../../services/whatsapp.service.ts";

const app = new Hono();

// TODO middleware to validate token
// TODO When and how do we attach the user and the users apps and permissions

// validation endpoint which is needed
app.get("/", async (c) => {
  const query = c.req.query();
  return c.text(query["hub.challenge"]);
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as WebhookMessage;
  await handleWebhookMessage(body);
  return c.json({});
});

export default app;
