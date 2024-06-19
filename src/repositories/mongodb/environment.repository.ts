import { type Environment } from "../../models/environment.model.ts";
import BaseRepository from "./base.repository.ts";
import { Permissions } from "../../utils/const.ts";
import generateToken from "../../utils/backend-token.ts";
import { ObjectId } from "mongodb";
import type { IEnvironmentRepository } from "../interfaces.ts";
import * as R from "ramda";

class EnvironmentRepository
  extends BaseRepository
  implements IEnvironmentRepository
{
  constructor() {
    super();
  }

  public async findEnvironment({
    envName,
    appName,
  }: {
    envName: string;
    appName: string;
  }): Promise<Environment | null> {
    const applicationEnvironments =
      await this.applicationModel.aggregate<Environment>([
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
            id: "$environments._id",
            entities: "$environments.entities",
            _id: 0,
          },
        },
      ]);
    if (!applicationEnvironments[0]) return null;

    const environment = applicationEnvironments[0];
    return {
      id: environment.id.toString(),
      ...R.omit(["id"], environment),
    };
  }

  public async createEnvironment({
    appName,
    envName,
    description = "",
  }: {
    envName: string;
    appName: string;
    description?: string;
  }): Promise<Environment> {
    return this.transaction(async (session) => {
      const [environment] = await this.environmentModel.create(
        [
          {
            name: envName,
            tokens: [
              {
                key: generateToken(),
                permission: Permissions.ALL,
              },
            ],
            entities: [],
            description,
          },
        ],
        {
          session,
        },
      );
      await this.applicationModel.updateOne(
        { name: appName },
        { $addToSet: { environments: environment._id } },
        { upsert: true, session },
      );

      return {
        id: environment._id.toString(),
        ...R.omit(["_id"], environment),
      };
    });
  }

  public async deleteEnvironment({
    appName,
    envName,
    environmentDbId,
  }: {
    appName: string;
    envName: string;
    environmentDbId: string;
  }): Promise<void> {
    const environmentObjectId = new ObjectId(environmentDbId);
    await this.transaction(async (session) => {
      await this.entityModel.deleteMany(
        { type: { $regex: `${appName}/${envName}/` } },
        { session },
      );
      await this.environmentModel.findByIdAndDelete(environmentObjectId, {
        session,
      });
      await this.applicationModel.findOneAndUpdate(
        { name: appName },
        {
          $pull: { environments: environmentObjectId },
        },
        { session },
      );
    });
  }

  public async updateEnvironment({
    databaseEnvironmentId,
    updateProps,
  }: {
    databaseEnvironmentId: string;
    updateProps: { name?: string; description?: string };
  }): Promise<Environment | null> {
    return this.environmentModel.findByIdAndUpdate<Environment>(
      new ObjectId(databaseEnvironmentId),
      { ...updateProps },
      { returnDocument: "after", new: true },
    );
  }
}

export default EnvironmentRepository;
