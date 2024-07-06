import { type Application } from "../../models/application.model.ts";
import { type Environment } from "../../models/environment.model.ts";
import { type Token } from "../../models/token.model.ts";
import BaseRepository from "./base.repository.ts";
import type { IApplicationRepository } from "../interfaces.ts";
import type { PrismaClient } from "@prisma/client";
import * as R from "ramda";
import { defaultNodbEnv, Permissions } from "../../utils/const.ts";
import generateToken from "../../utils/backend-token.ts";
import type { BackendTokenPermissions } from "../../utils/types.ts";

class ApplicationRepository
  extends BaseRepository
  implements IApplicationRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  private async getEnvironmentsByAppName(
    appId: string,
  ): Promise<Omit<Environment, "extras" | "tokens">[]> {
    const application = await this.prisma.application.findFirst({
      where: { id: appId },
      include: {
        environments: {
          include: {
            entities: {
              select: {
                type: true,
              },
            },
          },
        },
      },
    });

    return (
      application?.environments.map((env) => {
        return {
          entities: env.entities.map(
            (entity) => entity.type.split("/").at(-1)!,
          ),
          ...R.omit(["entities"], env),
        };
      }) || []
    );
  }

  public async getApplication({
    appName,
    clerkId,
    token,
  }: {
    appName: string;
    clerkId?: string;
    token?: string;
  }): Promise<Application | null> {
    const app = await this.prisma.application.findFirst({
      where: {
        ...(clerkId && { userId: clerkId }),
        ...(token && {
          tokens: {
            some: {
              key: token,
            },
          },
        }),
        name: appName,
      },
      include: {
        tokens: {
          select: {
            key: true,
            permission: true,
          },
        },
        environments: {
          select: {
            id: true,
            name: true,
            tokens: {
              select: {
                key: true,
                permission: true,
              },
            },
            description: true,
            entities: false,
          },
        },
      },
    });

    return app
      ? {
          id: app.id,
          name: app.name,
          image: app.image,
          description: app.description,
          tokens: app.tokens,
          environments: app.environments.map((env) => {
            return {
              id: env.id,
              name: env.name,
              description: env.description,
              entities: [],
              tokens: app.tokens,
            };
          }),
        }
      : null;
  }

  public async getUserApplications({ clerkId }: { clerkId: string }): Promise<
    (Omit<Application, "id" | "environments"> & {
      environments: Omit<Environment, "id" | "description">[];
    })[]
  > {
    const applications = await this.prisma.application.findMany({
      where: {
        userId: clerkId,
      },
      include: {
        environments: {
          include: {
            tokens: {
              select: {
                key: true,
                permission: true,
              },
            },
            entities: {
              select: {
                type: true,
              },
            },
          },
        },
        tokens: {
          select: {
            key: true,
            permission: true,
          },
        },
      },
    });

    return applications.map((app) => {
      return {
        name: app.name,
        description: app.description,
        image: app.image,
        tokens: app.tokens,
        environments: app.environments.map((env) => {
          return {
            name: env.name,
            entities: R.uniq(
              env.entities.map((entity) => entity.type.split("/").at(-1)!),
            ),
            tokens: env.tokens,
          };
        }),
      };
    });
  }

  public async getTokenApplication({
    tokenPermissions,
  }: {
    tokenPermissions: BackendTokenPermissions;
  }): Promise<
    | (Omit<Application, "environments" | "id"> & {
        environments: Omit<Environment, "id" | "description">[];
      })
    | null
  > {
    const application = await this.prisma.application.findFirst({
      where: {
        tokens: {
          some: {
            key: tokenPermissions.token,
          },
        },
      },
      include: {
        environments: {
          include: {
            tokens: {
              select: {
                key: true,
                permission: true,
              },
            },
            entities: {
              select: {
                type: true,
              },
            },
          },
        },
        tokens: {
          select: {
            key: true,
            permission: true,
          },
        },
      },
    });

    if (!application) return null;

    return {
      name: application.name,
      description: application.description,
      image: application.image,
      tokens: application.tokens,
      environments: application.environments.map((env) => {
        return {
          name: env.name,
          entities: R.uniq(
            env.entities.map((entity) => entity.type.split("/").at(-1)!),
          ),
          tokens: env.tokens,
        };
      }),
    };
  }

  public async createApplication({
    appName,
    clerkId,
    image,
    appDescription,
    environmentName,
    environmentDescription,
  }: {
    appName: string;
    clerkId?: string;
    image: string;
    appDescription: string;
    environmentName?: string;
    environmentDescription?: string;
  }): Promise<{
    applicationName: string;
    environmentName: string;
    applicationTokens: Token[];
    environmentTokens: Token[];
  }> {
    const result = await this.transaction<{
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    }>(async (prisma) => {
      const app = await prisma.application.create({
        data: {
          name: appName,
          image,
          description: appDescription,
          ...(clerkId && {
            user: {
              connect: {
                clerkId,
              },
            },
          }),
          environments: {
            create: {
              name: environmentName || defaultNodbEnv,
              description: environmentDescription || "",
            },
          },
        },
        select: {
          id: true,
          name: true,
          environments: true,
        },
      });

      const tokens = await prisma.token.createManyAndReturn({
        data: [
          {
            key: generateToken(),
            permission: Permissions.ALL,
            applicationId: app.id,
          },
          {
            key: generateToken(),
            permission: Permissions.ALL,
            environmentId: app.environments[0].id,
          },
        ],
        select: {
          key: true,
          permission: true,
          environmentId: true,
          applicationId: true,
        },
      });

      return {
        environmentName: app.environments[0].name,
        applicationName: app.name,
        applicationTokens: [
          tokens.find((token) => token.applicationId === app.id)!,
        ],
        environmentTokens: [
          tokens.find(
            (token) => token.environmentId === app.environments[0].id,
          )!,
        ],
      };
    });
    return result;
  }

  public async updateApplication(props: {
    oldAppName: string;
    clerkId?: string;
    token?: string;
    updateProps: {
      name?: string;
      description?: string;
      image?: string;
    };
  }): Promise<Omit<Application, "environments" | "tokens"> | null> {
    const doc = await this.prisma.application.update({
      where: {
        name: props.oldAppName,
        ...(props.clerkId && { userId: props.clerkId }),
        ...(props.token && {
          tokens: {
            some: {
              key: props.token,
            },
          },
        }),
      },
      data: {
        ...(props.updateProps.name && {
          name: props.updateProps.name,
        }),
        ...(props.updateProps.description && {
          description: props.updateProps.description,
        }),
        ...(props.updateProps.image && {
          image: props.updateProps.image,
        }),
      },
      include: {
        environments: false,
      },
    });

    return {
      id: doc.id,
      name: doc.name,
      image: doc.image,
      description: doc.description,
    };
  }

  public async deleteApplication({
    dbAppId,
  }: {
    appName: string;
    clerkId: string;
    dbAppId: string;
  }): Promise<Omit<Application, "environments"> | null> {
    const envIds = (await this.getEnvironmentsByAppName(dbAppId)).map(
      ({ id }) => id,
    );

    return this.transaction<Omit<Application, "environments"> | null>(
      async (prisma) => {
        await prisma.token.deleteMany({
          where: {
            applicationId: dbAppId,
          },
        });

        await prisma.environment.deleteMany({
          where: {
            id: {
              in: envIds,
            },
          },
        });

        await prisma.entity.deleteMany({
          where: {
            environmentId: {
              in: envIds,
            },
          },
        });

        const app = await prisma.application.delete({
          where: {
            id: dbAppId,
          },
          include: {
            environments: false,
          },
        });

        return {
          id: app.id,
          name: app.name,
          description: app.description,
          image: app.image,
          tokens: [],
        };
      },
    );
  }
}

export default ApplicationRepository;
