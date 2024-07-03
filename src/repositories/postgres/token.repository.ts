import BaseRepository from "./base.repository.ts";
import type { PrismaClient } from "@prisma/client";
import type { ITokenRepository } from "../interfaces.ts";
import type { Token } from "../../models/environment.model.ts";

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
}

export default TokenRepository;
