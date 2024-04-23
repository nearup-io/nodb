export const Permissions = Object.freeze({
  ALL: "ALL",
  READ_ONLY: "READ-ONLY",
});
import chalk from "chalk";

export const PROVIDER_GOOGLE = "Google";
export const PROVIDER_GITHUB = "Github";

export const APPNAME_MIN_LENGTH = 3;
export const APPNAME_REGEX = /^([a-z0-9]+-)*[a-z0-9]+$/;
export const llms = { anthropic: "anthropic", openai: "openai" };

type OpenAiEmbeddingModels =
  | "text-embedding-ada-002"
  | "text-embedding-3-small"
  | "text-embedding-3-large";
type VoyageEmbeddingModels =
  | "voyage-law-2"
  | "voyage-code-2"
  | "voyage-large-2"
  | "voyage-2"
  | "voyage-lite-02-instruct";
type OpenaiModel =
  | "gpt-3.5-turbo-1106"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-0125"
  | "gpt-4-0613"
  | "gpt-4"
  | "gpt-4-turbo-preview"
  | "gpt-4-0125-preview"
  | "gpt-4-1106-preview"
  | "gpt-4-turbo";
type AnthropicModel =
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307";
export const embeddingModel = Bun.env.EMBEDDING_MODEL as
  | OpenAiEmbeddingModels
  | VoyageEmbeddingModels
  | undefined;
if (!Bun.env.LLM_NAME) {
  console.log(
    chalk.yellow("LLM_NAME env is missing, search features are disabled"),
  );
}
export const anthropicModel = Bun.env.LLM_NAME as AnthropicModel | undefined;
export const openaiModel = Bun.env.LLM_NAME as OpenaiModel | undefined;

type EmbeddingProvider = "openai" | "voyageai";
export const embeddingProviders: { VOYAGEAI: "voyageai"; OPENAI: "openai" } = {
  VOYAGEAI: "voyageai",
  OPENAI: "openai",
};
export const embeddingProvider: EmbeddingProvider =
  Bun.env.EMBEDDING_PROVIDER === embeddingProviders.VOYAGEAI
    ? "voyageai"
    : embeddingProviders.OPENAI;

export const httpError = {
  APPNAME_LENGTH: `Application name length must be greater than ${APPNAME_MIN_LENGTH}`,
  APPNAME_NOT_ALLOWED:
    "Application name must follow hyphenated url pattern (my-app)",
  APPNAME_EXISTS: "App with that name already exists",
  APPNAME_NOT_FOUND: "App with that name is not found",
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
