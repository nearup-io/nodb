import { type User as UserType } from "../models/user.model";

export interface IUserRepository {
  findOneAndUpdate(email: string, provider: string): Promise<UserType | null>;
}
