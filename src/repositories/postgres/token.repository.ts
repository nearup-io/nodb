import BaseRepository from "./base.repository.ts";
import type { PrismaClient } from "@prisma/client";
import type { ITokenRepository } from "../interfaces.ts";
import type { BackendTokenPermissions } from "../../utils/types.ts";
import type { TokenPermission } from "../../models/token.model.ts";
import generateToken from "../../utils/backend-token.ts";

class TokenRepository extends BaseRepository implements ITokenRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async getTokenPermissions({
    token,
  }: {
    token: string;
  }): Promise<BackendTokenPermissions | null> {
    const result = await this.prisma.token.findFirst({
      where: {
        key: token,
      },
      include: {
        environment: {
          select: {
            id: true,
            name: true,
          },
        },
        application: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!result) return null;

    return {
      applicationId: result.application?.id,
      applicationName: result.application?.name,
      environmentId: result.environment?.id,
      environmentName: result.environment?.name,
      token: result.key,
      permission: result.permission,
    };
  }

  async createTokenForAppOrEnvironment({
    appId,
    envId,
    permission,
  }: {
    permission: TokenPermission;
    appId?: string;
    envId?: string;
  }): Promise<string> {
    const result = await this.prisma.token.create({
      data: {
        key: generateToken(),
        permission,
        ...(appId && {
          application: {
            connect: {
              id: appId,
            },
          },
        }),
        ...(envId && {
          environment: {
            connect: {
              id: envId,
            },
          },
        }),
      },
      select: {
        key: true,
      },
    });
    return result.key;
  }

  async deleteToken({ token }: { token: string }): Promise<boolean> {
    const result = await this.prisma.token.delete({
      where: {
        key: token,
      },
    });

    return !!result;
  }
}

export default TokenRepository;
