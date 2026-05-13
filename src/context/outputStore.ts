import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const OUTPUT_DIR = path.join(process.cwd(), ".task_outputs", "tool-results");
const PERSIST_THRESHOLD = 8_000;
const PREVIEW_LIMIT = 2_000;

function outputPathFor(toolCallId: string, output: string): string {
  const digest = createHash("sha256").update(output).digest("hex").slice(0, 12);
  const safeId = toolCallId.replace(/[^a-zA-Z0-9_-]/g, "_");

  return path.join(OUTPUT_DIR, `${safeId}-${digest}.txt`);
}

export async function persistLargeOutput(
  toolCallId: string,
  output: string,
): Promise<string> {
  if (output.length <= PERSIST_THRESHOLD) {
    return output;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const fullPath = outputPathFor(toolCallId, output);
  await writeFile(fullPath, output, "utf8");

  const relativePath = path.relative(process.cwd(), fullPath);
  const preview = output.slice(0, PREVIEW_LIMIT);

  return [
    "<persisted-output>",
    `Full output saved to: ${relativePath}`,
    "Preview:",
    preview,
    "</persisted-output>",
  ].join("\n");
}
