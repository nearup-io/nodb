import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/src/resources/messages.js";
import OpenAI from "openai";
import { anthropicModel, embeddingProviders, openaiModel } from "./const";

export const getOpenAiLlm = ({ apiKey }: { apiKey: string }) =>
  new OpenAI({
    apiKey,
  });

export const getAnthropicLlm = ({ apiKey }: { apiKey: string }) =>
  new Anthropic({
    apiKey,
  });

export const getOpenaiCompletion = async ({
  query,
  context,
}: {
  query: string;
  context: string;
}): Promise<OpenAI.Chat.ChatCompletion | undefined> => {
  const { OPENAI_API_KEY, LLM_NAME } = Bun.env;
  console.log({ OPENAI_API_KEY, LLM_NAME });
  if (OPENAI_API_KEY && openaiModel) {
    const llm = getOpenAiLlm({ apiKey: OPENAI_API_KEY });
    const completion = await llm.chat.completions.create({
      model: openaiModel,
      response_format: { type: "text" },
      messages: [
        {
          role: "system",
          content: `Answer questions based on the following serialized JSON data:\n\n${context}`,
        },
        { role: "user", content: query },
      ],
    });
    return completion;
  }
};

export const getAnthropicMessage = async ({
  query,
  context,
}: {
  query: string;
  context: string;
}): Promise<Message | undefined> => {
  const { ANTHROPIC_API_KEY } = Bun.env;
  if (ANTHROPIC_API_KEY && anthropicModel) {
    const llm = getAnthropicLlm({ apiKey: ANTHROPIC_API_KEY });
    const completion = await llm.messages.create({
      model: anthropicModel,
      system: context,
      messages: [{ role: "user", content: query }],
      max_tokens: 1024,
    });
    console.log("anthropic", { completion });
    return completion;
  }
};

export const getEmbedding = async (input: string) => {
  const { OPENAI_API_KEY, EMBEDDING_MODEL, VOYAGE_API_KEY } = Bun.env;
  if (EMBEDDING_MODEL && VOYAGE_API_KEY) {
    // Voyage AI doesn't provide TS package
    const embeddingRequest = await fetch(
      voyageaiFetch.url,
      voyageaiFetch.getOptions({
        apiKey: VOYAGE_API_KEY,
        input,
        model: EMBEDDING_MODEL,
      })
    );
    const embeddingRequestJson = await embeddingRequest.json();
    return embeddingRequestJson.data[0].embedding;
  } else if (EMBEDDING_MODEL && OPENAI_API_KEY) {
    const llm = getOpenAiLlm({ apiKey: OPENAI_API_KEY });
    const embedding = await llm.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });
    return embedding.data[0].embedding;
  }
};

const voyageaiFetch = {
  url: "https://api.voyageai.com/v1/embeddings",
  getOptions: ({
    input,
    apiKey,
    model,
  }: {
    input: string;
    apiKey: string;
    model: string;
  }) => ({
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input, model }),
  }),
};
