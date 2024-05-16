import crypto from "crypto";
import { type User } from "../models/user.model.ts";

// TODO remove this type and use User everywhere
export type USER_TYPE = User;

export const generateState = (length = 32) => {
  const randomBytes = crypto.randomBytes(length);
  return randomBytes.toString("base64url");
};

export const bearerFromHeader = (authHeader: string) =>
  authHeader.replace(/Bearer\s+/i, "") || "";
