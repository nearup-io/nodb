import * as R from "ramda";
import { type Application } from "../models/application.model";
import { APPLICATION_MONGO_DB_REPOSITORY, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import type Context from "../middlewares/context.ts";
import type { IApplicationRepository } from "../repositories/interfaces.ts";
import { type Environment } from "../models/environment.model.ts";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const getApplication = async ({
  context,
  appName,
  clerkId,
}: {
  context: Context;
  appName: string;
  clerkId: string;
}): Promise<
  Omit<Application, "environments"> & {
    environments: Pick<Environment, "_id" | "name" | "description">[];
  }
> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  const application = await repository.getApplication({ appName, clerkId });
  if (!application) {
    throw new ServiceError(httpError.APPNAME_NOT_FOUND);
  }
  return application;
};

const getUserApplications = async ({
  context,
  clerkId,
}: {
  context: Context;
  clerkId: string;
}): Promise<Application[]> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  return repository.getUserApplications({ clerkId });
};

const createApplication = async ({
  context,
  appName,
  clerkId,
  image,
  appDescription,
}: {
  context: Context;
  appName: string;
  clerkId: string;
  image: string;
  appDescription: string;
}): Promise<void> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  try {
    await repository.createApplication({
      appName,
      clerkId,
      image,
      appDescription,
    });
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
  clerkId: string;
  description?: string;
  image?: string;
}): Promise<Omit<Application, "environments"> | null> => {
  const repository = props.context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: props.newAppName,
    description: props.description,
    image: props.image,
  }) as { name?: string; description?: string; image?: string };

  try {
    return repository.updateApplication({
      oldAppName: props.oldAppName,
      clerkId: props.clerkId,
      updateProps,
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2001") {
      return null; // app does not exist prisma error
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
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  const application = await repository.getApplication({ appName, clerkId });
  if (!application) {
    throw new ServiceError(httpError.APP_CANT_DELETE);
  }

  try {
    return repository.deleteApplication({ appName, clerkId });
  } catch (e) {
    console.error("Error deleting application", e);
    throw new ServiceError(httpError.APP_CANT_DELETE);
  }
};

export {
  getApplication,
  getUserApplications,
  createApplication,
  updateApplication,
  deleteApplication,
};
