import { requireString } from "./args.js";
import { skillRegistry } from "../skills/index.js";
import type { ToolArgs } from "./types.js";

export function runLoadSkill(args: ToolArgs): Promise<string> {
  try {
    const name = requireString(args, "name");

    return Promise.resolve(skillRegistry.loadFullText(name));
  } catch (error) {
    return Promise.resolve(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
