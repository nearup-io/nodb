import BaseRepository from "./base-repository.ts";
import { type User } from "../../models/user.model.ts";
import type { IUserRepository } from "../interfaces.ts";

class UserRepository extends BaseRepository implements IUserRepository {
  constructor() {
    super();
  }

  public async createUser({
    clerkUserId,
    email,
    appName,
  }: {
    clerkUserId: string;
    email: string;
    appName: string;
  }): Promise<User> {
    return this.userModel.create({
      email,
      clerkUserId,
      applications: [appName],
    });
  }

  public async updateUserLastUse({
    clerkUserId,
  }: {
    clerkUserId: string;
  }): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { clerkUserId },
      {
        lastUse: Date.now(),
      },
      { returnNewDocument: true },
    );
  }

  public async updateUserTelegramId({
    clerkUserId,
    telegramId,
  }: {
    clerkUserId: string;
    telegramId?: number;
  }): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { clerkUserId },
      { telegramId },
      { returnNewDocument: true },
    );
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email });
  }

  public async findUserClerkId(id: string): Promise<User | null> {
    return this.userModel.findOne({ clerkUserId: id });
  }
}

export default UserRepository;
