import { Hono } from "hono";
import whatsappRoute from "./webhooks/whatsapp.ts";
import telegramRoute from "./webhooks/telegram.ts";

const app = new Hono();

app.route("/whatsapp", whatsappRoute);
app.route("/telegram", telegramRoute);

export default app;
