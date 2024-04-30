import type { IUserRepository } from "./UserRepository.interface.ts";
import { type User as UserType } from "../models/user.model.ts";

import { Repository } from "redis-om";
import userSchema from "../redis/schemas/user.schema.ts";
import type { RedisClientType } from "redis";
import { ObjectId } from "mongodb";

class UserRepositoryRedis implements IUserRepository {
  private repository: Repository;

  constructor(redis: RedisClientType) {
    this.repository = new Repository(userSchema, redis);
    this.repository.createIndex().then(() => console.log("index created"));
  }

  public async findOneAndUpdate(
    email: string,
    provider: string,
  ): Promise<UserType | null> {
    const user = await this.repository
      .search()
      .where("email")
      .equals(email)
      .return.first();

    // TODO update user when user exists
    if (user) return user as unknown as UserType; // TODO create a type checker or something

    const newUser: Omit<UserType, "_id"> & { _id: string } = {
      _id: "new-id",
      email,
      providers: [provider],
      applications: [],
      lastProvider: provider,
      lastUse: new Date(),
    };

    await this.repository.save(newUser);

    // TODO Create a common interface where id can be of a different type
    return { ...newUser, _id: new ObjectId() };
  }

  // albums = await albumRepository.search().where('artist').equals('Mushroomhead').return.all()
}

export default UserRepositoryRedis;
