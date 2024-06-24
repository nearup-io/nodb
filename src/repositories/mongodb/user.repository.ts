import BaseRepository from "./base.repository.ts";
import { type User } from "../../models/user.model.ts";
import type { IUserRepository } from "../interfaces.ts";

class UserRepository extends BaseRepository implements IUserRepository {
  constructor() {
    super();
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
    return this.userModel.create({
      clerkId,
      email,
      applications: [appName],
    });
  }
  public async updateUserLastUse({
    clerkId,
  }: {
    clerkId: string;
  }): Promise<Omit<User, "applications"> | null> {
    return this.userModel.findOneAndUpdate(
      { clerkId },
      {
        lastUse: Date.now(),
      },
      { returnNewDocument: true },
    );
  }

  public async findUserClerkId(
    id: string,
  ): Promise<Omit<User, "applications"> | null> {
    return this.userModel.findOne({ clerkId: id });
  }
}

export default UserRepository;
