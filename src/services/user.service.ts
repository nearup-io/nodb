import type { User } from "../models/user.model.ts";
import type Context from "../middlewares/context.ts";
import { httpError, USER_MONGO_DB_REPOSITORY } from "../utils/const.ts";
import type { IUserRepository } from "../repositories/interfaces.ts";
import { ServiceError } from "../utils/service-errors.ts";

const updateUserTelegramId = async ({
  telegramId,
  context,
  email,
}: {
  telegramId?: number;
  email: string;
  context: Context;
}): Promise<User> => {
  const repository = context.get<IUserRepository>(USER_MONGO_DB_REPOSITORY);
  const user = await repository.updateUserTelegramId({ email, telegramId });
  if (!user) {
    throw new ServiceError(httpError.USER_NOT_FOUND);
  }

  return user;
};

export { updateUserTelegramId };
