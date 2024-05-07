import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import * as R from "ramda";
import {
  getApplicationModel,
  getEntityModel,
  getEnvironmentModel,
  getUserModel,
} from "../connections/connect";
import { type Application } from "../models/application.model";
import { type Environment } from "../models/environment.model";
import generateToken from "../utils/backend-token";
import { defaultNodbEnv, httpError, Permissions } from "../utils/const";
import { ServiceError } from "../utils/service-errors";

class ApplicationService {
  private async getEnvironmentsByAppName(
    conn: mongoose.Connection,
    appName: string,
  ): Promise<Environment[]> {
    return getApplicationModel(conn).aggregate<Environment>([
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
    ]);
  }

  public async getApplication({
    conn,
    appName,
    userEmail,
  }: {
    conn: mongoose.Connection;
    appName: string;
    userEmail: string;
  }): Promise<Application> {
    const userApplications = await getUserModel(conn).aggregate([
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
      throw new ServiceError(httpError.APPNAME_NOT_FOUND);
    }
    return userApplications[0];
  }

  public async getUserApplications({
    conn,
    userEmail,
  }: {
    conn: mongoose.Connection;
    userEmail: string;
  }) {
    return getUserModel(conn).aggregate([
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
  }

  public async createApplication({
    conn,
    appName,
    userEmail,
    image,
    appDescription,
  }: {
    conn: mongoose.Connection;
    appName: string;
    userEmail: string;
    image: string;
    appDescription: string;
  }): Promise<void> {
    const session = await conn.startSession();
    session.startTransaction();
    try {
      const environment = await getEnvironmentModel(conn).create(
        [
          {
            name: defaultNodbEnv,
            tokens: [
              {
                key: generateToken(),
                permission: Permissions.ALL,
              },
            ],
            entities: [],
            description: "",
          },
        ],
        { session },
      );
      await getApplicationModel(conn).create(
        [
          {
            name: appName,
            image,
            description: appDescription,
            environments: [new ObjectId(environment[0]._id)],
          },
        ],
        { session },
      );
      await getUserModel(conn).findOneAndUpdate(
        { email: userEmail },
        { $addToSet: { applications: appName } },
        { session },
      );
      await session.commitTransaction();
    } catch (e: any) {
      await session.abortTransaction();
      if (e.code === 11000) {
        throw new ServiceError(httpError.APPNAME_EXISTS);
      } else {
        console.log("Error creating app", e);
        throw new ServiceError(httpError.UNKNOWN);
      }
    } finally {
      await session.endSession();
    }
  }

  public async updateApplication(props: {
    conn: mongoose.Connection;
    oldAppName: string;
    newAppName?: string;
    userEmail: string;
    description?: string;
    image?: string;
  }) {
    const session = await props.conn.startSession();
    session.startTransaction();
    const updateProps = R.pickBy(R.pipe(R.isNil, R.not), {
      name: props.newAppName,
      description: props.description,
      image: props.image,
    }) as { name?: string; description?: string; image?: string };
    try {
      const doc = await getApplicationModel(props.conn).findOneAndUpdate(
        { name: props.oldAppName },
        { ...updateProps },
        { session },
      );
      if (
        doc &&
        props.oldAppName !== props.newAppName &&
        R.is(String, props.newAppName)
      ) {
        await getUserModel(props.conn).findOneAndUpdate(
          { email: props.userEmail, applications: props.oldAppName },
          { $set: { "applications.$": props.newAppName } },
          { session },
        );
      }
      await session.commitTransaction();
      return doc;
    } catch (e) {
      console.log("Error updating app", e);
      await session.abortTransaction();
      throw new ServiceError(httpError.UNKNOWN);
    } finally {
      await session.endSession();
    }
  }

  public async deleteApplication({
    conn,
    appName,
    userEmail,
  }: {
    conn: mongoose.Connection;
    appName: string;
    userEmail: string;
  }) {
    const envs = await this.getEnvironmentsByAppName(conn, appName);
    const session = await conn.startSession();
    session.startTransaction();
    try {
      const app = await getApplicationModel(conn).findOneAndDelete<Application>(
        { name: appName },
        { session },
      );
      if (app && app._id) {
        await getEnvironmentModel(conn).deleteMany(
          {
            _id: { $in: envs.map((e) => e._id) },
          },
          { session },
        );
        await getUserModel(conn).findOneAndUpdate(
          { email: userEmail },
          {
            $pull: { applications: appName },
          },
          { session },
        );
        await getEntityModel(conn).deleteMany(
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
  }
}

export default ApplicationService;
