import type { User } from "../models/user.model.ts";
import type Context from "../utils/context.ts";
import { type Context as HonoContext } from "hono";
import {
  APPLICATION_REPOSITORY,
  httpError,
  USER_REPOSITORY,
} from "../utils/const.ts";
import type {
  IApplicationRepository,
  IUserRepository,
} from "../repositories/interfaces.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { type ClerkClient, type User as ClerkUser } from "@clerk/backend";
import generateAppName from "../utils/app-name.ts";
import { getAuth } from "@hono/clerk-auth";

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
  const createdUser = await repository.createUser({
    clerkId: user.id,
    email: userEmail,
    appName,
  });

  const appRepository = context.get<IApplicationRepository>(
    APPLICATION_REPOSITORY,
  );

  // default environment is already created here
  await appRepository.createApplication({
    clerkId: user.id,
    appName,
  });

  return createdUser;
};

const getUserFromClerk = async (
  clerkClient: ClerkClient,
  c: HonoContext,
): Promise<ClerkUser | undefined> => {
  const auth = getAuth(c);
  if (!auth?.userId) return;

  const clerkUser = await clerkClient.users.getUser(auth.userId);
  if (!clerkUser) return;

  return clerkUser;
};

export { createOrFetchUser, findUserByClerkId, getUserFromClerk };
