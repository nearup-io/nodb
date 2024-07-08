import BaseRepository from "./base.repository.ts";
import type { PrismaClient } from "@prisma/client";
import type { ITokenRepository } from "../interfaces.ts";
import type { BackendTokenPermissions } from "../../utils/types.ts";

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
}

export default TokenRepository;
