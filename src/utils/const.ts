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
  APPNAME_EXISTS: "App with that name already exists",
  SAME_APPNAME: "App names are the same",
  SAME_ENVNAME: "Environment names are the same",
  ENV_NOTFOUND: "Environment not found",
  APP_CANT_DELETE: "Application could't be deleted",
  ENV_CANT_DELETE: "Environment could't be deleted",
  ENTITIES_CANT_DELETE: "Could't delete entities",
  ENV_EXISTS: "Environment already exists",
  NEW_ENV_EXISTS: "Name for new environment already exists",
  APP_DOESNT_EXIST: "Application doesn't exist",
  ENV_DOESNT_EXIST: "Environment doesn't exist",
  PARENT_DOESNT_EXIST: "Parent entity doesn't exist",
  MISSING_ENV_BODY: "Environment name is missing",
  NO_UPDATE_PROPS: "Missing update props",
  BODY_IS_NOT_ARRAY: "Body must be of array type",
  ENTITY_NO_PARENT: "Parent entity doesn't exist",
  ENTITY_PATH: "Entity path doesn't exist",
  ENTITY_NOT_FOUND: "Entity not found",
  ENTITY_PATH_CREATION: "Wrong path",
  ENTITIES_CANT_UPDATE: "Cannot update entities",
  ENTITIES_CANT_ADD: "Cannot add entities",
  UNKNOWN: "Unknown error",
};

export const defaultNodbEnv = "dev";
