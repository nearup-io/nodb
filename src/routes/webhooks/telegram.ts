import { Hono } from "hono";
import {
  handleWebhookMessage,
  type TelegramRequest,
} from "../../services/telegram.service.ts";
import type { USER_TYPE } from "../../utils/auth-utils.ts";
import type Context from "../../middlewares/context.ts";
import { ServiceError } from "../../utils/service-errors.ts";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../../utils/const.ts";

const app = new Hono<{
  Variables: {
    user: USER_TYPE;
    context: Context;
  };
}>();

// validation endpoint which is needed
app.get("/", async (c) => {
  const query = c.req.query();
  console.log("query", query);
  return c.text("true");
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as TelegramRequest;
  try {
    await handleWebhookMessage({
      telegramRequestBody: body,
      context: c.get("context"),
      user: c.get("user"),
    });
    return c.json({});
  } catch (error) {
    if (error instanceof ServiceError) {
      throw new HTTPException(400, { message: error.explicitMessage });
    } else {
      throw new HTTPException(500, { message: httpError.UNKNOWN });
    }
  }
});

export default app;
