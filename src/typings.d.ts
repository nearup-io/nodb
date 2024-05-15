import type Context from "./middlewares/context.ts";

declare module "hono" {
  interface ContextVariableMap {
    context: Context;
  }
}
