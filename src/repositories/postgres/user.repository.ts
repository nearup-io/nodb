import BaseRepository from "./base-repository.ts";
import { type User } from "../../models/user.model.ts";
import type { IUserRepository } from "../interfaces.ts";
import type { PrismaClient } from "@prisma/client";

class UserRepository extends BaseRepository implements IUserRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  public async createUser({
    clerkId,
    appName,
    email,
  }: {
    clerkId: string;
    appName: string;
    email: string;
  }): Promise<Omit<User, "applications">> {
    // TODO verify appName is actually added
    return this.prisma.user.create({
      data: {
        clerkId,
        email,
        lastUse: new Date(),
        applications: {
          connect: {
            name: appName,
          },
        },
      },
      select: {
        applications: false,
        clerkId: true,
        email: true,
        lastUse: true,
      },
    });
  }
  public async updateUserLastUse({
    clerkId,
  }: {
    clerkId: string;
  }): Promise<Omit<User, "applications"> | null> {
    return this.prisma.user.update({
      data: {
        lastUse: new Date(),
      },
      where: {
        clerkId,
      },
      select: {
        applications: false,
        clerkId: true,
        email: true,
        lastUse: true,
      },
    });
  }

  public async findUserClerkId(
    id: string,
  ): Promise<Omit<User, "applications"> | null> {
    return this.prisma.user.findFirst({
      where: { clerkId: id },
      select: {
        applications: false,
        clerkId: true,
        email: true,
        lastUse: true,
      },
    });
  }
}

export default UserRepository;
