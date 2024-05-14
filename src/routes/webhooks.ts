import { Hono } from "hono";
import whatsappRoute from "./webhooks/whatsapp.ts";

const app = new Hono();

app.route("whatsapp", whatsappRoute);

export default app;
