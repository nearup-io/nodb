import type { Token, TokenPermission } from "../models/token.model.ts";
import type Context from "../middlewares/context.ts";
import type { ITokenRepository } from "../repositories/interfaces.ts";
import { TOKEN_REPOSITORY } from "../utils/const.ts";

const getAllTokens = async ({
  app,
  env,
  context,
}: {
  app: string;
  env: string;
  context: Context;
}): Promise<Token[]> => {
  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  return tokenRepository.getAllTokens({ app, env });
};

const getTokenPermissions = async ({
  token,
  context,
}: {
  token: string;
  context: Context;
}): Promise<{
  applicationName: string;
  applicationId: string;
  environmentName: string;
  environmentId: string;
  token: string;
  permission: TokenPermission;
} | null> => {
  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  return tokenRepository.getTokenPermissions({ token });
};

export { getAllTokens, getTokenPermissions };
