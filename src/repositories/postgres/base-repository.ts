import type { PrismaClient } from "@prisma/client";

abstract class BaseRepository {
  protected constructor(protected readonly prisma: PrismaClient) {}

  protected async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return 1 as T;
  }
}

export default BaseRepository;
