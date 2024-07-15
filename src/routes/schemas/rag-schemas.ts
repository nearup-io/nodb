import { createRoute } from "@hono/zod-openapi";
import { flexibleAuthMiddleware } from "../../middlewares";
import { z } from "zod";
import { appNameParamSchema } from "./application-schemas.ts";
import { envNameParamSchema } from "./environment-schemas.ts";
import { errorSchema } from "./error-schemas.ts";
import { entityNameSchema } from "./entity-schemas.ts";

export const ragSchemaPostRoute = createRoute({
  method: "post",
  path: "/{appName}/{envName}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            query: z.string(),
            limit: z.number().int().positive().optional(),
          }),
          example: {
            query: "What would be your question?",
          },
        },
      },
    },
    headers: z.object({
      Authorization: z.string().optional(),
    }),
  },
  responses: {
    201: {
      description: "Answer to your question",
      content: {
        "application/json": {
          schema: z.object({
            answer: z.unknown(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
  tags: ["Rag"],
});

export const ragSchemaPostEntityRoute = createRoute({
  method: "post",
  path: "/{appName}/{envName}/{entityName}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            query: z.string(),
            limit: z.number().int().positive().optional(),
          }),
          example: {
            query: "What would be your question?",
          },
        },
      },
    },
    headers: z.object({
      Authorization: z.string().optional(),
    }),
  },
  responses: {
    201: {
      description: "Answer to your question",
      content: {
        "application/json": {
          schema: z.object({
            answer: z.unknown(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
  tags: ["Rag"],
});
