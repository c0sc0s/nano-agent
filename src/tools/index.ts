import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { executeToolCalls } from "./executor.js";
import { toolRegistry, type ToolName } from "./registry.js";

export { executeToolCalls };
export type { ToolName };

export const toolDefinitions: ChatCompletionTool[] = Object.values(toolRegistry).map(
  (tool) => tool.definition,
);

export const subagentToolNames = Object.entries(toolRegistry)
  .filter(([, tool]) => tool.availableToSubagent)
  .map(([name]) => name as ToolName);

export function selectToolDefinitions(toolNames: readonly ToolName[]): ChatCompletionTool[] {
  return toolNames.map((name) => toolRegistry[name].definition);
}
