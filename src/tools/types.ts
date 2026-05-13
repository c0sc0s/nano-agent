import type { ChatCompletionTool } from "openai/resources/chat/completions";

export type ToolArgs = Record<string, unknown>;
export type ToolHandler = (args: ToolArgs) => Promise<string>;

export type ToolSpec = {
  definition: ChatCompletionTool;
  handler: ToolHandler;
  concurrency: "safe" | "unsafe";
  availableToSubagent: boolean;
};
