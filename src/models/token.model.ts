export type TokenPermission = "ALL" | "READ_ONLY";

export type Token = {
  key: string;
  permission: TokenPermission;
};
