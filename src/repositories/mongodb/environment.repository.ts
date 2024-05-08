import mongoose from "mongoose";
import { type Environment } from "../../models/environment.model.ts";
import BaseRepository from "./base-repository.ts";
import { httpError, Permissions } from "../../utils/const.ts";
import generateToken from "../../utils/backend-token.ts";
import { ServiceError } from "../../utils/service-errors.ts";
import { ObjectId } from "mongodb";

class EnvironmentRepository extends BaseRepository {
  constructor(readonly conn: mongoose.Connection) {
    super(conn);
  }

  public async findEnvironment({
    envName,
    appName,
  }: {
    envName: string;
    appName: string;
  }): Promise<Environment | undefined> {
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
            _id: "$environments._id",
            entities: "$environments.entities",
          },
        },
      ]);
    return applicationEnvironments[0];
  }

  public async createEnvironment({
    appName,
    envName,
    description = "",
  }: {
    envName: string;
    appName: string;
    description: string;
  }): Promise<Environment> {
    const environment = await this.environmentModel.create({
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
    await this.applicationModel.findOneAndUpdate(
      { name: appName },
      { $addToSet: { environments: environment._id } },
    );
    return environment;
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
    const environment = await this.findEnvironment({
      appName,
      envName,
    });
    if (!environment) {
      throw new ServiceError(httpError.ENV_DOESNT_EXIST);
    }

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
