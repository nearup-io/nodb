import { HTTPException } from "hono/http-exception";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import * as R from "ramda";
import ApplicationModel, {
  type Application,
} from "../models/application.model";
import EntityModel from "../models/entity.model";
import EnvironmentModel, {
  type Environment,
} from "../models/environment.model";
import User from "../models/user.model";
import generateToken from "../utils/backend-token";
import { httpError, Permissions } from "../utils/const";
import { ServiceError } from "../utils/service-errors";

export const getApplication = async ({
  appName,
  userEmail,
}: {
  appName: string;
  userEmail: string;
}) => {
  const userApplications = await User.aggregate([
    {
      $match: {
        $and: [
          { email: userEmail },
          { $expr: { $in: [appName, "$applications"] } },
        ],
      },
    },
    { $limit: 1 },
    {
      $lookup: {
        from: "applications",
        localField: "applications",
        foreignField: "name",
        as: "applications",
      },
    },
    { $unwind: "$applications" },
    {
      $match: { "applications.name": appName },
    },
    {
      $lookup: {
        from: "environments",
        localField: "applications.environments",
        foreignField: "_id",
        as: "environments",
      },
    },
    {
      $project: {
        name: "$applications.name",
        image: "$applications.image",
        description: "$applications.description",
        "environments.name": 1,
        "environments.tokens": 1,
        "environments.description": 1,
        _id: 0,
      },
    },
  ]);

  if (!userApplications.length) {
    throw new HTTPException(404, {
      message: "Application not found",
    });
  }

  return userApplications[0];
};

const getEnvironmentsByAppName = async (appName: string) => {
  const applicationEnvironments = await ApplicationModel.aggregate<Environment>(
    [
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
          _id: "$environments._id",
        },
      },
    ],
  );
  return applicationEnvironments;
};

export const getUserApplications = async ({
  userEmail,
}: {
  userEmail: string;
}) => {
  const userApplications = await User.aggregate([
    { $match: { email: userEmail } },
    { $limit: 1 },
    {
      $lookup: {
        from: "applications",
        localField: "applications",
        foreignField: "name",
        as: "applications",
      },
    },
    { $unwind: "$applications" },
    {
      $lookup: {
        from: "environments",
        localField: "applications.environments",
        foreignField: "_id",
        as: "applications.environments",
      },
    },
    { $unwind: "$applications" },
    {
      $project: {
        name: "$applications.name",
        image: "$applications.image",
        description: "$applications.description",
        environments: {
          $map: {
            input: "$applications.environments",
            as: "environment",
            in: {
              name: "$$environment.name",
              tokens: "$$environment.tokens",
              entities: "$$environment.entities",
            },
          },
        },
        _id: 0,
      },
    },
  ]);
  return userApplications;
};

export const createApplication = async ({
  appName,
  userEmail,
  image,
  appDescription,
}: {
  appName: string;
  userEmail: string;
  image: string;
  appDescription: string;
}) => {
  const environment = await EnvironmentModel.create({
    name: Bun.env.NODB_ENV,
    tokens: [
      {
        key: generateToken(),
        permission: Permissions.ALL,
      },
    ],
    entities: [],
    description: "",
  });
  try {
    await ApplicationModel.create({
      name: appName,
      image,
      description: appDescription,
      environments: [new ObjectId(environment._id)],
    });
  } catch (err: any) {
    if (err.code === 11000) {
      throw new ServiceError(httpError.APPNAME_EXISTS);
    }
  }
  await User.findOneAndUpdate(
    { email: userEmail },
    { $addToSet: { applications: appName } },
  );
};

export const updateApplication = async (props: {
  oldAppName: string;
  newAppName?: string;
  userEmail: string;
  description?: string;
  image?: string;
}) => {
  const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
    name: props.newAppName,
    description: props.description,
    image: props.image,
  }) as { name?: string; description?: string; image?: string };
  const doc = await ApplicationModel.findOneAndUpdate(
    { name: props.oldAppName },
    { ...updateProps },
  );
  if (
    doc &&
    props.oldAppName !== props.newAppName &&
    R.is(String, props.newAppName)
  ) {
    await User.findOneAndUpdate(
      { email: props.userEmail, applications: props.oldAppName },
      { $set: { "applications.$": props.newAppName } },
    );
  }
  return doc;
};

export const deleteApplication = async ({
  appName,
  userEmail,
}: {
  appName: string;
  userEmail: string;
}) => {
  const envs = await getEnvironmentsByAppName(appName);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const app = await ApplicationModel.findOneAndDelete<Application>(
      { name: appName },
      { session },
    );
    if (app && app._id) {
      await EnvironmentModel.deleteMany(
        {
          _id: { $in: envs.map((e) => e._id) },
        },
        { session },
      );
      await User.findOneAndUpdate(
        { email: userEmail },
        {
          $pull: { applications: appName },
        },
        { session },
      );
      await EntityModel.deleteMany(
        { type: { $regex: `^${appName}/` } },
        { session },
      );
      await session.commitTransaction();
    }
    return app;
  } catch (e) {
    console.error("Error deleting application", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.APP_CANT_DELETE);
  } finally {
    await session.endSession();
  }
};
