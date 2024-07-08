import { type Environment } from "../../models/environment.model.ts";
import BaseRepository from "./base.repository.ts";
import type { IEnvironmentRepository } from "../interfaces.ts";
import type { PrismaClient } from "@prisma/client";
import generateToken from "../../utils/backend-token.ts";
import { Permissions } from "../../utils/const.ts";

class EnvironmentRepository
  extends BaseRepository
  implements IEnvironmentRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  public async findEnvironment({
    envName,
    appName,
  }: {
    envName: string;
    appName: string;
  }): Promise<Environment | null> {
    const environment = await this.prisma.environment.findFirst({
      where: {
        name: envName,
        applicationName: appName,
      },
      include: {
        entities: {
          select: {
            type: true,
          },
        },
        tokens: true,
      },
    });

    if (!environment) return null;

    return {
      id: environment.id,
      name: environment.name,
      description: environment.description,
      tokens: environment.tokens,
      entities: environment.entities.map(({ type }) => type.split("/").at(-1)!),
    };
  }

  public async createEnvironment({
    appName,
    envName,
    description = "",
  }: {
    envName: string;
    appName: string;
    description?: string;
  }): Promise<Environment> {
    const environment = await this.prisma.environment.create({
      data: {
        name: envName,
        description,
        tokens: {
          create: {
            key: generateToken(),
            permission: Permissions.ALL,
          },
        },
        application: {
          connect: {
            name: appName,
          },
        },
      },
      include: {
        entities: false,
        tokens: {
          select: {
            key: true,
            permission: true,
          },
        },
      },
    });

    return {
      id: environment.id,
      name: environment.name,
      description: environment.description,
      tokens: environment.tokens,
      entities: [],
    };
  }

  public async deleteEnvironment({
    appName,
    envName,
    environmentDbId,
  }: {
    appName: string;
    envName: string;
    environmentDbId: string;
  }): Promise<void> {
    await this.transaction(async (prisma) => {
      await prisma.entity.deleteMany({
        where: {
          environmentId: environmentDbId,
        },
      });

      await prisma.environment.delete({
        where: {
          id: environmentDbId,
        },
      });
    });
  }

  public async updateEnvironment({
    databaseEnvironmentId,
    updateProps,
  }: {
    databaseEnvironmentId: string;
    updateProps: { name?: string; description?: string };
  }): Promise<Environment | null> {
    const environment = await this.prisma.environment.update({
      where: {
        id: databaseEnvironmentId,
      },
      data: {
        ...updateProps,
      },
      include: {
        entities: {
          select: {
            type: true,
          },
        },
        tokens: true,
      },
    });

    return {
      id: environment.id,
      name: environment.name,
      description: environment.description,
      tokens: environment.tokens,
      entities: environment.entities.map(({ type }) => type.split("/").at(-1)!),
    };
  }
}

export default EnvironmentRepository;
