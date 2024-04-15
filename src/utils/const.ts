export const Permissions = Object.freeze({
  ALL: "ALL",
  READ_ONLY: "READ-ONLY",
});

export const PROVIDER_GOOGLE = "Google";
export const PROVIDER_GITHUB = "Github";

export const APPNAME_LENGTH = 3;
export const APPNAME_REGEX = /^([a-z0-9]+-)*[a-z0-9]+$/;

export const httpError = {
  APPNAME_LENGTH: `Application name length must be greater than ${APPNAME_LENGTH}`,
  APPNAME_NOT_ALLOWED:
    "Application name must follow hyphenated url pattern (my-app)",
  SAME_APPNAME: "App names are the same",
  SAME_ENVNAME: "Environment names are the same",
  ENV_NOTFOUND: "Environment not found",
  ENV_EXISTS: "Environment already exists",
  NEW_ENV_EXISTS: "Name for new environment already exists",
  ENV_DOESNT_EXISTS: "Environment doesn't exist",
  PARENT_DOESNT_EXISTS: "Parent entity doesn't exist",
  MISSING_ENV_BODY: "Environment name is missing",
  NO_UPDATE_PROPS: "Missing update props",
  BODY_IS_NOT_ARRAY: "Body must be of array type",
  ENTITY_NO_PARENT: "Parent entity doesn't exis",
  ENTITY_PATH: "Entity path doesn't exist",
  ENTITY_NOT_FOUND: "Entity not found",
  ENTITY_PATH_CREATION: "Wrong path",
  UNKNOWN: "Unknown error",
};
