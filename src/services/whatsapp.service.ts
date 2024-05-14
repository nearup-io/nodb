interface WebhookMessage {
  object: string;
  entry: WebhookMessageEntry[];
}

interface WebhookMessageEntry {
  id: string;
  changes: WebhookChanges[];
}

interface WebhookChanges {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts: { profile: { name: string }; wa_id: string }[];
    messages: WebhookMessageReceive[];
  };
  field: string;
}

interface WebhookMessageReceive {
  from: string;
  to: string;
  timestamp: string;
  text: { body: string };
  type: string;
}

interface WebhookMessageSend {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    body: string;
  };
}

const handleWebhookMessage = async (message: WebhookMessage): Promise<void> => {
  const { entry } = message;

  if (
    !Bun.env.WA_TOKEN ||
    !Bun.env.WA_BUSINESS_PHONE_NUMBER_ID ||
    entry[0].changes[0].field !== "messages" ||
    !entry[0].changes[0].value.messages
  ) {
    return;
  }

  const phoneNumber = entry[0].changes[0].value.messages[0].from;
  const messageText = entry[0].changes[0].value.messages[0].text.body;
  console.log(messageText);

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${Bun.env.WA_BUSINESS_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Bun.env.WA_TOKEN}`,
      },
      body: JSON.stringify(
        getTextMessage({ message: "Hello from Hono app", phoneNumber }),
      ),
    },
  );

  console.log("response", response.status);
  console.log("response", await response.json());
};

function getTextMessage({
  message,
  phoneNumber,
}: {
  message: string;
  phoneNumber: string;
}): WebhookMessageSend {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber,
    type: "text",
    text: {
      body: message,
    },
  };
}

export { handleWebhookMessage };
export type { WebhookMessage };
