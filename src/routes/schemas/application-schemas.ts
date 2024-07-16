import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { flexibleAuthMiddleware } from "../../middlewares";
import { APPNAME_MIN_LENGTH, APPNAME_REGEX } from "../../utils/const.ts";
import { SecuritySchema } from "./security-schemas.ts";
import { errorSchema } from "./error-schemas.ts";
import { appNameParamSchema, tokenSchema } from "./common.ts";

const applicationPostBodySchema = z.object({
  image: z.string().optional(),
  description: z.string().optional(),
  environmentName: z.string().optional(),
  environmentDescription: z.string().optional(),
});

const applicationPostResponseSchema = z.object({
  applicationName: z.string(),
  environmentName: z.string(),
  applicationTokens: z.array(tokenSchema),
  environmentTokens: z.array(tokenSchema),
});

const applicationGetAllResponseSchema = z.array(
  z.object({
    name: z.string(),
    image: z.string().optional(),
    description: z.string().optional(),
    tokens: z.array(tokenSchema),
    environments: z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        tokens: z.array(tokenSchema),
        entities: z.array(z.string()),
      }),
    ),
  }),
);

const applicationGetByNameResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional(),
  description: z.string().optional(),
  tokens: z.array(tokenSchema),
  environments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
    }),
  ),
});

const applicationPatchBodySchema = z.object({
  appName: z
    .string()
    .min(
      APPNAME_MIN_LENGTH,
      `App name must be at least ${APPNAME_MIN_LENGTH} characters long`,
    )
    .refine(
      (value) => APPNAME_REGEX.test(value ?? ""),
      "App name must follow hyphenated-url-pattern",
    )
    .optional(),
  image: z.string().optional(),
  description: z.string().optional(),
});

const appNameParamWithValidation = z.object({
  appName: z
    .string()
    .min(
      APPNAME_MIN_LENGTH,
      `App name must be at least ${APPNAME_MIN_LENGTH} characters long`,
    )
    .refine(
      (value) => APPNAME_REGEX.test(value ?? ""),
      "App name must follow hyphenated-url-pattern",
    )
    .openapi({
      param: {
        name: "appName",
        in: "path",
      },
      type: "string",
      example: "your-application-name",
    }),
});

export const applicationPostRoute = createRoute({
  method: "post",
  path: "/{appName}",
  middleware: [flexibleAuthMiddleware({ authNotRequired: true })],
  request: {
    params: appNameParamWithValidation,
    body: {
      content: {
        "application/json": {
          schema: applicationPostBodySchema,
          example: {
            image: "path/to/yourimage.jpg",
            description: "application description",
            environmentName: "environment name",
            environmentDescription: "environment description",
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
      description: "Application created response",
      content: {
        "application/json": {
          schema: applicationPostResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request",
    },
  },
  tags: ["Applications"],
});

export const applicationGetAllRoute = createRoute({
  method: "get",
  path: "/all",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "All of the users applications",
      content: {
        "application/json": {
          schema: applicationGetAllResponseSchema,
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
  },
  tags: ["Applications"],
});

export const applicationGetByNameRoute = createRoute({
  method: "get",
  path: "/{appName}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: appNameParamSchema,
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Get application by name",
      content: {
        "application/json": {
          schema: applicationGetByNameResponseSchema,
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
      description: "Application not found",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
  tags: ["Applications"],
});

export const applicationPatchRoute = createRoute({
  method: "patch",
  path: "/{appName}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: appNameParamWithValidation,
    body: {
      content: {
        "application/json": {
          schema: applicationPatchBodySchema,
          example: {
            appName: "new application name",
            description: "application description",
            image: "path/to/yourimage.jpg",
          },
        },
      },
    },
    headers: SecuritySchema,
  },
  responses: {
    200: {
      description: "Application updated response",
      content: {
        "application/json": {
          schema: applicationPostResponseSchema,
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
      description: "Application not found",
    },
  },
  tags: ["Applications"],
});

export const applicationDeleteRoute = createRoute({
  method: "delete",
  path: "/{appName}",
  middleware: [flexibleAuthMiddleware({ allowBackendToken: true })],
  request: {
    params: appNameParamSchema,
    headers: SecuritySchema,
  },
  responses: {
    201: {
      description: "Application deleted response",
      content: {
        "application/json": {
          schema: z.object({ found: z.boolean() }),
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
  tags: ["Applications"],
});
