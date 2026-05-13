import {
  runBash,
  runEditFile,
  runReadFile,
  runWriteFile,
} from "./handlers.js";
import { runTask } from "./taskTool.js";
import { runTodo } from "./todoTool.js";
import { runLoadSkill } from "./skillTool.js";
import { runCompact } from "./compactTool.js";
import type { ToolSpec } from "./types.js";

export const toolRegistry = {
  bash: {
    concurrency: "unsafe",
    availableToSubagent: true,
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
    availableToSubagent: true,
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
    availableToSubagent: true,
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
    availableToSubagent: true,
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
  todo: {
    concurrency: "unsafe",
    availableToSubagent: false,
    handler: runTodo,
    definition: {
      type: "function",
      function: {
        name: "todo",
        description:
          "Replace the current session plan. Use for multi-step tasks and keep exactly one item in_progress.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "The complete current plan for this session.",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "The task step.",
                  },
                  status: {
                    type: "string",
                    enum: ["pending", "in_progress", "completed"],
                  },
                  activeForm: {
                    type: "string",
                    description: "Natural ongoing form when this item is in progress.",
                  },
                },
                required: ["content", "status"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  },
  task: {
    concurrency: "unsafe",
    availableToSubagent: false,
    handler: runTask,
    definition: {
      type: "function",
      function: {
        name: "task",
        description:
          "Run a focused subtask in a clean subagent context and return only its summary.",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "A focused, self-contained prompt for the subagent.",
            },
            description: {
              type: "string",
              description: "Short human-readable description of the subtask.",
            },
          },
          required: ["prompt"],
        },
      },
    },
  },
  load_skill: {
    concurrency: "safe",
    availableToSubagent: true,
    handler: runLoadSkill,
    definition: {
      type: "function",
      function: {
        name: "load_skill",
        description: "Load the full body of a named skill into the current context.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the skill to load.",
            },
          },
          required: ["name"],
        },
      },
    },
  },
  compact: {
    concurrency: "unsafe",
    availableToSubagent: false,
    handler: runCompact,
    definition: {
      type: "function",
      function: {
        name: "compact",
        description:
          "Compact the active conversation history into a continuity summary when context is getting large.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
  },
} satisfies Record<string, ToolSpec>;

export type ToolName = keyof typeof toolRegistry;
