import type { User } from "../models/user.model.ts";
import type Context from "../middlewares/context.ts";
import {
  defaultNodbEnv,
  ENVIRONMENT_MONGO_DB_REPOSITORY,
  httpError,
  USER_MONGO_DB_REPOSITORY,
} from "../utils/const.ts";
import type { IUserRepository } from "../repositories/interfaces.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { type User as ClerkUser } from "@clerk/backend";
import generateAppName from "../utils/app-name.ts";
import { EnvironmentRepository } from "../repositories/mongodb";

const updateUserTelegramId = async ({
  telegramId,
  context,
  clerkUserId,
}: {
  telegramId?: number;
  clerkUserId: string;
  context: Context;
}): Promise<User> => {
  const repository = context.get<IUserRepository>(USER_MONGO_DB_REPOSITORY);
  const user = await repository.updateUserTelegramId({
    clerkUserId,
    telegramId,
  });
  if (!user) {
    throw new ServiceError(httpError.USER_NOT_FOUND);
  }

  return user;
};

const findUserByEmail = async ({
  email,
  context,
}: {
  email: string;
  context: Context;
}): Promise<User | null> => {
  const repository = context.get<IUserRepository>(USER_MONGO_DB_REPOSITORY);
  return repository.findUserByEmail(email);
};

const findUserByClerkId = async ({
  id,
  context,
}: {
  id: string;
  context: Context;
}): Promise<User | null> => {
  const repository = context.get<IUserRepository>(USER_MONGO_DB_REPOSITORY);
  return repository.findUserClerkId(id);
};

const createOrFetchUser = async ({
  user,
  context,
}: {
  user: ClerkUser;
  context: Context;
}): Promise<User> => {
  const userEmail = user.primaryEmailAddress?.emailAddress;

  if (!userEmail) {
    throw new ServiceError(httpError.USER_DOES_NOT_HAVE_EMAIL);
  }

  const dbUser = await findUserByClerkId({ id: user.id, context });

  if (dbUser) {
    return dbUser;
  }
  const repository = context.get<IUserRepository>(USER_MONGO_DB_REPOSITORY);
  const appName = generateAppName();
  const environmentRepository = context.get<EnvironmentRepository>(
    ENVIRONMENT_MONGO_DB_REPOSITORY,
  );

  await environmentRepository.createEnvironment({
    appName,
    envName: defaultNodbEnv,
  });

  return repository.createUser({
    clerkUserId: user.id,
    email: userEmail,
    appName,
  });
};

export {
  updateUserTelegramId,
  createOrFetchUser,
  findUserByEmail,
  findUserByClerkId,
};
