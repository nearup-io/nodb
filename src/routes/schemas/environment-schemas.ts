import { createRoute } from "@hono/zod-openapi";
import { flexibleAuthMiddleware } from "../../middlewares";
import { z } from "zod";
import { SecuritySchema } from "./security-schemas.ts";
import { errorSchema } from "./error-schemas.ts";
import { appNameParamSchema } from "./application-schemas.ts";
import { tokenSchema } from "./token-schemas.ts";

export const envNameParamSchema = z.object({
  envName: z.string().openapi({
    param: {
      name: "envName",
      in: "path",
    },
    type: "string",
    example: "your-env-name",
  }),
});

const environmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tokens: z.array(tokenSchema),
  entities: z.array(z.string()),
});

export const environmentGetByNameRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
    }),
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Get environment by name in a certain application",
      content: {
        "application/json": {
          schema: environmentSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
    404: {
      description: "Environment not found",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
  tags: ["Environments"],
});

export const environmentPostRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
    }),
    headers: SecuritySchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            description: z.string().optional(),
          }),
          example: {
            description: "environment description",
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created environment",
      content: {
        "application/json": {
          schema: environmentSchema,
        },
      },
    },
    400: {
      description: "Bad request",
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
  tags: ["Environments"],
});

export const environmentPatchRoute = createRoute({
  method: "patch",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
    }),
    headers: SecuritySchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            envName: z.string().optional(),
            description: z.string().optional(),
          }),
          example: {
            description: "environment description",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated environment",
      content: {
        "application/json": {
          schema: environmentSchema,
        },
      },
    },
    400: {
      description: "Bad request",
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
    404: {
      description: "Environment not found",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
  tags: ["Environments"],
});

export const environmentDeleteRoute = createRoute({
  method: "delete",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
    }),
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Created environment",
      content: {
        "application/json": {
          schema: z.object({ found: z.boolean() }),
        },
      },
    },
    400: {
      description: "Bad request",
    },
  },
  tags: ["Environments"],
});
