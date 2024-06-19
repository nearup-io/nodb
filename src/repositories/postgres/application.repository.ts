import { type Application } from "../../models/application.model.ts";
import { type Environment } from "../../models/environment.model.ts";
import BaseRepository from "./base.repository.ts";
import type { IApplicationRepository } from "../interfaces.ts";
import type { PrismaClient } from "@prisma/client";
import * as R from "ramda";
import { defaultNodbEnv, Permissions } from "../../utils/const.ts";
import generateToken from "../../utils/backend-token.ts";

class ApplicationRepository
  extends BaseRepository
  implements IApplicationRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  private async getEnvironmentsByAppName(
    appName: string,
  ): Promise<Omit<Environment, "extras" | "tokens">[]> {
    const application = await this.prisma.application.findFirst({
      where: { name: appName },
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
  }: {
    appName: string;
    clerkId: string;
  }): Promise<Application | null> {
    const app = await this.prisma.application.findFirst({
      where: {
        userId: clerkId,
        name: appName,
      },
      include: {
        environments: {
          select: {
            id: true,
            name: true,
            tokens: false,
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
          environments: app.environments.map((env) => {
            return {
              id: env.id,
              name: env.name,
              description: env.description,
              tokens: [],
              entities: [],
            };
          }),
        }
      : null;
  }

  public async getUserApplications({
    clerkId,
  }: {
    clerkId: string;
  }): Promise<Application[]> {
    const applications = await this.prisma.application.findMany({
      where: {
        userId: clerkId,
      },
      include: {
        environments: {
          include: {
            entities: {
              select: {
                type: true,
              },
            },
            tokens: true,
          },
        },
      },
    });

    return applications.map((app) => {
      return {
        id: app.id,
        name: app.name,
        description: app.description,
        image: app.image,
        environments: app.environments.map((env) => {
          return {
            id: env.id,
            name: env.name,
            description: env.description,
            tokens: env.tokens.map((token) => {
              return {
                key: token.key,
                permission: token.permission,
              };
            }),
            entities: R.uniq(
              env.entities.map((entity) => entity.type.split("/").at(-1)!),
            ),
          };
        }),
      };
    });
  }

  public async createApplication({
    appName,
    clerkId,
    image,
    appDescription,
  }: {
    appName: string;
    clerkId: string;
    image: string;
    appDescription: string;
  }): Promise<void> {
    await this.prisma.environment.create({
      data: {
        name: defaultNodbEnv,
        tokens: {
          create: {
            key: generateToken(),
            permission: Permissions.ALL,
          },
        },
        description: "",
        application: {
          create: {
            name: appName,
            image,
            description: appDescription,
            user: {
              connect: {
                clerkId,
              },
            },
          },
        },
      },
    });
  }

  public async updateApplication(props: {
    oldAppName: string;
    clerkId: string;
    updateProps: {
      newAppName?: string;
      description?: string;
      image?: string;
    };
  }): Promise<Omit<Application, "environments"> | null> {
    const doc = await this.prisma.application.update({
      where: { name: props.oldAppName },
      data: {
        ...(props.updateProps.newAppName && {
          name: props.updateProps.newAppName,
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
    appName,
    clerkId,
  }: {
    appName: string;
    clerkId: string;
  }): Promise<Omit<Application, "environments"> | null> {
    const envIds = (await this.getEnvironmentsByAppName(appName)).map(
      ({ id }) => id,
    );

    return this.transaction<Omit<Application, "environments"> | null>(
      async (prisma) => {
        await prisma.token.deleteMany({
          where: {
            environmentId: {
              in: envIds,
            },
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
            name: appName,
            userId: clerkId,
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
        };
      },
    );
  }
}

export default ApplicationRepository;
