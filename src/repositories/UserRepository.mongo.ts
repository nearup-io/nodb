import User, { type User as UserType } from "../models/user.model.ts";
import type { IUserRepository } from "./UserRepository.interface.ts";

class UserRepository implements IUserRepository {
  private model = User;

  public async findOneAndUpdate(
    email: string,
    provider: string,
  ): Promise<UserType | null> {
    return this.model.findOneAndUpdate(
      { email },
      { $addToSet: { providers: provider }, $set: { lastProvider: provider } },
      { returnNewDocument: true },
    );
  }
}

export default UserRepository;
