import { z } from "zod";
import { tokenSchema } from "./token-schemas.ts";
import { createRoute } from "@hono/zod-openapi";
import { flexibleAuthMiddleware } from "../../middlewares";
import { APPNAME_MIN_LENGTH, APPNAME_REGEX } from "../../utils/const.ts";
import { SecuritySchema } from "./security-schemas.ts";
import { ErrorSchema } from "./error-schemas.ts";

const ApplicationPostBodySchema = z.object({
  image: z.string().optional(),
  description: z.string().optional(),
  environmentName: z.string().optional(),
  environmentDescription: z.string().optional(),
});

const ApplicationPostResponseSchema = z.object({
  applicationName: z.string(),
  environmentName: z.string(),
  applicationTokens: z.array(tokenSchema),
  environmentTokens: z.array(tokenSchema),
});

const ApplicationGetAllResponseSchema = z.array(
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

export const applicationPostRoute = createRoute({
  method: "post",
  path: "/{appName}",
  middleware: [flexibleAuthMiddleware({ authNotRequired: true })],
  request: {
    params: z.object({
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
    }),
    body: {
      content: {
        "application/json": {
          schema: ApplicationPostBodySchema,
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
          schema: ApplicationPostResponseSchema,
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
  },
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
          schema: ApplicationGetAllResponseSchema,
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
  },
});
