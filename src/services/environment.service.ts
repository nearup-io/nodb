import * as R from "ramda";
import { type Environment } from "../models/environment.model";
import { ENVIRONMENT_REPOSITORY, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import type Context from "../middlewares/context.ts";
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
    throw new ServiceError(httpError.ENV_EXISTS);
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
}) => {
  const repository = context.get<IEnvironmentRepository>(
    ENVIRONMENT_REPOSITORY,
  );
  const environment = await repository.findEnvironment({
    appName,
    envName,
  });

  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }

  try {
    await repository.deleteEnvironment({
      appName,
      envName,
      environmentDbId: environment._id.toString(),
    });
    return environment;
  } catch (e) {
    console.error("Error deleting environment", e);
    throw new ServiceError(httpError.ENV_CANT_DELETE);
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
    throw new ServiceError("Names cannot be the same");
  }
  const environment = await repository.findEnvironment({
    appName,
    envName: oldEnvName,
  });
  if (!environment || !environment.name) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const newEnvironment = await repository.findEnvironment({
    appName,
    envName: newEnvName,
  });

  if (newEnvironment && newEnvironment.name && newEnvName !== oldEnvName) {
    throw new ServiceError(httpError.NEW_ENV_EXISTS);
  }
  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: newEnvName,
    description,
  }) as { name?: string; description?: string };

  if (R.isEmpty(updateProps)) {
    throw new ServiceError(httpError.NO_UPDATE_PROPS);
  }
  const updatedEnvironment = await repository.updateEnvironment({
    updateProps,
    databaseEnvironmentId: environment._id.toString(),
  });

  if (!updatedEnvironment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }

  return updatedEnvironment;
};

export {
  findEnvironment,
  createEnvironment,
  deleteEnvironment,
  updateEnvironment,
};
