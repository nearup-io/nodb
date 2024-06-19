import { ObjectId } from "mongodb";
import * as R from "ramda";
import { type Application } from "../../models/application.model.ts";
import { type Environment } from "../../models/environment.model.ts";
import generateToken from "../../utils/backend-token.ts";
import { defaultNodbEnv, Permissions } from "../../utils/const.ts";
import BaseRepository from "./base.repository.ts";
import type { IApplicationRepository } from "../interfaces.ts";

class ApplicationRepository
  extends BaseRepository
  implements IApplicationRepository
{
  constructor() {
    super();
  }

  private async getEnvironmentsByAppName(
    appName: string,
  ): Promise<Environment[]> {
    return this.applicationModel.aggregate<Environment>([
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
          id: "$environments._id",
        },
      },
    ]);
  }

  public async getApplication({
    appName,
    clerkId,
  }: {
    appName: string;
    clerkId: string;
  }): Promise<Application | null> {
    const userApplications = await this.userModel.aggregate<Application>([
      {
        $match: {
          $and: [{ clerkId }, { $expr: { $in: [appName, "$applications"] } }],
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
          id: "$applications._id",
          name: "$applications.name",
          image: "$applications.image",
          description: "$applications.description",
          "environments.id": "$environments._id",
          "environments.name": 1,
          "environments.tokens": 1,
          "environments.description": 1,
        },
      },
    ]);
    return userApplications?.[0] || null;
  }

  public async getUserApplications({
    clerkId,
  }: {
    clerkId: string;
  }): Promise<Application[]> {
    return this.userModel.aggregate<Application>([
      { $match: { clerkId } },
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
    clerkId,
    image,
    appDescription,
  }: {
    appName: string;
    clerkId: string;
    image?: string;
    appDescription?: string;
  }): Promise<void> {
    await this.transaction<void>(async (session) => {
      const environment = await this.environmentModel.create(
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
      await this.applicationModel.create(
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
      await this.userModel.findOneAndUpdate(
        { clerkId },
        { $addToSet: { applications: appName } },
        { session },
      );
    });
  }

  public async updateApplication(props: {
    oldAppName: string;
    clerkId: string;
    updateProps: {
      newAppName?: string;
      description?: string;
      image?: string;
    };
  }): Promise<Omit<Application, "environments"> | null> {
    return this.transaction<Omit<Application, "environments"> | null>(
      async (session) => {
        const doc = await this.applicationModel.findOneAndUpdate(
          { name: props.oldAppName },
          { ...props.updateProps },
          { session },
        );

        if (!doc) return null;

        if (
          props.oldAppName !== props.updateProps.newAppName &&
          R.is(String, props.updateProps.newAppName)
        ) {
          await this.userModel.findOneAndUpdate(
            { clerkId: props.clerkId, applications: props.oldAppName },
            { $set: { "applications.$": props.updateProps.newAppName } },
            { session },
          );
        }

        return {
          id: doc._id.toString(),
          ...R.omit(["_id"], doc),
        };
      },
    );
  }

  public async deleteApplication({
    appName,
    clerkId,
  }: {
    appName: string;
    clerkId: string;
  }): Promise<Omit<Application, "environments"> | null> {
    const envs = await this.getEnvironmentsByAppName(appName);

    return this.transaction<Application | null>(async (session) => {
      const app = await this.applicationModel.findOneAndDelete(
        { name: appName },
        { session },
      );

      if (!app || !app._id) return null;

      await this.environmentModel.deleteMany(
        {
          _id: { $in: envs.map((e) => e.id) },
        },
        { session },
      );
      await this.userModel.findOneAndUpdate(
        { clerkId },
        {
          $pull: { applications: appName },
        },
        { session },
      );
      await this.entityModel.deleteMany(
        { type: { $regex: `^${appName}/` } },
        { session },
      );

      return { id: app._id, ...R.omit(["_id"], app) };
    });
  }
}

export default ApplicationRepository;
