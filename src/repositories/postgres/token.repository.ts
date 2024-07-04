import BaseRepository from "./base.repository.ts";
import type { PrismaClient } from "@prisma/client";
import type { ITokenRepository } from "../interfaces.ts";
import type { Token, TokenPermission } from "../../models/token.model.ts";

class TokenRepository extends BaseRepository implements ITokenRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async getAllTokens({
    app,
    env,
  }: {
    app: string;
    env: string;
  }): Promise<Token[]> {
    const tokens = await this.prisma.token.findMany({
      where: {
        environment: {
          is: {
            name: env,
            applicationName: app,
          },
        },
      },
    });

    return tokens.map((token) => ({
      key: token.key,
      permission: token.permission,
    }));
  }

  async getTokenPermissions({ token }: { token: string }): Promise<{
    applicationName: string;
    applicationId: string;
    environmentName: string;
    environmentId: string;
    token: string;
    permission: TokenPermission;
  } | null> {
    const result = await this.prisma.token.findFirst({
      where: {
        key: token,
      },
      include: {
        environment: {
          select: {
            id: true,
            name: true,
            description: true,
            application: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!result) return null;

    return {
      applicationId: result.environment.application.id,
      applicationName: result.environment.application.name,
      environmentId: result.environment.id,
      environmentName: result.environment.name,
      token: result.key,
      permission: result.permission,
    };
  }
}

export default TokenRepository;
