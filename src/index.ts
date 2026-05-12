import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { agentLoop } from "./agent.js";
import type { ChatMessage } from "./model.js";

async function main() {
  const readline = createInterface({ input, output });

  const history: ChatMessage[] = [];

  while (true) {
    let query: string;

    try {
      query = await readline.question("nano >> ");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ERR_USE_AFTER_CLOSE") {
        break;
      }

      throw error;
    }

    if (["", "q", "exit"].includes(query.trim().toLowerCase())) {
      break;
    }

    history.push({
      role: "user",
      content: query,
    });

    const reply = await agentLoop(history);

    console.log(`${reply}\n`);
  }

  readline.close();
}

main();
