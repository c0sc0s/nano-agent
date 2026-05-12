import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessage,
  ChatCompletion,
} from "openai/resources/chat/completions";

import env from "./config/env.js";
import { toolDefinitions } from "./tools.js";

const client = new OpenAI({
  apiKey: env.MODEL_API_TOKEN,
  baseURL: env.MODEL_BASE_URL,
});

export type ChatMessage = ChatCompletionMessageParam;

export type ModelResponse = {
  message: ChatCompletionMessage;
  finishReason: ChatCompletion.Choice["finish_reason"];
};

export async function callModel(
  messages: ChatMessage[],
): Promise<ModelResponse> {
  const response = await client.chat.completions.create({
    model: env.MODEL_NAME,
    messages,
    stream: false,
    temperature: 1,
    max_tokens: 4096,
    tools: toolDefinitions,
    tool_choice: "auto",
  });

  const choice = response.choices[0];

  if (!choice) {
    throw new Error("Model response did not include a choice");
  }

  return {
    message: choice.message,
    finishReason: choice.finish_reason,
  };
}
