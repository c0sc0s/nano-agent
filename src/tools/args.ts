import type { ToolArgs } from "./types.js";

export function requireString(args: ToolArgs, name: string): string {
  const value = args[name];

  if (typeof value !== "string") {
    throw new Error(`Missing or invalid string argument: ${name}`);
  }

  return value;
}

export function optionalString(args: ToolArgs, name: string): string | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid string argument: ${name}`);
  }

  return value;
}

export function optionalNumber(args: ToolArgs, name: string): number | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Invalid integer argument: ${name}`);
  }

  return value;
}

export function parseToolArgs(rawArgs: string): ToolArgs {
  if (rawArgs.trim() === "") {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArgs) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ToolArgs;
    }

    throw new Error("Tool arguments must be a JSON object");
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid tool arguments JSON: ${error.message}`);
    }

    throw error;
  }
}
