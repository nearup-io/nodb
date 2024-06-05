import BaseRepository from "./base-repository.ts";
import { type User } from "../../models/user.model.ts";
import type { IUserRepository } from "../interfaces.ts";
import * as R from "ramda";
import type { TelegramSettings } from "../../utils/types.ts";

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
    const result = await this.userModel.create({
      email,
      clerkUserId,
      applications: [appName],
    });

    // convert null values to undefined
    return R.defaultTo(undefined, result) as User;
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

  public async updateUserTelegramSettings({
    clerkUserId,
    telegramSettings,
  }: {
    clerkUserId: string;
    telegramSettings?: TelegramSettings;
  }): Promise<User | null> {
    const updateObj = telegramSettings?.telegramId
      ? {
          "telegram.id": telegramSettings.telegramId,
          "telegram.appName": telegramSettings.appName,
          "telegram.envName": telegramSettings.envName,
        }
      : { telegram: undefined };

    return this.userModel.findOneAndUpdate(
      { clerkUserId },
      {
        ...updateObj,
      },
      { returnNewDocument: true },
    );
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email });
  }

  public async findUserClerkId(id: string): Promise<User | null> {
    return this.userModel.findOne({ clerkUserId: id });
  }

  public async findUserByTelegramId(id: number): Promise<User | null> {
    return this.userModel.findOne({ "telegram.id": id });
  }
}

export default UserRepository;
