import axios from "axios";
import { HTTPException } from "hono/http-exception";
import { decode as jwt_decode } from "hono/jwt";
import * as R from "ramda";
import generateAppName from "../utils/app-name";
import { generateState } from "../utils/auth-utils";
import {
  defaultNodbEnv,
  ENVIRONMENT_MONGO_DB_REPOSITORY,
  PROVIDER_GOOGLE,
  USER_MONGO_DB_REPOSITORY,
} from "../utils/const";
import type Context from "../middlewares/context.ts";
import { EnvironmentRepository, UserRepository } from "../repositories/mongodb";
import { type User } from "../models/user.model.ts";

export const getGithubLoginUrl = ({ redirectUrl }: { redirectUrl: string }) => {
  const { GITHUB_CLIENT_ID, GITHUB_AUTH_ENDPOINT } = Bun.env;
  if (!GITHUB_CLIENT_ID || !GITHUB_AUTH_ENDPOINT) {
    throw new HTTPException(400, {
      message: "Missing Github env",
    });
  }
  const params = new URLSearchParams();
  params.append("client_id", GITHUB_CLIENT_ID);
  params.append("redirect_uri", redirectUrl);
  params.append("scope", ["read:user", "user:email"].join(" "));
  params.append("allow_signup", "true");
  return `${process.env.GITHUB_AUTH_ENDPOINT}?${params.toString()}`;
};

export const getGoogleLoginUrl = ({ redirectUrl }: { redirectUrl: string }) => {
  const { GOOGLE_RESPONSE_TYPE, GOOGLE_CLIENT_ID, GOOGLE_SCOPE } = Bun.env;
  if (!GOOGLE_RESPONSE_TYPE || !GOOGLE_CLIENT_ID || !GOOGLE_SCOPE) {
    throw new HTTPException(400, {
      message: "Missing Google env",
    });
  }
  const state = generateState();
  const params = new URLSearchParams();
  params.append("client_id", GOOGLE_CLIENT_ID);
  params.append("response_type", GOOGLE_RESPONSE_TYPE);
  params.append("redirect_uri", redirectUrl);
  params.append("scope", GOOGLE_SCOPE);
  params.append("state", state);
  return `${process.env.GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
};

export const finalizeAuth = async ({
  context,
  email,
  provider,
}: {
  context: Context;
  email: string;
  provider: string;
}): Promise<User> => {
  const userRepository = context.get<UserRepository>(USER_MONGO_DB_REPOSITORY);
  const updatedUser = await userRepository.updateUser({ email, provider });

  if (updatedUser) return updatedUser;

  const appName = generateAppName();
  const environmentRepository = context.get<EnvironmentRepository>(
    ENVIRONMENT_MONGO_DB_REPOSITORY,
  );

  await environmentRepository.createEnvironment({
    appName,
    envName: defaultNodbEnv,
  });

  return userRepository.createUser({ provider, email, appName });
};

export const getGoogleUserData = async ({
  redirectUrl,
  code,
  context,
}: {
  redirectUrl: string;
  code: string;
  context: Context;
}) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = Bun.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new HTTPException(400, {
      message: "Missing Google access env",
    });
  }
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", decodeURIComponent(code));
  params.append("redirect_uri", redirectUrl);
  params.append("client_id", GOOGLE_CLIENT_ID);
  params.append("client_secret", GOOGLE_CLIENT_SECRET);
  const options = {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: params.toString(),
    url: process.env.GOOGLE_TOKEN_ENDPOINT,
  };
  const response = await axios(options);
  if (response.status !== 200) {
    throw new HTTPException(400, {
      message: "Error while getting Google response",
    });
  }
  const { id_token } = response.data;
  const email = R.path(["payload", "email"], jwt_decode(id_token));
  return finalizeAuth({ context, email, provider: PROVIDER_GOOGLE });
};

export const getGithubUserData = async ({
  redirectUrl,
  code,
}: {
  redirectUrl: string;
  code: string;
}) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = Bun.env;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new HTTPException(400, {
      message: "Missing Github access env",
    });
  }
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUrl);
  params.append("client_id", GITHUB_CLIENT_ID);
  params.append("client_secret", GITHUB_CLIENT_SECRET);
  const githubTokenOptions = {
    method: "POST",
    data: params.toString(),
    url: Bun.env.GITHUB_TOKEN_ENDPOINT,
  };
  const githubTokenResponse = await axios(githubTokenOptions);
  if (githubTokenResponse.status !== 200) {
    throw new HTTPException(400, {
      message: "Error while getting Github response",
    });
  }
  const access_token = githubTokenResponse.data.split("&")[0].split("=")[1];
  const githubUserInfoOptions = {
    method: "GET",
    headers: { Authorization: `Bearer ${access_token}` },
    url: process.env.GITHUB_USERINFO_ENDPOINT,
  };
  const githubUserResponse = await axios(githubUserInfoOptions);
  if (githubUserResponse.status !== 200) {
    throw new HTTPException(400, {
      message: "Error while getting Github response",
    });
  }
  return githubUserResponse.data[0];
};
