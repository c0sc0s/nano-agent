import pc from "picocolors";

import { renderMarkdown } from "./markdown.js";

/** Get terminal width, with safe fallback. */
function termWidth(): number {
  return process.stdout.columns || 80;
}

// ── Dividers ──────────────────────────────────────────────────────

/** A horizontal rule that adapts to current terminal width. */
export function divider(char = "─"): string {
  return pc.dim(char.repeat(Math.max(termWidth() - 1, 40)));
}

/** A thinner hairline divider for internal sections. */
export function hairline(): string {
  return pc.dim("╌".repeat(Math.max(termWidth() - 1, 40)));
}

// ── Labels & Sections ────────────────────────────────────────────

export function labeledLine(label: string, content: string): string {
  return ` ${pc.bold(label)}  ${content}`;
}

/** A section heading with brackets, e.g. ── ▶ Tools ── */
export function sectionHeading(label: string): string {
  const w = termWidth() - 1;
  const padded = ` ${label} `;
  const dashes = Math.max(4, w - padded.length);
  const left = Math.floor(dashes / 2);
  const right = Math.ceil(dashes / 2);
  return pc.dim("─".repeat(left)) + pc.bold(padded) + pc.dim("─".repeat(right));
}

export function banner(): string {
  const title = `${pc.bold("nano agent")} ${pc.dim("v1.0")}`;
  const subtitle = pc.dim("agentic TypeScript runtime");

  return [
    "",
    ` ${pc.cyan("╭────────────────────────────────────╮")}`,
    ` ${pc.cyan("│")}  ${title}                    ${pc.cyan("│")}`,
    ` ${pc.cyan("│")}  ${subtitle}        ${pc.cyan("│")}`,
    ` ${pc.cyan("╰────────────────────────────────────╯")}`,
    "",
    ` ${pc.dim("Commands")}  ${pc.cyan("/help")} ${pc.dim("·")} ${pc.cyan("/status")} ${pc.dim("·")} ${pc.cyan("/clear")} ${pc.dim("·")} ${pc.cyan("q")} ${pc.dim("to exit")}`,
    "",
  ].join("\n");
}

export function helpPanel(): string {
  return [
    divider(),
    ` ${pc.bold(pc.cyan("commands"))}`,
    `   ${pc.cyan("/")}        ${pc.dim("open quick command menu")}`,
    `   ${pc.cyan("/skills")}  ${pc.dim("choose and load a skill")}`,
    `   ${pc.cyan("/help")}    ${pc.dim("show this help")}`,
    `   ${pc.cyan("/status")}  ${pc.dim("show session state")}`,
    `   ${pc.cyan("/clear")}   ${pc.dim("clear the terminal")}`,
    `   ${pc.cyan("q")}        ${pc.dim("exit")}`,
    "",
    ` ${pc.bold(pc.cyan("tips"))}`,
    `   ${pc.dim("Ask for multi-step work to see todo planning.")}`,
    `   ${pc.dim("Ask for exploration to see task subagents and tools.")}`,
    divider(),
  ].join("\n");
}

export function statusPanel(lines: string[]): string {
  return [
    divider(),
    ` ${pc.bold(pc.cyan("status"))}`,
    ...lines.map((line) => `   ${pc.dim("·")} ${line}`),
    divider(),
  ].join("\n");
}

// ── Chat bubbles ─────────────────────────────────────────────────

export function userPrompt(text: string): string {
  const block = indentBlock(renderMarkdown(text), 3);
  return ` ${pc.cyan("╭─")} ${pc.bold(pc.cyan("user"))}\n${block}\n ${pc.cyan("╰")}${pc.dim("─".repeat(10))}`;
}

export function assistantReply(text: string): string {
  const block = indentBlock(renderMarkdown(text), 3);
  return ` ${pc.green("╭─")} ${pc.bold(pc.green("assistant"))}\n${block}\n ${pc.green("╰")}${pc.dim("─".repeat(10))}`;
}

// ── Tool calls ───────────────────────────────────────────────────

export function toolCallLog(name: string, args: string, index?: number): string {
  const label = index !== undefined ? pc.dim(`#${index}`) + " " : "";
  return ` ${pc.yellow("╭─")} ${label}${pc.yellow(name)} ${prettyArgs(args, 88)}`;
}

export function toolResultLog(
  success: boolean,
  summary: string,
  durationMs?: number,
): string {
  const icon = success ? pc.green("╰─") : pc.red("╰─");
  const color = success ? pc.dim : pc.red;
  const duration = durationMs === undefined ? "" : pc.dim(` (${formatDuration(durationMs)})`);
  return ` ${icon} ${color(truncateInline(summary, 110))}${duration}`;
}

// ── Thinking / status ────────────────────────────────────────────

export function thinkingIndicator(text: string): string {
  return pc.dim(`   ↻ ${text}`);
}

export function statusLine(text: string): string {
  return pc.dim(` ${pc.dim("⏺")}  ${text}`);
}

export function turnCheckpoint(turn: number): string {
  return ` ${pc.green("✓")} ${pc.dim(`turn ${turn} complete`)}`;
}

// ── Error block ──────────────────────────────────────────────────

export function errorBlock(message: string): string {
  const line = pc.red("─".repeat(Math.max(termWidth() - 4, 40)));
  return [
    ` ${pc.red("╭")}${line}`,
    ` ${pc.red("│")}  ${pc.bold(pc.red("error"))}`,
    ` ${pc.red("│")}`,
    ...message.split("\n").map((l) => ` ${pc.red("│")}  ${pc.red(l)}`),
    ` ${pc.red("╰")}${line}`,
  ].join("\n");
}

// ── Todo panel ───────────────────────────────────────────────────

export function todoHeader(): string {
  return ` ${pc.magenta("╭─")} ${pc.bold(pc.magenta("plan"))}`;
}

export function todoItem(status: string, content: string, isActive: boolean): string {
  const bullet = isActive ? pc.magenta("▶") : pc.dim("·");
  const colored = isActive ? pc.magenta : pc.dim;
  return `   ${bullet} ${colored(`${status} ${content}`)}`;
}

export function todoFooter(count: number, activeIndex: number): string {
  return ` ${pc.magenta("╰")}${pc.dim(`─ ${activeIndex + 1}/${count} items active`)}`;
}

// ── Session summary ──────────────────────────────────────────────

export function sessionSummary(promptCount: number, durationMs: number): string {
  const secs = (durationMs / 1000).toFixed(1);
  return [
    divider("═"),
    ` ${pc.dim("session ended")}  ${pc.dim(`· ${promptCount} prompts · ${secs}s`)}`,
  ].join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────

function indentBlock(text: string, indent: number): string {
  const padding = " ".repeat(indent);
  return text
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}

function truncateInline(text: string, maxLen: number): string {
  const single = text.replace(/\s*\n\s*/g, " ").trim();
  return single.length > maxLen ? single.slice(0, maxLen) + "…" : single;
}

/** Attempt to pretty-print JSON args, fall back to raw string. */
function prettyArgs(raw: string, maxLen = 80): string {
  try {
    const parsed = JSON.parse(raw);
    const entries = Object.entries(parsed).map(([k, v]) => {
      const val = typeof v === "string" ? v : JSON.stringify(v);
      const compact = val.length > 36 ? `${val.slice(0, 36)}…` : val;
      return `${pc.dim(k + ":")} ${compact}`;
    });
    return truncateInline(entries.join(", "), maxLen);
  } catch {
    return truncateInline(raw, maxLen);
  }
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1_000).toFixed(1)}s`;
}
