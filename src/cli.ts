import { input, select } from "@inquirer/prompts";
import pc from "picocolors";

import { agentLoopStreaming } from "./agent.js";
import type { ChatMessage } from "./model.js";
import { todoManager } from "./planning/index.js";
import { compactState, estimateContextSize } from "./context/index.js";
import { skillRegistry } from "./skills/index.js";
import { Spinner, fmt } from "./tui/index.js";

// ── Constants ────────────────────────────────────────────────────

const EXIT_COMMANDS = new Set(["", "q", "quit", "exit"]);
const INTERNAL_COMMANDS = new Set(["/", "/help", "/status", "/clear", "/skills"]);

function isExitCommand(value: string): boolean {
  return EXIT_COMMANDS.has(value.trim().toLowerCase());
}

function isInternalCommand(value: string): boolean {
  return INTERNAL_COMMANDS.has(value.trim().toLowerCase());
}

// ── Banner ───────────────────────────────────────────────────────

function printBanner(): void {
  console.log(fmt.banner());
}

// ── Todo panel ───────────────────────────────────────────────────

function printTodoPanel(): void {
  if (!todoManager.hasItems) return;

  const snapshot = todoManager.snapshot();
  const activeIndex = snapshot.items.findIndex((i) => i.status === "in_progress");

  console.log(fmt.divider());
  console.log(fmt.todoHeader());

  for (const item of snapshot.items) {
    const status =
      item.status === "pending"
        ? pc.dim("[ ]")
        : item.status === "in_progress"
          ? pc.magenta("[▶]")
          : pc.green("[✓]");
    const isActive = item.status === "in_progress";
    const label =
      isActive && item.activeForm ? item.activeForm : item.content;
    console.log(fmt.todoItem(status, label, isActive));
  }

  if (activeIndex >= 0) {
    console.log(fmt.todoFooter(snapshot.items.length, activeIndex));
  }
  console.log();
}

function printStatus(history: ChatMessage[], submittedPrompts: number): void {
  const lines = [
    `${submittedPrompts} prompts submitted`,
    `${history.length} active messages`,
    `${estimateContextSize(history)} estimated context chars`,
    compactState.hasCompacted
      ? `last compacted summary: ${compactState.lastSummary.length} chars`
      : "not compacted yet",
    `${todoManager.hasItems ? todoManager.snapshot().items.length : 0} todo items`,
  ];

  console.log(fmt.statusPanel(lines));
}

async function loadSkillFromMenu(history: ChatMessage[]): Promise<void> {
  const manifests = skillRegistry.listManifests();

  if (manifests.length === 0) {
    console.log(fmt.statusPanel(["No skills available."]));
    return;
  }

  const skillName = await select({
    message: "Select a skill",
    choices: manifests.map((manifest) => ({
      name: `${manifest.name} ${pc.dim("- " + manifest.description)}`,
      value: manifest.name,
      description: manifest.path,
    })),
  });
  const skillText = skillRegistry.loadFullText(skillName);

  history.push({
    role: "user",
    content: `The user selected this skill for the current conversation:\n\n${skillText}`,
  });

  console.log(fmt.statusPanel([`Loaded skill: ${pc.cyan(skillName)}`]));
}

async function openCommandMenu(
  history: ChatMessage[],
  submittedPrompts: number,
): Promise<void> {
  const action = await select({
    message: "Command",
    choices: [
      {
        name: "Load skill",
        value: "skills",
        description: "Choose a skill and inject it into the current context",
      },
      {
        name: "Status",
        value: "status",
        description: "Show session state",
      },
      {
        name: "Help",
        value: "help",
        description: "Show commands",
      },
      {
        name: "Clear",
        value: "clear",
        description: "Clear the terminal",
      },
      {
        name: "Cancel",
        value: "cancel",
      },
    ],
  });

  if (action === "skills") {
    await loadSkillFromMenu(history);
    return;
  }

  if (action === "status") {
    printStatus(history, submittedPrompts);
    printTodoPanel();
    return;
  }

  if (action === "help") {
    console.log(fmt.helpPanel());
    return;
  }

  if (action === "clear") {
    console.clear();
    printBanner();
  }
}

async function handleInternalCommand(
  query: string,
  history: ChatMessage[],
  submittedPrompts: number,
): Promise<void> {
  const command = query.trim().toLowerCase();

  if (command === "/") {
    await openCommandMenu(history, submittedPrompts);
    return;
  }

  if (command === "/skills") {
    await loadSkillFromMenu(history);
    return;
  }

  if (command === "/help") {
    console.log(fmt.helpPanel());
    return;
  }

  if (command === "/status") {
    printStatus(history, submittedPrompts);
    printTodoPanel();
    return;
  }

  if (command === "/clear") {
    console.clear();
    printBanner();
  }
}

// ── Output helpers ───────────────────────────────────────────────

function printDone(text: string): void {
  console.log();
  console.log(fmt.divider());
  console.log(fmt.assistantReply(text));
  console.log();
}

function printErrorSummary(message: string): void {
  console.log();
  console.log(fmt.errorBlock(message));
  console.log();
}

// ── Agent event loop ─────────────────────────────────────────────

type Phase = "idle" | "thinking" | "writing" | "tools";

async function handleAgentStream(history: ChatMessage[]): Promise<void> {
  const spinner = new Spinner();
  const eventStream = agentLoopStreaming(history);

  let phase: Phase = "idle";
  let assistantText = "";
  let hasReceivedText = false;
  let toolCallIndex = 0;

  try {
    for await (const event of eventStream) {
      switch (event.type) {
        // ── Thinking ──
        case "thinking": {
          phase = "thinking";
          spinner.start("thinking");
          break;
        }

        // ── Turn end ──
        case "turn_end": {
          if (event.turn > 1) {
            spinner.stop(fmt.turnCheckpoint(event.turn - 1));
          }
          // For turn 1, spinner keeps running from "thinking" phase.
          break;
        }

        // ── Text streaming ──
        case "text_delta": {
          assistantText += event.content;
          hasReceivedText = true;

          if (phase === "thinking") {
            phase = "writing";
            spinner.updateMessage("writing");
          }
          break;
        }

        // ── Tool calls ──
        case "tool_start": {
          if (phase === "thinking" || phase === "writing") {
            // Stop the spinner so tool logs appear cleanly on the next lines.
            spinner.stop();
          }
          phase = "tools";
          toolCallIndex++;
          console.log(fmt.toolCallLog(event.name, event.args, toolCallIndex));
          break;
        }

        // ── Tool results ──
        case "tool_end": {
          console.log(
            fmt.toolResultLog(event.success, event.summary, event.durationMs),
          );
          break;
        }

        // ── Done ──
        case "done": {
          if (spinner.isRunning) spinner.succeed("done");
          printDone(hasReceivedText ? assistantText : event.text);
          printTodoPanel();
          return;
        }

        // ── Error ──
        case "error": {
          if (spinner.isRunning) spinner.fail("failed");
          printErrorSummary(event.message);
          return;
        }
      }
    }
  } catch (error) {
    if (spinner.isRunning) spinner.stop();
    const message = error instanceof Error ? error.message : String(error);
    printErrorSummary(message);
  }
}

// ── Main CLI loop ────────────────────────────────────────────────

export async function runCli(): Promise<void> {
  const history: ChatMessage[] = [];
  let submittedPrompts = 0;
  const sessionStart = Date.now();

  printBanner();

  while (true) {
    let query: string;

    try {
      query = await input({
        message: pc.cyan("nano"),
        theme: {
          prefix: pc.cyan("◆"),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        console.log();
        break;
      }
      throw error;
    }

    if (isExitCommand(query)) {
      break;
    }

    if (isInternalCommand(query)) {
      await handleInternalCommand(query, history, submittedPrompts);
      continue;
    }

    history.push({
      role: "user",
      content: query,
    });
    submittedPrompts += 1;
    console.log(fmt.userPrompt(query));
    await handleAgentStream(history);
  }

  // Session summary
  const elapsed = Date.now() - sessionStart;
  console.log(fmt.sessionSummary(submittedPrompts, elapsed));
  console.log();
}
