import mongoose from "mongoose";
import * as R from "ramda";
import ApplicationModel from "../models/application.model";
import EntityModel from "../models/entity.model";
import EnvironmentModel, {
  type Environment,
} from "../models/environment.model";
import generateToken from "../utils/backend-token";
import { Permissions, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import config from "../config";

export const getEnvironmentsByAppName = async (appName: string) => {
  const applicationEnvironments = await ApplicationModel.aggregate([
    { $match: { name: appName } },
    {
      $lookup: {
        from: "environments",
        localField: "environments",
        foreignField: "_id",
        as: "environments",
      },
    },
    { $unwind: "$environments" },
    {
      $project: {
        name: "$environments.name",
        tokens: "$environments.tokens",
        entities: "$environments.entities",
        description: "$environments.description",
        _id: 0,
      },
    },
  ]);
  return applicationEnvironments;
};

export const findEnvironment = async ({
  envName,
  appName,
}: {
  envName: string;
  appName: string;
}): Promise<Environment | undefined> => {
  const applicationEnvironments = await ApplicationModel.aggregate<Environment>(
    [
      {
        $match: { name: appName },
      },
      {
        $lookup: {
          from: "environments",
          localField: "environments",
          foreignField: "_id",
          as: "environments",
        },
      },
      { $unwind: "$environments" },
      {
        $match: { "environments.name": envName },
      },
      {
        $project: {
          name: "$environments.name",
          tokens: "$environments.tokens",
          description: "$environments.description",
          _id: "$environments._id",
          entities: "$environments.entities",
        },
      },
    ]
  );
  return applicationEnvironments[0];
};

export const createEnvironment = async ({
  appName,
  envName,
  description = "",
}: {
  envName: string;
  appName: string;
  description: string;
}) => {
  const existingEnvironment = await findEnvironment({ appName, envName });
  if (existingEnvironment?.name) {
    throw new ServiceError(httpError.ENV_EXISTS);
  }
  const environment = await EnvironmentModel.create({
    name: envName,
    tokens: [
      {
        key: generateToken(),
        permission: Permissions.ALL,
      },
    ],
    entities: [],
    description,
  });
  await ApplicationModel.findOneAndUpdate(
    { name: appName },
    { $addToSet: { environments: environment._id } }
  );
  return environment;
};

export const deleteEnvironment = async ({
  appName,
  envName,
}: {
  appName: string;
  envName: string;
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await EntityModel.deleteMany(
      { type: { $regex: `${appName}/${envName}/` } },
      { session }
    );
    await EnvironmentModel.findByIdAndDelete(environment._id, { session });
    await ApplicationModel.findOneAndUpdate(
      { name: appName },
      {
        $pull: { environments: environment._id },
      },
      { session }
    );
    await session.commitTransaction();
    return environment;
  } catch (e) {
    console.error("Error deleting environment", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.ENV_CANT_DELETE);
  } finally {
    await session.endSession();
  }
};

export const updateEnvironment = async ({
  appName,
  newEnvName,
  oldEnvName,
  description,
}: {
  appName: string;
  newEnvName: string;
  oldEnvName: string;
  description: string;
}) => {
  const environment = (await findEnvironment({
    appName,
    envName: oldEnvName,
  })) as Environment;
  if (!environment.name) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const newEnvironment = (await findEnvironment({
    appName,
    envName: newEnvName,
  })) as Environment;
  if (newEnvironment.name && newEnvName !== oldEnvName) {
    throw new ServiceError(httpError.NEW_ENV_EXISTS);
  }
  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: newEnvName,
    description,
  }) as { name?: string; description?: string };
  if (R.isEmpty(updateProps)) {
    throw new ServiceError(httpError.NO_UPDATE_PROPS);
  }
  const doc: Environment | null = await EnvironmentModel.findByIdAndUpdate(
    environment._id,
    { ...updateProps },
    { returnDocument: "after", new: true }
  );
  return doc;
};
