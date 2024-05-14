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

const handleWebhookMessage = async (
  telegramRequestBody: TelegramRequest,
): Promise<void> => {
  const { message } = telegramRequestBody;

  if (!Bun.env.TELEGRAM_TOKEN) {
    return;
  }
  const result = await fetch(`${telegramBaseUrl}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: message.chat.id,
      text: "Hello from Hono app",
    }),
  });

  console.log(result.status);
  console.log(await result.json());
};

export { handleWebhookMessage };
export type { TelegramRequest };
