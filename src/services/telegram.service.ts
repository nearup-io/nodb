import { searchAiEntities } from "./entity.service.ts";
import type Context from "../middlewares/context.ts";
import { type User } from "../models/user.model.ts";
import { httpError } from "../utils/const.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { findUserByTelegramId } from "./user.service.ts";

const telegramBaseUrl = `https://api.telegram.org/bot${Bun.env.TELEGRAM_TOKEN}`;

interface TelegramRequest {
  update_id: number;
  message: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: false;
    first_name: string;
    last_name: string;
    language_code: string;
  };
  chat: {
    id: number;
    first_name: string;
    last_name: string;
    type: string;
  };
  date: number;
  text: string;
}

const handleWebhookMessage = async ({
  telegramRequestBody,
  context,
}: {
  telegramRequestBody: TelegramRequest;
  context: Context;
  user: User;
}): Promise<void> => {
  const { message } = telegramRequestBody;

  if (!Bun.env.TELEGRAM_TOKEN) {
    return;
  }

  const userTelegramId = message.from.id;
  const user = await findUserByTelegramId({ id: userTelegramId, context });

  if (!user || !user.telegram) {
    throw new ServiceError(httpError.USER_NOT_FOUND);
  }

  const appFilter = `${user.telegram.appName}/${user.telegram.envName}`;

  const res = await searchAiEntities({
    context,
    query: message.text,
    entityType: appFilter,
  });

  if (!res) {
    throw new ServiceError(httpError.UNKNOWN);
  }

  await fetch(`${telegramBaseUrl}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: message.chat.id,
      text: res.answer as string,
    }),
  });
};

export { handleWebhookMessage };
export type { TelegramRequest };
