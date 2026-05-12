import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessage,
} from "openai/resources/chat/completions";

import env from "./config/env.js";
import { toolDefinitions } from "./tools.js";

const client = new OpenAI({
  apiKey: env.MODEL_API_TOKEN,
  baseURL: env.MODEL_BASE_URL,
});

export type ChatMessage = ChatCompletionMessageParam;

export async function callModel(
  messages: ChatMessage[],
): Promise<ChatCompletionMessage> {
  const response = await client.chat.completions.create({
    model: env.MODEL_NAME,
    messages,
    stream: false,
    temperature: 1,
    max_tokens: 4096,
    tools: toolDefinitions,
    tool_choice: "auto",
  });

  const message = response.choices[0]?.message;

  if (!message) {
    throw new Error("Model response did not include an assistant message");
  }

  return message;
}
