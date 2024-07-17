import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { flexibleAuthMiddleware } from "../../middlewares";
import { SecuritySchema } from "./security-schemas.ts";
import { errorSchema } from "./error-schemas.ts";
import {
  appNameParamSchema,
  envNameParamSchema,
  tokenPermissionSchema,
} from "./common.ts";

export const tokenPostSchema = createRoute({
  method: "post",
  path: "/{appName}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: appNameParamSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            permission: tokenPermissionSchema,
          }),
          example: {
            permission: "READ_ONLY",
          },
        },
      },
    },
    headers: SecuritySchema,
  },
  responses: {
    201: {
      description: "Token for the requested application",
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            permission: tokenPermissionSchema,
            appName: z.string(),
          }),
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
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
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
  tags: ["Tokens"],
});

export const tokenDeleteSchema = createRoute({
  method: "delete",
  path: "/{appName}/{token}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      token: z.string(),
    }),
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Indicates successful deletion of token",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      // content: {
      //   "application/json": {
      //     schema: errorSchema,
      //   },
      // },
    },
    403: {
      description: "Forbidden",
      // content: {
      //   "application/json": {
      //     schema: errorSchema,
      //   },
      // },
    },
  },
  tags: ["Tokens"],
});

export const tokenPostEnvironmentSchema = createRoute({
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
            permission: tokenPermissionSchema,
          }),
          example: {
            permission: "READ_ONLY",
          },
        },
      },
    },
    headers: SecuritySchema,
  },
  responses: {
    201: {
      description: "Token for the requested environment",
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            permission: tokenPermissionSchema,
            appName: z.string(),
            envName: z.string(),
          }),
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
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
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
  tags: ["Tokens"],
});

export const tokenDeleteEnvironmentSchema = createRoute({
  method: "delete",
  path: "/{appName}/{envName}/{token}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: z.object({
      ...appNameParamSchema.shape,
      ...envNameParamSchema.shape,
      token: z.string(),
    }),
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Indicates successful deletion of token",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      // content: {
      //   "application/json": {
      //     schema: errorSchema,
      //   },
      // },
    },
    403: {
      description: "Forbidden",
      // content: {
      //   "application/json": {
      //     schema: errorSchema,
      //   },
      // },
    },
  },
  tags: ["Tokens"],
});
