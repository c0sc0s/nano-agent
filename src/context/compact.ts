import type { ChatMessage } from "../model.js";
import type { CompactState } from "./types.js";

const KEEP_RECENT_TOOL_RESULTS = 3;
const CONTEXT_SOFT_LIMIT = 60_000;

function messageText(message: ChatMessage): string {
  const parts: string[] = [];
  const content = "content" in message ? message.content : "";

  if (typeof content === "string") {
    parts.push(content);
  }

  if (Array.isArray(content)) {
    parts.push(JSON.stringify(content));
  }

  if (
    "reasoning_content" in message &&
    typeof message.reasoning_content === "string"
  ) {
    parts.push(message.reasoning_content);
  }

  if ("tool_calls" in message && Array.isArray(message.tool_calls)) {
    const toolSummary = message.tool_calls
      .map((toolCall) => {
        if (toolCall.type !== "function") {
          return `tool_call:${toolCall.type}`;
        }

        return `tool_call:${toolCall.function.name}(${toolCall.function.arguments})`;
      })
      .join("\n");

    parts.push(toolSummary);
  }

  return parts.join("\n");
}

export function estimateContextSize(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + messageText(message).length, 0);
}

export function microCompact(messages: ChatMessage[]): ChatMessage[] {
  const toolMessageIndexes = messages
    .map((message, index) => (message.role === "tool" ? index : -1))
    .filter((index) => index !== -1);
  const indexesToCompact = new Set(
    toolMessageIndexes.slice(0, Math.max(0, toolMessageIndexes.length - KEEP_RECENT_TOOL_RESULTS)),
  );

  return messages.map((message, index) => {
    if (!indexesToCompact.has(index) || message.role !== "tool") {
      return message;
    }

    return {
      ...message,
      content: "[Earlier tool result omitted for brevity]",
    };
  });
}

function collectRecentFiles(messages: ChatMessage[]): string[] {
  const files = new Set<string>();
  const filePattern = /(?:[\w.-]+\/)+[\w.-]+|[\w.-]+\.(?:ts|js|json|md|txt)/g;

  for (const message of messages) {
    const text = messageText(message);
    const matches = text.match(filePattern) ?? [];

    for (const match of matches) {
      files.add(match);
    }
  }

  return [...files].slice(-20);
}

export function compactHistory(
  messages: ChatMessage[],
  state: CompactState,
): ChatMessage[] {
  const recentFiles = collectRecentFiles(messages);
  const recentConversation = messages
    .slice(-8)
    .map((message) => `${message.role}: ${messageText(message).slice(0, 1_000)}`)
    .join("\n\n");
  const summary = [
    "This conversation was compacted for continuity.",
    "",
    "Current continuity summary:",
    recentConversation,
    "",
    `Recent files: ${recentFiles.length > 0 ? recentFiles.join(", ") : "(none)"}`,
  ].join("\n");

  state.hasCompacted = true;
  state.lastSummary = summary;
  state.recentFiles = recentFiles;

  return [
    {
      role: "user",
      content: summary,
    },
  ];
}

export function prepareContext(
  messages: ChatMessage[],
  state: CompactState,
): ChatMessage[] {
  const compactedMessages = microCompact(messages);

  if (estimateContextSize(compactedMessages) <= CONTEXT_SOFT_LIMIT) {
    return compactedMessages;
  }

  return compactHistory(compactedMessages, state);
}
