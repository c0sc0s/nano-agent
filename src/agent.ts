import { callModel, type ChatMessage } from "./model.js";
import { executeToolCalls } from "./tools.js";

const SYSTEM_PROMPT = `You are a coding agent at ${process.cwd()}.
Use tools to solve tasks. Prefer read_file, write_file, and edit_file for file operations.
Use bash for shell inspection or commands that are awkward as file tools.
The tool runs commands in Windows PowerShell.
Act first, then report clearly.`;
const MAX_AGENT_TURNS = 10;

type LoopState = {
  messages: ChatMessage[];
  turnCount: number;
};

function finalText(content: unknown): string {
  return typeof content === "string" ? content : "";
}

async function runOneTurn(state: LoopState): Promise<string | null> {
  const response = await callModel([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...state.messages,
  ]);
  const { message, finishReason } = response;

  state.messages.push(message);

  if (finishReason === "stop") {
    return finalText(message.content);
  }

  if (finishReason !== "tool_calls") {
    throw new Error(`Model stopped unexpectedly: ${finishReason}`);
  }

  if (!message.tool_calls || message.tool_calls.length === 0) {
    throw new Error("Model finish_reason was tool_calls but no tool calls were returned");
  }

  const toolResults = await executeToolCalls(message.tool_calls);

  if (toolResults.length === 0) {
    throw new Error("Model requested tools but no tool results were produced");
  }

  state.messages.push(...toolResults);
  state.turnCount += 1;

  return null;
}

export async function agentLoop(messages: ChatMessage[]): Promise<string> {
  const state: LoopState = {
    messages,
    turnCount: 1,
  };

  while (state.turnCount <= MAX_AGENT_TURNS) {
    const finalText = await runOneTurn(state);

    if (finalText !== null) {
      return finalText;
    }
  }

  throw new Error("Agent loop reached max turns");
}
