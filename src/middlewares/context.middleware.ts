import { createFactory } from "hono/factory";
import Context from "./context.ts";
import ApplicationService from "../services/application.service.ts";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const context = new Context();
  context.register("APPLICATION_SERVICE", new ApplicationService());
  c.set("context", context);
  await next();
});

export default middleware;
