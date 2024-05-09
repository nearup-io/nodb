import * as R from "ramda";
import { type Application } from "../models/application.model";
import { APPLICATION_MONGO_DB_REPOSITORY, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import type Context from "../middlewares/context.ts";
import type { IApplicationRepository } from "../repositories/interfaces.ts";

const getApplication = async ({
  context,
  appName,
  userEmail,
}: {
  context: Context;
  appName: string;
  userEmail: string;
}): Promise<Application> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  const application = await repository.getApplication({ appName, userEmail });
  if (!application) {
    throw new ServiceError(httpError.APPNAME_NOT_FOUND);
  }
  return application;
};

const getUserApplications = async ({
  context,
  userEmail,
}: {
  context: Context;
  userEmail: string;
}): Promise<Application[]> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  return repository.getUserApplications({ userEmail });
};

const createApplication = async ({
  context,
  appName,
  userEmail,
  image,
  appDescription,
}: {
  context: Context;
  appName: string;
  userEmail: string;
  image: string;
  appDescription: string;
}): Promise<void> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  try {
    await repository.createApplication({
      appName,
      userEmail,
      image,
      appDescription,
    });
  } catch (e: any) {
    if (e.code === 11000) {
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
  userEmail: string;
  description?: string;
  image?: string;
}): Promise<Application | null> => {
  const repository = props.context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: props.newAppName,
    description: props.description,
    image: props.image,
  }) as { name?: string; description?: string; image?: string };

  try {
    const result = await repository.updateApplication({
      oldAppName: props.oldAppName,
      userEmail: props.userEmail,
      updateProps,
    });

    return result;
  } catch (e) {
    console.log("Error updating app", e);
    throw new ServiceError(httpError.UNKNOWN);
  }
};

const deleteApplication = async ({
  context,
  appName,
  userEmail,
}: {
  context: Context;
  appName: string;
  userEmail: string;
}): Promise<Application | null> => {
  const repository = context.get<IApplicationRepository>(
    APPLICATION_MONGO_DB_REPOSITORY,
  );

  try {
    return repository.deleteApplication({ appName, userEmail });
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
