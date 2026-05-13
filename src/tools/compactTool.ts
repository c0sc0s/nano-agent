import type { ToolArgs } from "./types.js";

let compactRequested = false;

export function consumeCompactRequest(): boolean {
  const requested = compactRequested;
  compactRequested = false;

  return requested;
}

export function runCompact(_args: ToolArgs): Promise<string> {
  compactRequested = true;

  return Promise.resolve(
    "Compaction scheduled after current tool results are recorded",
  );
}
