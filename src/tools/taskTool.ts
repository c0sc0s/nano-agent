import { optionalString, requireString } from "./args.js";
import type { ToolArgs } from "./types.js";

export async function runTask(args: ToolArgs): Promise<string> {
  try {
    const prompt = requireString(args, "prompt");
    const description = optionalString(args, "description");
    const { runSubagent } = await import("../subagent.js");

    return await runSubagent(
      description === undefined
        ? { prompt }
        : {
            prompt,
            description,
          },
    );
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
