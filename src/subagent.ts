import { callModel, type ChatMessage } from "./model.js";
import { skillRegistry } from "./skills/index.js";
import {
  executeToolCalls,
  selectToolDefinitions,
  subagentToolNames,
} from "./tools/index.js";

const SUBAGENT_MAX_TURNS = 6;
const SUBAGENT_SYSTEM_PROMPT = `You are a focused subagent at ${process.cwd()}.
Use your clean context to complete only the delegated subtask.
You share the filesystem with the parent agent but not the conversation history.
Use load_skill when a task needs specialized instructions before you act.
Return a concise summary with the evidence needed by the parent agent.

Skills available:
${skillRegistry.describeAvailable()}`;

function finalText(content: unknown): string {
  return typeof content === "string" ? content : "";
}

type SubagentRequest = {
  prompt: string;
  description?: string;
};

function buildPrompt(request: SubagentRequest): string {
  if (!request.description) {
    return request.prompt;
  }

  return `Subtask: ${request.description}\n\n${request.prompt}`;
}

export async function runSubagent(request: SubagentRequest): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: buildPrompt(request),
    },
  ];
  const tools = selectToolDefinitions(subagentToolNames);

  for (let turn = 1; turn <= SUBAGENT_MAX_TURNS; turn += 1) {
    const response = await callModel(
      [
        {
          role: "system",
          content: SUBAGENT_SYSTEM_PROMPT,
        },
        ...messages,
      ],
      { tools },
    );
    const { message, finishReason } = response;

    messages.push(message);

    if (finishReason === "stop") {
      const summary = finalText(message.content);
      return summary || "(subagent returned no summary)";
    }

    if (finishReason !== "tool_calls") {
      return `Error: Subagent stopped unexpectedly: ${finishReason}`;
    }

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return "Error: Subagent requested tools but returned no tool calls";
    }

    const toolResults = await executeToolCalls(message.tool_calls, {
      allowedTools: subagentToolNames,
      log: false,
    });

    if (toolResults.length === 0) {
      return "Error: Subagent produced no tool results";
    }

    messages.push(...toolResults);
  }

  return `Error: Subagent reached max turns (${SUBAGENT_MAX_TURNS})`;
}
