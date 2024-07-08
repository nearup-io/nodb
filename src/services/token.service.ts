import type Context from "../utils/context.ts";
import type { ITokenRepository } from "../repositories/interfaces.ts";
import { TOKEN_REPOSITORY } from "../utils/const.ts";
import type { BackendTokenPermissions } from "../utils/types.ts";

const getTokenPermissions = async ({
  token,
  context,
}: {
  token: string;
  context: Context;
}): Promise<BackendTokenPermissions | null> => {
  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  return tokenRepository.getTokenPermissions({ token });
};

export { getTokenPermissions };
