import OpenAI from "openai";
import type {
  ChatCompletionTool,
  ChatCompletionMessageParam,
  ChatCompletionMessage,
  ChatCompletion,
} from "openai/resources/chat/completions";

import env from "./config/env.js";

const client = new OpenAI({
  apiKey: env.MODEL_API_TOKEN,
  baseURL: env.MODEL_BASE_URL,
});

type DeepSeekAssistantMessage = ChatCompletionMessage & {
  reasoning_content?: string | null;
};

type DeepSeekDelta = {
  reasoning_content?: string;
};

export type ChatMessage = ChatCompletionMessageParam | DeepSeekAssistantMessage;

export type ModelResponse = {
  message: DeepSeekAssistantMessage;
  finishReason: ChatCompletion.Choice["finish_reason"];
};

export type ModelOptions = {
  tools?: ChatCompletionTool[];
};

export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; message: DeepSeekAssistantMessage; finishReason: ChatCompletion.Choice["finish_reason"] }
  | { type: "error"; error: Error };

export async function callModel(
  messages: ChatMessage[],
  options: ModelOptions = {},
): Promise<ModelResponse> {
  const response = await client.chat.completions.create({
    model: env.MODEL_NAME,
    messages,
    stream: false,
    temperature: 1,
    max_tokens: 4096,
    ...(options.tools && options.tools.length > 0
      ? {
          tools: options.tools,
          tool_choice: "auto" as const,
        }
      : {}),
  });

  const choice = response.choices[0];

  if (!choice) {
    throw new Error("Model response did not include a choice");
  }

  return {
    message: choice.message as DeepSeekAssistantMessage,
    finishReason: choice.finish_reason,
  };
}

export async function* streamModel(
  messages: ChatMessage[],
  options: ModelOptions = {},
): AsyncGenerator<StreamEvent> {
  const stream = await client.chat.completions.create({
    model: env.MODEL_NAME,
    messages,
    stream: true,
    temperature: 1,
    max_tokens: 4096,
    ...(options.tools && options.tools.length > 0
      ? {
          tools: options.tools,
          tool_choice: "auto" as const,
        }
      : {}),
  });

  const toolCallAccumulators: Map<
    number,
    { name: string; arguments: string; id: string }
  > = new Map();
  const contentParts: string[] = [];
  const reasoningParts: string[] = [];
  let finishReason: ChatCompletion.Choice["finish_reason"] | null = null;

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      const chunkFinishReason = chunk.choices?.[0]?.finish_reason;

      if (chunkFinishReason) {
        finishReason = chunkFinishReason;
      }

      if (!delta) continue;

      const reasoningContent = (delta as DeepSeekDelta).reasoning_content;

      if (reasoningContent) {
        reasoningParts.push(reasoningContent);
      }

      // Content delta
      if (delta.content) {
        contentParts.push(delta.content);
        yield { type: "delta", content: delta.content };
      }

      // Tool call deltas
      if (delta.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const index = tcDelta.index ?? 0;

          if (!toolCallAccumulators.has(index)) {
            toolCallAccumulators.set(index, {
              name: tcDelta.function?.name ?? "",
              arguments: tcDelta.function?.arguments ?? "",
              id: tcDelta.id ?? `call_${Date.now()}_${index}`,
            });

          } else {
            const acc = toolCallAccumulators.get(index)!;

            if (tcDelta.function?.name) {
              acc.name += tcDelta.function.name;
            }
            if (tcDelta.function?.arguments) {
              acc.arguments += tcDelta.function.arguments;
            }
            if (tcDelta.id) {
              acc.id = tcDelta.id;
            }

          }
        }
      }
    }
  } catch (error) {
    yield { type: "error", error: error instanceof Error ? error : new Error(String(error)) };
    return;
  }

  // Reconstruct the full message
  const rawToolCalls = [...toolCallAccumulators.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, acc]) => ({
      id: acc.id,
      type: "function" as const,
      function: {
        name: acc.name,
        arguments: acc.arguments,
      },
    }));

  const message: DeepSeekAssistantMessage = {
    role: "assistant",
    content: contentParts.length > 0 ? contentParts.join("") : null,
    refusal: null,
  } as DeepSeekAssistantMessage;

  if (reasoningParts.length > 0) {
    message.reasoning_content = reasoningParts.join("");
  }

  if (rawToolCalls.length > 0) {
    message.tool_calls = rawToolCalls;
  }

  yield {
    type: "done",
    message,
    finishReason: finishReason ?? "stop",
  };
}
