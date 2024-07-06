import * as R from "ramda";
import { type Application } from "../models/application.model";
import { APPLICATION_REPOSITORY, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import type Context from "../utils/context.ts";
import type { IApplicationRepository } from "../repositories/interfaces.ts";
import { type Environment } from "../models/environment.model.ts";
import { type Token } from "../models/token.model.ts";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { BackendTokenPermissions } from "../utils/types.ts";

const getApplication = async ({
  context,
  appName,
  clerkId,
  tokenPermissions,
}: {
  context: Context;
  appName: string;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
}): Promise<
  Omit<Application, "environments"> & {
    environments: Pick<Environment, "id" | "name" | "description">[];
  }
> => {
  if (!clerkId && !tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED);
  }

  const repository = context.get<IApplicationRepository>(
    APPLICATION_REPOSITORY,
  );

  const application = await repository.getApplication({
    appName,
    clerkId,
    token: tokenPermissions?.token,
  });
  if (!application) {
    throw new ServiceError(httpError.APPNAME_NOT_FOUND);
  }
  return application;
};

const getApplications = async ({
  context,
  clerkId,
  tokenPermissions,
}: {
  context: Context;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
}): Promise<
  (Omit<Application, "id" | "environments"> & {
    environments: Omit<Environment, "id" | "description">[];
  })[]
> => {
  if (!clerkId && !tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED);
  }

  const repository = context.get<IApplicationRepository>(
    APPLICATION_REPOSITORY,
  );

  if (clerkId) {
    return repository.getUserApplications({ clerkId });
  } else {
    const app = await repository.getTokenApplication({
      tokenPermissions: tokenPermissions!,
    });
    if (!app) return [];
    return [app];
  }
};

const createApplication = async ({
  context,
  appName,
  clerkId,
  image,
  appDescription,
  environmentName,
  environmentDescription,
}: {
  context: Context;
  appName: string;
  clerkId?: string;
  image: string;
  appDescription: string;
  environmentName?: string;
  environmentDescription?: string;
}): Promise<{
  applicationName: string;
  environmentName: string;
  applicationTokens: Token[];
  environmentTokens: Token[];
}> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_REPOSITORY,
  );

  try {
    const result = await repository.createApplication({
      appName,
      clerkId,
      image,
      appDescription,
      environmentName,
      environmentDescription,
    });
    return result;
  } catch (e: any) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ServiceError(httpError.APPNAME_EXISTS);
    } else if (e.code === 11000) {
      throw new ServiceError(httpError.APPNAME_EXISTS);
    } else {
      console.log("Error creating app", e);
      throw new ServiceError(httpError.UNKNOWN);
    }
  }
};

const updateApplication = async (props: {
  context: Context;
  oldAppName: string;
  newAppName?: string;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
  description?: string;
  image?: string;
}): Promise<Omit<Application, "environments" | "tokens"> | null> => {
  if (!props.clerkId && !props.tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED);
  }
  const repository = props.context.get<IApplicationRepository>(
    APPLICATION_REPOSITORY,
  );

  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: props.newAppName,
    description: props.description,
    image: props.image,
  }) as { name?: string; description?: string; image?: string };

  try {
    return await repository.updateApplication({
      oldAppName: props.oldAppName,
      clerkId: props.clerkId,
      token: props.tokenPermissions?.token,
      updateProps,
    });
  } catch (e) {
    if (
      e instanceof PrismaClientKnownRequestError &&
      ["P2001", "P2025"].includes(e.code)
    ) {
      return null; // app does not exist prisma errors
    }
    console.log("Error updating app", e);
    throw new ServiceError(httpError.UNKNOWN);
  }
};

const deleteApplication = async ({
  context,
  clerkId,
  appName,
}: {
  context: Context;
  appName: string;
  clerkId: string;
}): Promise<Omit<Application, "environments"> | null> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_REPOSITORY,
  );
  const application = await repository.getApplication({ appName, clerkId });
  if (!application) {
    throw new ServiceError(httpError.APP_DOESNT_EXIST);
  }

  try {
    return repository.deleteApplication({
      appName,
      clerkId,
      dbAppId: application.id,
    });
  } catch (e) {
    console.error("Error deleting application", e);
    throw new ServiceError(httpError.APP_CANT_DELETE);
  }
};

export {
  getApplication,
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
};
