import axios from "axios";
import { HTTPException } from "hono/http-exception";
import { decode as jwt_decode } from "hono/jwt";
import { ObjectId } from "mongodb";
import * as R from "ramda";
import { getConnection } from "../connections/connect";
import Application from "../models/application.model";
import Environment from "../models/environment.model";
import User from "../models/user.model";
import generateAppName from "../utils/app-name";
import { generateState } from "../utils/auth-utils";
import generateToken from "../utils/backend-token";
import { defaultNodbEnv, Permissions, PROVIDER_GOOGLE } from "../utils/const";

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
  db,
  email,
  provider,
}: {
  db: string;
  email: string;
  provider: string;
}) => {
  const conn = getConnection(db);
  const user = await conn
    .model("User")
    .findOneAndUpdate(
      { email },
      { $addToSet: { providers: provider }, $set: { lastProvider: provider } },
      { returnNewDocument: true }
    );
  let newUser;
  if (!user) {
    const applicationName = generateAppName();
    const environment = await conn.model('Environment').create({
      name: defaultNodbEnv,
      tokens: [
        {
          key: generateToken(),
          permission: Permissions.ALL,
        },
      ],
      entities: [],
    });
    await conn.model('Application').create({
      name: applicationName,
      environments: [new ObjectId(environment._id)],
    });
    newUser = {
      email,
      providers: [provider],
      applications: [applicationName],
      lastProvider: provider,
    };
    await conn.model('User').create(newUser);
  }
  const loggedInUser = user ?? newUser;
  if (!loggedInUser) {
    return {};
  }
  return {
    email: loggedInUser.email,
    providers: loggedInUser.providers,
    lastProvider: provider,
    applications: loggedInUser.applications,
  };
};

export const getGoogleUserData = async ({
  redirectUrl,
  code,
}: {
  redirectUrl: string;
  code: string;
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
  return finalizeAuth({ email, provider: PROVIDER_GOOGLE });
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
  const userData = githubUserResponse.data[0];
  return userData;
};
