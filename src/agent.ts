import { callModel, streamModel, type ChatMessage } from "./model.js";
import { compactHistory, compactState, prepareContext } from "./context/index.js";
import { todoManager } from "./planning/index.js";
import { skillRegistry } from "./skills/index.js";
import { executeToolCalls, toolDefinitions } from "./tools/index.js";
import { consumeCompactRequest } from "./tools/compactTool.js";

const SYSTEM_PROMPT = `You are a coding agent at ${process.cwd()}.
Use tools to solve tasks. Prefer read_file, write_file, and edit_file for file operations.
For multi-step tasks, call the todo tool first and update it as progress changes.
Use the task tool for focused exploratory subtasks whose intermediate steps do not need to stay in the parent context.
Use load_skill when a task needs specialized instructions before you act.
Use bash for shell inspection or commands that are awkward as file tools.
The tool runs commands in Windows PowerShell.
Act first, then report clearly.
If active context gets too large or stale, use compact to preserve continuity in a shorter working context.

Skills available:
${skillRegistry.describeAvailable()}`;
const MAX_AGENT_TURNS = 10;
const TODO_REMINDER_ROUNDS = 3;

type LoopState = {
  messages: ChatMessage[];
  turnCount: number;
};

function finalText(content: unknown): string {
  return typeof content === "string" ? content : "";
}

function shouldRemindTodo(): boolean {
  return todoManager.roundsSinceUpdate >= TODO_REMINDER_ROUNDS;
}

function todoReminderMessage(): ChatMessage {
  return {
    role: "system",
    content: `Reminder: refresh the todo plan if task progress changed or the current plan is stale.\n\nCurrent todo:\n${todoManager.render()}`,
  };
}

function buildMessages(state: LoopState): ChatMessage[] {
  const preparedMessages = prepareContext(state.messages, compactState);

  state.messages.splice(0, state.messages.length, ...preparedMessages);

  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...(shouldRemindTodo() ? [todoReminderMessage()] : []),
    ...state.messages,
  ];
}

function applyScheduledCompact(state: LoopState): void {
  if (!consumeCompactRequest()) {
    return;
  }

  const compactedMessages = compactHistory(state.messages, compactState);
  state.messages.splice(0, state.messages.length, ...compactedMessages);
}

export type AgentEvent =
  | { type: "thinking" }
  | { type: "text_delta"; content: string }
  | { type: "tool_start"; id: string; index: number; name: string; args: string }
  | {
      type: "tool_end";
      id: string;
      index: number;
      name: string;
      success: boolean;
      summary: string;
      durationMs: number;
    }
  | { type: "turn_end"; turn: number }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export async function* agentLoopStreaming(
  messages: ChatMessage[],
): AsyncGenerator<AgentEvent> {
  const state: LoopState = {
    messages,
    turnCount: 1,
  };

  while (state.turnCount <= MAX_AGENT_TURNS) {
    yield { type: "thinking" };
    yield { type: "turn_end", turn: state.turnCount };

    const messages = buildMessages(state);
    const generator = streamModel(messages, { tools: toolDefinitions });
    let finalMessage: ChatMessage | null = null;
    let finishReason: string | null = null;

    try {
      for await (const event of generator) {
        switch (event.type) {
          case "delta":
            yield { type: "text_delta", content: event.content };
            break;
          case "done":
            finalMessage = event.message;
            finishReason = event.finishReason;
            break;
          case "error":
            yield { type: "error", message: event.error.message };
            return;
        }
      }
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
      return;
    }

    if (!finalMessage) {
      yield { type: "error", message: "Model returned no response" };
      return;
    }

    state.messages.push(finalMessage);

    if (finishReason === "stop") {
      yield { type: "done", text: finalText(finalMessage.content) };
      return;
    }

    if (finishReason !== "tool_calls") {
      yield {
        type: "error",
        message: `Model stopped unexpectedly: ${finishReason}`,
      };
      return;
    }

    if (!finalMessage.tool_calls || finalMessage.tool_calls.length === 0) {
      yield {
        type: "error",
        message:
          "Model finish_reason was tool_calls but no tool calls were returned",
      };
      return;
    }

    const updateCountBeforeTools = todoManager.updateCount;

    const toolStartTimes = new Map<string, number>();

    for (const [index, tc] of finalMessage.tool_calls.entries()) {
      if (tc.type === "function") {
        toolStartTimes.set(tc.id, Date.now());
        yield {
          type: "tool_start",
          id: tc.id,
          index: index + 1,
          name: tc.function.name,
          args: tc.function.arguments,
        };
      }
    }

    const toolResults = await executeToolCalls(finalMessage.tool_calls, {
      log: false,
    });

    if (toolResults.length === 0) {
      yield {
        type: "error",
        message: "Model requested tools but no tool results were produced",
      };
      return;
    }

    for (const [index, result] of toolResults.entries()) {
      const toolCall = finalMessage.tool_calls[index];
      const toolName =
        toolCall?.type === "function" ? toolCall.function.name : "unknown";
      const startedAt = toolStartTimes.get(result.tool_call_id) ?? Date.now();
      const contentStr = typeof result.content === "string" ? result.content : "";
      const success = !contentStr.startsWith("Error:");
      yield {
        type: "tool_end",
        id: result.tool_call_id,
        index: index + 1,
        name: toolName,
        success,
        summary: contentStr.slice(0, 200),
        durationMs: Date.now() - startedAt,
      };
    }

    state.messages.push(...toolResults);
    state.turnCount += 1;
    applyScheduledCompact(state);

    if (todoManager.updateCount === updateCountBeforeTools) {
      todoManager.markRoundWithoutUpdate();
    }
  }

  yield {
    type: "error",
    message: `Agent loop reached max turns (${MAX_AGENT_TURNS})`,
  };
}

export async function agentLoop(messages: ChatMessage[]): Promise<string> {
  const state: LoopState = {
    messages,
    turnCount: 1,
  };

  while (state.turnCount <= MAX_AGENT_TURNS) {
    const response = await callModel(buildMessages(state), {
      tools: toolDefinitions,
    });
    const { message, finishReason } = response;

    state.messages.push(message);

    if (finishReason === "stop") {
      return finalText(message.content);
    }

    if (finishReason !== "tool_calls") {
      throw new Error(`Model stopped unexpectedly: ${finishReason}`);
    }

    if (!message.tool_calls || message.tool_calls.length === 0) {
      throw new Error(
        "Model finish_reason was tool_calls but no tool calls were returned",
      );
    }

    const updateCountBeforeTools = todoManager.updateCount;
    const toolResults = await executeToolCalls(message.tool_calls, {
      log: false,
    });

    if (toolResults.length === 0) {
      throw new Error(
        "Model requested tools but no tool results were produced",
      );
    }

    state.messages.push(...toolResults);
    state.turnCount += 1;
    applyScheduledCompact(state);

    if (todoManager.updateCount === updateCountBeforeTools) {
      todoManager.markRoundWithoutUpdate();
    }
  }

  throw new Error("Agent loop reached max turns");
}
