import type { Token } from "../models/environment.model.ts";
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

export { getAllTokens };
