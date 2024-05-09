import mongoose from "mongoose";
import BaseRepository from "./base-repository.ts";
import { type User } from "../../models/user.model.ts";

class UserRepository extends BaseRepository {
  constructor(readonly conn: mongoose.Connection) {
    super(conn);
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
}

export default UserRepository;
