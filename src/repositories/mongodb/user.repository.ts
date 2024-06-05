import BaseRepository from "./base-repository.ts";
import { type User } from "../../models/user.model.ts";
import type { IUserRepository } from "../interfaces.ts";

class UserRepository extends BaseRepository implements IUserRepository {
  constructor() {
    super();
  }

  public async createUser({
    clerkId,
    appName,
  }: {
    clerkId: string;
    appName: string;
  }): Promise<User> {
    return this.userModel.create({
      clerkId,
      applications: [appName],
    });
  }
  public async updateUserLastUse({
    clerkId,
  }: {
    clerkId: string;
  }): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { clerkId },
      {
        lastUse: Date.now(),
      },
      { returnNewDocument: true },
    );
  }

  public async findUserClerkId(id: string): Promise<User | null> {
    return this.userModel.findOne({ clerkUserId: id });
  }
}

export default UserRepository;
