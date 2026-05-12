import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

const execAsync = promisify(exec);

const dangerousCommands = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command in the current workspace.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run.",
          },
        },
        required: ["command"],
      },
    },
  },
];

async function runBash(command: string): Promise<string> {
  if (dangerousCommands.some((item) => command.includes(item))) {
    return "Error: Dangerous command blocked";
  }

  try {
    const result = await execAsync(command, {
      cwd: process.cwd(),
      shell: "powershell.exe",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });

    const output = `${result.stdout}${result.stderr}`.trim();

    return output || "(no output)";
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }

    return `Error: ${String(error)}`;
  }
}

function parseBashArgs(rawArgs: string): { command?: string } {
  try {
    return JSON.parse(rawArgs) as { command?: string };
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

  if (toolCall.function.name !== "bash") {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: `Error: Unknown tool ${toolCall.function.name}`,
    };
  }

  const args = parseBashArgs(toolCall.function.arguments);

  if (!args.command) {
    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: "Error: Missing command",
    };
  }

  console.log(`$ ${args.command}`);

  const output = await runBash(args.command);

  console.log(output.slice(0, 200));

  return {
    role: "tool",
    tool_call_id: toolCall.id,
    content: output,
  };
}
