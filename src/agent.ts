import { callModel, type ChatMessage } from "./model.js";
import { executeToolCall } from "./tools.js";

const SYSTEM_PROMPT = `You are a coding agent at ${process.cwd()}.
Use the bash tool to inspect and change the workspace when needed.
The tool runs commands in Windows PowerShell.
Act first, then report clearly.`;
const MAX_AGENT_TURNS = 10;

type LoopState = {
  messages: ChatMessage[];
  turnCount: number;
};

async function executeToolCalls(
  toolCalls: NonNullable<Awaited<ReturnType<typeof callModel>>["tool_calls"]>,
): Promise<ChatMessage[]> {
  const results: ChatMessage[] = [];

  for (const toolCall of toolCalls) {
    results.push(await executeToolCall(toolCall));
  }

  return results;
}

async function runOneTurn(state: LoopState): Promise<string | null> {
  const reply = await callModel([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...state.messages,
  ]);

  state.messages.push(reply);

  if (!reply.tool_calls) {
    return reply.content ?? "";
  }

  const toolResults = await executeToolCalls(reply.tool_calls);

  if (toolResults.length === 0) {
    return reply.content ?? "";
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
