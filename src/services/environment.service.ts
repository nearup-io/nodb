import * as R from "ramda";
import { type Environment } from "../models/environment.model";
import { ENVIRONMENT_REPOSITORY, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import type Context from "../utils/context.ts";
import { type IEnvironmentRepository } from "../repositories/interfaces.ts";

const findEnvironment = async ({
  context,
  envName,
  appName,
}: {
  context: Context;
  envName: string;
  appName: string;
}): Promise<Environment | null> => {
  const repository = context.get<IEnvironmentRepository>(
    ENVIRONMENT_REPOSITORY,
  );
  return repository.findEnvironment({ appName, envName });
};

const createEnvironment = async ({
  context,
  appName,
  envName,
  description = "",
}: {
  context: Context;
  envName: string;
  appName: string;
  description?: string;
}): Promise<Environment> => {
  const repository = context.get<IEnvironmentRepository>(
    ENVIRONMENT_REPOSITORY,
  );

  const existingEnvironment = await repository.findEnvironment({
    appName,
    envName,
  });
  if (existingEnvironment?.name) {
    throw new ServiceError(httpError.ENV_EXISTS, 400);
  }

  return repository.createEnvironment({ appName, envName, description });
};

const deleteEnvironment = async ({
  context,
  appName,
  envName,
}: {
  context: Context;
  appName: string;
  envName: string;
}): Promise<Environment | null> => {
  const repository = context.get<IEnvironmentRepository>(
    ENVIRONMENT_REPOSITORY,
  );
  const environment = await repository.findEnvironment({
    appName,
    envName,
  });

  if (!environment) return null;

  try {
    await repository.deleteEnvironment({
      appName,
      envName,
      environmentDbId: environment.id,
    });
    return environment;
  } catch (e) {
    throw new ServiceError(httpError.ENV_CANT_DELETE, 400);
  }
};

const updateEnvironment = async ({
  context,
  appName,
  newEnvName,
  oldEnvName,
  description,
}: {
  context: Context;
  appName: string;
  newEnvName: string;
  oldEnvName: string;
  description: string;
}): Promise<Environment> => {
  const repository = context.get<IEnvironmentRepository>(
    ENVIRONMENT_REPOSITORY,
  );

  if (oldEnvName === newEnvName) {
    throw new ServiceError(httpError.APPNAME_MUST_BE_UNIQUE, 400);
  }
  const environment = await repository.findEnvironment({
    appName,
    envName: oldEnvName,
  });
  if (!environment || !environment.name) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST, 404);
  }
  const newEnvironment = await repository.findEnvironment({
    appName,
    envName: newEnvName,
  });

  if (newEnvironment && newEnvironment.name && newEnvName !== oldEnvName) {
    throw new ServiceError(httpError.NEW_ENV_EXISTS, 400);
  }
  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: newEnvName,
    description,
  }) as { name?: string; description?: string };

  if (R.isEmpty(updateProps)) {
    throw new ServiceError(httpError.NO_UPDATE_PROPS, 400);
  }
  const updatedEnvironment = await repository.updateEnvironment({
    updateProps,
    databaseEnvironmentId: environment.id,
  });

  if (!updatedEnvironment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST, 404);
  }

  return updatedEnvironment;
};

export {
  findEnvironment,
  createEnvironment,
  deleteEnvironment,
  updateEnvironment,
};
