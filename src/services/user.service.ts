import type { User } from "../models/user.model.ts";
import type Context from "../middlewares/context.ts";
import {
  defaultNodbEnv,
  ENVIRONMENT_REPOSITORY,
  httpError,
  USER_REPOSITORY,
} from "../utils/const.ts";
import type { IUserRepository } from "../repositories/interfaces.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { type User as ClerkUser } from "@clerk/backend";
import generateAppName from "../utils/app-name.ts";
import { EnvironmentRepository } from "../repositories/mongodb";

const findUserByClerkId = async ({
  id,
  context,
}: {
  id: string;
  context: Context;
}): Promise<Omit<User, "applications"> | null> => {
  const repository = context.get<IUserRepository>(USER_REPOSITORY);
  return repository.findUserClerkId(id);
};

const createOrFetchUser = async ({
  user,
  context,
}: {
  user: ClerkUser;
  context: Context;
}): Promise<Omit<User, "applications">> => {
  const userEmail = user.primaryEmailAddress?.emailAddress;

  if (!userEmail) {
    throw new ServiceError(httpError.USER_DOES_NOT_HAVE_EMAIL);
  }

  const dbUser = await findUserByClerkId({ id: user.id, context });

  if (dbUser) {
    return dbUser;
  }
  const repository = context.get<IUserRepository>(USER_REPOSITORY);
  const appName = generateAppName();
  const environmentRepository = context.get<EnvironmentRepository>(
    ENVIRONMENT_REPOSITORY,
  );

  await environmentRepository.createEnvironment({
    appName,
    envName: defaultNodbEnv,
  });

  return repository.createUser({
    clerkId: user.id,
    email: userEmail,
    appName,
  });
};

export { createOrFetchUser, findUserByClerkId };
