import crypto from "crypto";

export type USER_TYPE = {
  email: string;
  applications: [];
  lastProvider: string;
};

export const generateState = (length = 32) => {
  const randomBytes = crypto.randomBytes(length);
  return randomBytes.toString("base64url");
};

export const bearerFromHeader = (authHeader: string) =>
  authHeader.replace(/Bearer\s+/i, "") || "";
