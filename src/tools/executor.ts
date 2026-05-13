import type {
  ChatCompletionMessageToolCall,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

import { persistLargeOutput } from "../context/index.js";
import { fmt } from "../tui/index.js";
import { parseToolArgs } from "./args.js";
import { toolRegistry, type ToolName } from "./registry.js";

type ExecuteToolOptions = {
  allowedTools?: readonly ToolName[];
  log?: boolean;
};

function isAllowedTool(toolName: string, allowedTools?: readonly ToolName[]): boolean {
  return !allowedTools || allowedTools.includes(toolName as ToolName);
}

export async function executeToolCall(
  toolCall: ChatCompletionMessageToolCall,
  options: ExecuteToolOptions = {},
): Promise<ChatCompletionToolMessageParam> {
  if (toolCall.type !== "function") {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: `Error: Unsupported tool call type ${toolCall.type}`,
    };
  }

  if (!isAllowedTool(toolCall.function.name, options.allowedTools)) {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: `Error: Tool ${toolCall.function.name} is not available in this context`,
    };
  }

  const tool = toolRegistry[toolCall.function.name as keyof typeof toolRegistry];

  if (!tool) {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: `Error: Unknown tool ${toolCall.function.name}`,
    };
  }

  if (options.log !== false) {
    console.log(fmt.toolCallLog(toolCall.function.name, toolCall.function.arguments));
  }

  let output: string;

  try {
    const rawOutput = await tool.handler(parseToolArgs(toolCall.function.arguments));
    output = await persistLargeOutput(toolCall.id, rawOutput);
  } catch (error) {
    output = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const success = !output.startsWith("Error:");

  if (options.log !== false) {
    console.log(fmt.toolResultLog(success, output));
  }

  return {
    role: "tool",
    tool_call_id: toolCall.id,
    content: output,
  };
}

function isConcurrencySafeToolCall(toolCall: ChatCompletionMessageToolCall): boolean {
  if (toolCall.type !== "function") {
    return false;
  }

  const tool = toolRegistry[toolCall.function.name as keyof typeof toolRegistry];

  return tool?.concurrency === "safe";
}

export async function executeToolCalls(
  toolCalls: ChatCompletionMessageToolCall[],
  options: ExecuteToolOptions = {},
): Promise<ChatCompletionToolMessageParam[]> {
  if (toolCalls.every(isConcurrencySafeToolCall)) {
    return Promise.all(
      toolCalls.map((toolCall) => executeToolCall(toolCall, options)),
    );
  }

  const results: ChatCompletionToolMessageParam[] = [];

  for (const toolCall of toolCalls) {
    results.push(await executeToolCall(toolCall, options));
  }

  return results;
}
