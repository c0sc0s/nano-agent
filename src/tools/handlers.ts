import { exec } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { optionalNumber, requireString } from "./args.js";
import { truncateOutput } from "./output.js";
import { safePath, WORKDIR } from "./path.js";
import type { ToolArgs } from "./types.js";

const execAsync = promisify(exec);

const dangerousCommands = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

export async function runBash(args: ToolArgs): Promise<string> {
  const command = requireString(args, "command");

  if (dangerousCommands.some((item) => command.includes(item))) {
    return "Error: Dangerous command blocked";
  }

  try {
    const result = await execAsync(command, {
      cwd: WORKDIR,
      shell: "powershell.exe",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
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

export async function runReadFile(args: ToolArgs): Promise<string> {
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

export async function runWriteFile(args: ToolArgs): Promise<string> {
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

export async function runEditFile(args: ToolArgs): Promise<string> {
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
