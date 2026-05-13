import { todoManager } from "../planning/index.js";
import type { ToolArgs } from "./types.js";

export function runTodo(args: ToolArgs): Promise<string> {
  const items = args["items"];

  if (!Array.isArray(items)) {
    return Promise.resolve("Error: Missing or invalid array argument: items");
  }

  try {
    return Promise.resolve(todoManager.update(items));
  } catch (error) {
    return Promise.resolve(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
