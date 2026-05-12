import { exec } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

const execAsync = promisify(exec);

const WORKDIR = process.cwd();
const OUTPUT_LIMIT = 50_000;
const dangerousCommands = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

type ToolArgs = Record<string, unknown>;
type ToolHandler = (args: ToolArgs) => Promise<string>;

type ToolSpec = {
  definition: ChatCompletionTool;
  handler: ToolHandler;
  concurrency: "safe" | "unsafe";
};

export const concurrencySafeTools = new Set(["read_file"]);
export const concurrencyUnsafeTools = new Set(["bash", "write_file", "edit_file"]);

function truncateOutput(output: string): string {
  return output.length > OUTPUT_LIMIT ? output.slice(0, OUTPUT_LIMIT) : output;
}

function requireString(args: ToolArgs, name: string): string {
  const value = args[name];

  if (typeof value !== "string") {
    throw new Error(`Missing or invalid string argument: ${name}`);
  }

  return value;
}

function optionalNumber(args: ToolArgs, name: string): number | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Invalid integer argument: ${name}`);
  }

  return value;
}

function safePath(inputPath: string): string {
  const resolvedPath = path.resolve(WORKDIR, inputPath);
  const relativePath = path.relative(WORKDIR, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }

  return resolvedPath;
}

async function runBash(args: ToolArgs): Promise<string> {
  const command = requireString(args, "command");

  if (dangerousCommands.some((item) => command.includes(item))) {
    return "Error: Dangerous command blocked";
  }

  try {
    const result = await execAsync(command, {
      cwd: WORKDIR,
      shell: "powershell.exe",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });

    const output = `${result.stdout}${result.stderr}`.trim();

    return truncateOutput(output || "(no output)");
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }

    return `Error: ${String(error)}`;
  }
}

async function runReadFile(args: ToolArgs): Promise<string> {
  try {
    const filePath = requireString(args, "path");
    const limit = optionalNumber(args, "limit");
    const content = await readFile(safePath(filePath), "utf8");
    const lines = content.split(/\r?\n/);

    if (limit !== undefined && limit >= 0 && limit < lines.length) {
      const omitted = lines.length - limit;
      return truncateOutput([...lines.slice(0, limit), `... (${omitted} more lines)`].join("\n"));
    }

    return truncateOutput(content);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function runWriteFile(args: ToolArgs): Promise<string> {
  try {
    const filePath = requireString(args, "path");
    const content = requireString(args, "content");
    const resolvedPath = safePath(filePath);

    await mkdir(path.dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, content, "utf8");

    return `Wrote ${Buffer.byteLength(content, "utf8")} bytes to ${filePath}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function runEditFile(args: ToolArgs): Promise<string> {
  try {
    const filePath = requireString(args, "path");
    const oldText = requireString(args, "old_text");
    const newText = requireString(args, "new_text");
    const resolvedPath = safePath(filePath);
    const content = await readFile(resolvedPath, "utf8");

    if (!content.includes(oldText)) {
      return `Error: Text not found in ${filePath}`;
    }

    await writeFile(resolvedPath, content.replace(oldText, newText), "utf8");

    return `Edited ${filePath}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const toolRegistry = {
  bash: {
    concurrency: "unsafe",
    handler: runBash,
    definition: {
      type: "function",
      function: {
        name: "bash",
        description: "Run a PowerShell command in the current workspace.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The PowerShell command to run.",
            },
          },
          required: ["command"],
        },
      },
    },
  },
  read_file: {
    concurrency: "safe",
    handler: runReadFile,
    definition: {
      type: "function",
      function: {
        name: "read_file",
        description: "Read a UTF-8 text file from the current workspace.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to the workspace.",
            },
            limit: {
              type: "integer",
              description: "Optional maximum number of lines to return.",
            },
          },
          required: ["path"],
        },
      },
    },
  },
  write_file: {
    concurrency: "unsafe",
    handler: runWriteFile,
    definition: {
      type: "function",
      function: {
        name: "write_file",
        description: "Write UTF-8 text content to a file in the current workspace.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to the workspace.",
            },
            content: {
              type: "string",
              description: "Full file content to write.",
            },
          },
          required: ["path", "content"],
        },
      },
    },
  },
  edit_file: {
    concurrency: "unsafe",
    handler: runEditFile,
    definition: {
      type: "function",
      function: {
        name: "edit_file",
        description: "Replace the first exact text match in a workspace file.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to the workspace.",
            },
            old_text: {
              type: "string",
              description: "Exact text to replace.",
            },
            new_text: {
              type: "string",
              description: "Replacement text.",
            },
          },
          required: ["path", "old_text", "new_text"],
        },
      },
    },
  },
} satisfies Record<string, ToolSpec>;

export const toolDefinitions: ChatCompletionTool[] = Object.values(toolRegistry).map(
  (tool) => tool.definition,
);

function parseToolArgs(rawArgs: string): ToolArgs {
  try {
    const parsed = JSON.parse(rawArgs) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ToolArgs;
    }

    return {};
  } catch {
    return {};
  }
}

export async function executeToolCall(
  toolCall: ChatCompletionMessageToolCall,
): Promise<ChatCompletionToolMessageParam> {
  if (toolCall.type !== "function") {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: `Error: Unsupported tool call type ${toolCall.type}`,
    };
  }

  const tool = toolRegistry[toolCall.function.name as keyof typeof toolRegistry];

  if (!tool) {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: `Error: Unknown tool ${toolCall.function.name}`,
    };
  }

  console.log(`> ${toolCall.function.name}`);

  const output = await tool.handler(parseToolArgs(toolCall.function.arguments));

  console.log(output.slice(0, 200));

  return {
    role: "tool",
    tool_call_id: toolCall.id,
    content: output,
  };
}

function isConcurrencySafeToolCall(toolCall: ChatCompletionMessageToolCall): boolean {
  return (
    toolCall.type === "function" &&
    concurrencySafeTools.has(toolCall.function.name) &&
    !concurrencyUnsafeTools.has(toolCall.function.name)
  );
}

export async function executeToolCalls(
  toolCalls: ChatCompletionMessageToolCall[],
): Promise<ChatCompletionToolMessageParam[]> {
  if (toolCalls.every(isConcurrencySafeToolCall)) {
    return Promise.all(toolCalls.map((toolCall) => executeToolCall(toolCall)));
  }

  const results: ChatCompletionToolMessageParam[] = [];

  for (const toolCall of toolCalls) {
    results.push(await executeToolCall(toolCall));
  }

  return results;
}
