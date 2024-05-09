import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type mongoose from "mongoose";
import authMiddleware from "../middlewares/auth.middleware";
import dbMiddleware from "../middlewares/db.middleware";
import {
  createEnvironment,
  deleteEnvironment,
  findEnvironment,
  updateEnvironment,
} from "../services/environment.service";
import type { USER_TYPE } from "../utils/auth-utils";
import { httpError } from "../utils/const";
import { asyncTryJson } from "../utils/route-utils";
import { ServiceError } from "../utils/service-errors";
import entitiesRoute from "./entities";
import contextMiddleware from "../middlewares/context.middleware.ts";
import type Context from "../middlewares/context.ts";

const app = new Hono<{
  Variables: {
    user: USER_TYPE;
    dbConnection: mongoose.Connection;
    context: Context;
  };
}>();
app.use(authMiddleware);
app.use(dbMiddleware);
app.use(contextMiddleware);

app.get("/", async (c) => {
  const { appName, envName } = c.req.param() as {
    appName: string;
    envName: string;
  };
  try {
    const env = await findEnvironment({
      context: c.get("context"),
      appName,
      envName,
    });
    if (!env) {
      throw new HTTPException(404, {
        message: httpError.ENV_NOTFOUND,
      });
    }

    return c.json(env);
  } catch (e) {
    if (e instanceof HTTPException) {
      throw e;
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const { appName, envName } = c.req.param() as {
    appName: string;
    envName: string;
  };
  try {
    const doc = await createEnvironment({
      context: c.get("context"),
      appName,
      envName,
      description: body.description,
    });
    c.status(201);
    return c.json(doc);
  } catch (e) {
    if (e instanceof ServiceError) {
      throw new HTTPException(400, {
        message: e.explicitMessage,
      });
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

app.patch("/", async (c) => {
  const body = await asyncTryJson(c.req.json());
  const { appName, envName } = c.req.param() as {
    appName: string;
    envName: string;
  };
  if (envName === body.envName) {
    throw new HTTPException(400, {
      message: httpError.SAME_ENVNAME,
    });
  }
  try {
    const doc = await updateEnvironment({
      context: c.get("context"),
      appName,
      newEnvName: body.envName,
      oldEnvName: envName,
      description: body.description,
    });
    if (!doc) return c.json({ found: false });
    return c.json({ found: true });
  } catch (e) {
    if (e instanceof ServiceError) {
      if (e.explicitMessage === httpError.ENV_DOESNT_EXIST) {
        throw new HTTPException(404, {
          message: e.explicitMessage,
        });
      } else {
        throw new HTTPException(400, {
          message: e.explicitMessage,
        });
      }
    } else {
      console.log(e);
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

app.delete("/", async (c) => {
  const { appName, envName } = c.req.param() as {
    appName: string;
    envName: string;
  };
  try {
    await deleteEnvironment({ context: c.get("context"), appName, envName });
    return c.json({ found: true });
  } catch (e) {
    if (e instanceof ServiceError) {
      if (e.explicitMessage === httpError.ENV_DOESNT_EXIST)
        return c.json({ found: false });
      else
        throw new HTTPException(400, {
          message: e.explicitMessage,
        });
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

app.route("/:entityName", entitiesRoute);

export default app;
