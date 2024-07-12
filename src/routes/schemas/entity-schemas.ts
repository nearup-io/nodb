import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { flexibleAuthMiddleware } from "../../middlewares";
import { appNameParamSchema } from "./application-schemas.ts";
import { SecuritySchema } from "./security-schemas.ts";
import { ErrorSchema } from "./error-schemas.ts";
import { envNameParamSchema } from "./environment-schemas.ts";

const entityQueryParamsSchema = z
  .object({
    __only: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.string().array())
      .optional(),
    __page: z.preprocess(Number, z.number()).optional(),
    __per_page: z.preprocess(Number, z.number()).optional(),
    __no_meta: z
      .enum(["true", "false", "0", "1"])
      .transform((value) => value === "true" || value === "1")
      .optional(),
    __sort_by: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.string().array())
      .optional(),
    __sort_by_desc: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.string().array())
      .optional(),
  })
  .passthrough();

export type EntityQueryParams = z.infer<typeof entityQueryParamsSchema>;

export const entityNameSchema = z.object({
  entityName: z.string().openapi({
    param: {
      name: "entityName",
      in: "path",
    },
    type: "string",
    example: "entityName",
  }),
});
export const entityIdSchema = z.object({
  entityId: z.string().openapi({
    param: {
      name: "entityId",
      in: "path",
    },
    type: "string",
    example: "entityId",
  }),
});

export const entityPostRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
    }),
    headers: SecuritySchema,
    body: {
      content: {
        "application/json": {
          schema: z.array(z.record(z.string(), z.unknown())),
          example: {
            prop: "value",
            prop2: "value",
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: "Entity ids",
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      // content: {
      //   "application/json": {
      //     schema: ErrorSchema,
      //   },
      // },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});

export const entityPutRoute = createRoute({
  method: "put",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
    }),
    headers: SecuritySchema,
    body: {
      content: {
        "application/json": {
          schema: z.array(
            z
              .object({ id: z.string().optional() })
              .and(z.record(z.string(), z.unknown())),
          ),
          example: {
            prop: "value",
            prop2: "value",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Entity ids",
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      // content: {
      //   "application/json": {
      //     schema: ErrorSchema,
      //   },
      // },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});

export const entityPatchRoute = createRoute({
  method: "patch",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
    }),
    headers: SecuritySchema,
    body: {
      content: {
        "application/json": {
          schema: z.array(
            z
              .object({ id: z.string().optional() })
              .and(z.record(z.string(), z.unknown())),
          ),
          example: {
            prop: "value",
            prop2: "value",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Entity ids",
      content: {
        "application/json": {
          schema: z.object({
            ids: z.array(z.string()),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      // content: {
      //   "application/json": {
      //     schema: ErrorSchema,
      //   },
      // },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});

export const entityDeleteRoute = createRoute({
  method: "delete",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
    }),
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Deleted environments count",
      content: {
        "application/json": {
          schema: z.object({
            deleted: z.number(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      // content: {
      //   "application/json": {
      //     schema: ErrorSchema,
      //   },
      // },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found environment",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});

export const entityDeleteByIdRoute = createRoute({
  method: "delete",
  path: "/{entityId}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
      ...entityIdSchema.shape,
    }),
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Delete entity by id",
      content: {
        "application/json": {
          schema: z.object({
            deleted: z.boolean(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      // content: {
      //   "application/json": {
      //     schema: ErrorSchema,
      //   },
      // },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found environment",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});

export const entityGetByIdRoute = createRoute({
  method: "get",
  path: "/{entityId}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
      ...entityIdSchema.shape,
    }),
    query: entityQueryParamsSchema,
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Get entity by id in a certain environment and application",
      content: {
        "application/json": {
          schema: z
            .object({
              id: z.string(),
              __meta: z
                .object({
                  self: z.string(),
                })
                .optional(),
            })
            .and(z.record(z.string(), z.unknown())),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});

export const entityGetRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      ...entityNameSchema.shape,
    }),
    query: entityQueryParamsSchema,
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description:
        "Get entities by name in a certain environment and application",
      content: {
        "application/json": {
          schema: z
            .object({
              __meta: z
                .object({
                  totalCount: z.number(),
                  items: z.number(),
                  next: z.number().optional(),
                  previous: z.number().optional(),
                  pages: z.number(),
                  page: z.number(),
                  current_page: z.string(),
                  first_page: z.string().optional(),
                  last_page: z.string().optional(),
                  previous_page: z.string().optional(),
                  next_page: z.string().optional(),
                })
                .optional(),
            })
            .and(z.record(z.string(), z.unknown())),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
  tags: ["Entities"],
});
