import BaseRepository from "./base-repository.ts";
import { type User } from "../../models/user.model.ts";
import type { IUserRepository } from "../interfaces.ts";

class UserRepository extends BaseRepository implements IUserRepository {
  constructor() {
    super();
  }

  public async createUser({
    provider,
    email,
    appName,
  }: {
    provider: string;
    email: string;
    appName: string;
  }): Promise<User> {
    return this.userModel.create({
      email,
      providers: [provider],
      lastProvider: provider,
      applications: [appName],
    });
  }

  public async updateUser({
    provider,
    email,
  }: {
    provider: string;
    email: string;
  }): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { email },
      {
        $addToSet: { providers: provider },
        $set: { lastProvider: provider },
      },
      { returnNewDocument: true },
    );
  }

  public async updateUserTelegramId({
    email,
    telegramId,
  }: {
    email: string;
    telegramId?: number;
  }): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { email },
      { telegramId },
      { returnNewDocument: true },
    );
  }
}

export default UserRepository;