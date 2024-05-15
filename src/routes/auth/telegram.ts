import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { USER_TYPE } from "../../utils/auth-utils.ts";
import { updateUserTelegramId } from "../../services/user.service.ts";
import { ServiceError } from "../../utils/service-errors.ts";
import authMiddleware from "../../middlewares/auth.middleware.ts";

const app = new Hono<{
  Variables: {
    user: USER_TYPE;
  };
}>();
app.use(authMiddleware);

// TODO cover with e2e tests
app.patch("/", async (c) => {
  try {
    const body = await c.req.json();

    await updateUserTelegramId({
      telegramId: body.telegramId,
      email: c.get("user").email,
      context: c.get("context"),
    });
    return c.json({ done: true });
  } catch (e: any) {
    if (e instanceof HTTPException) {
      throw e;
    } else if (e instanceof ServiceError) {
      throw new HTTPException(400, { message: e.explicitMessage });
    } else {
      console.log(e.message);
      throw new HTTPException(500, {
        message: "Unknown error occured",
      });
    }
  }
});

export default app;
