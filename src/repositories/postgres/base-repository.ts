import type { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/binary";

abstract class BaseRepository {
  protected constructor(protected readonly prisma: PrismaClient) {}

  protected async transaction<T>(
    callback: (tx: Omit<PrismaClient, ITXClientDenyList>) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return callback(tx);
    });
  }
}

export default BaseRepository;
