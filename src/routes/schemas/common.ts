import { z } from "zod";

export const tokenPermissionSchema = z.enum(["ALL", "READ_ONLY"]);

export const tokenSchema = z.object({
  key: z.string(),
  permission: tokenPermissionSchema,
});

export const appNameParamSchema = z.object({
  appName: z.string().openapi({
    param: {
      name: "appName",
      in: "path",
    },
    type: "string",
    example: "your-application-name",
  }),
});

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
