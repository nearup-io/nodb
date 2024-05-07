import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import * as R from "ramda";
import {
  getApplicationModel,
  getEntityModel,
  getEnvironmentModel,
  getUserModel,
} from "../../connections/connect.ts";
import { type Application } from "../../models/application.model.ts";
import { type Environment } from "../../models/environment.model.ts";
import generateToken from "../../utils/backend-token.ts";
import { defaultNodbEnv, Permissions } from "../../utils/const.ts";
import BaseRepository from "./base-repository.ts";

class ApplicationRepository extends BaseRepository {
  constructor(readonly conn: mongoose.Connection) {
    super(conn);
  }

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
    appName,
    userEmail,
  }: {
    appName: string;
    userEmail: string;
  }): Promise<Application | undefined> {
    const userApplications = await getUserModel(this.conn).aggregate([
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
    return userApplications?.[0];
  }

  public async getUserApplications({
    userEmail,
  }: {
    userEmail: string;
  }): Promise<Application[]> {
    return getUserModel(this.conn).aggregate<Application>([
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
    appName,
    userEmail,
    image,
    appDescription,
  }: {
    appName: string;
    userEmail: string;
    image: string;
    appDescription: string;
  }): Promise<void> {
    await this.transaction<void>(async (session) => {
      const environment = await getEnvironmentModel(this.conn).create(
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
      await getApplicationModel(this.conn).create(
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
      await getUserModel(this.conn).findOneAndUpdate(
        { email: userEmail },
        { $addToSet: { applications: appName } },
        { session },
      );
    });
  }

  public async updateApplication(props: {
    oldAppName: string;
    userEmail: string;
    updateProps: {
      newAppName?: string;
      description?: string;
      image?: string;
    };
  }): Promise<Application | null> {
    const result = await this.transaction<Application | null>(
      async (session) => {
        const doc = await getApplicationModel(this.conn).findOneAndUpdate(
          { name: props.oldAppName },
          { ...props.updateProps },
          { session },
        );
        if (
          doc &&
          props.oldAppName !== props.updateProps.newAppName &&
          R.is(String, props.updateProps.newAppName)
        ) {
          await getUserModel(this.conn).findOneAndUpdate(
            { email: props.userEmail, applications: props.oldAppName },
            { $set: { "applications.$": props.updateProps.newAppName } },
            { session },
          );
        }
        return doc;
      },
    );
    return result;
  }

  public async deleteApplication({
    appName,
    userEmail,
  }: {
    appName: string;
    userEmail: string;
  }): Promise<Application | null> {
    const envs = await this.getEnvironmentsByAppName(this.conn, appName);

    return this.transaction<Application | null>(async (session) => {
      const app = await getApplicationModel(
        this.conn,
      ).findOneAndDelete<Application>({ name: appName }, { session });
      if (app && app._id) {
        await getEnvironmentModel(this.conn).deleteMany(
          {
            _id: { $in: envs.map((e) => e._id) },
          },
          { session },
        );
        await getUserModel(this.conn).findOneAndUpdate(
          { email: userEmail },
          {
            $pull: { applications: appName },
          },
          { session },
        );
        await getEntityModel(this.conn).deleteMany(
          { type: { $regex: `^${appName}/` } },
          { session },
        );
        await session.commitTransaction();
      }
      return app;
    });
  }
}

export default ApplicationRepository;
