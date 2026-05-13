import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { SkillDocument, SkillManifest } from "./types.js";

const SKILLS_DIR = path.join(process.cwd(), "skills");

function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);

  if (!match) {
    return {
      meta: {},
      body: text,
    };
  }

  const frontmatter = match[1] ?? "";
  const body = match[2] ?? "";
  const meta: Record<string, string> = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      meta[key] = value;
    }
  }

  return {
    meta,
    body,
  };
}

function findSkillFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();

    if (!currentDir) {
      continue;
    }

    for (const entry of readdirSyncWithTypes(currentDir)) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === "SKILL.md") {
        files.push(entryPath);
      }
    }
  }

  return files.sort();
}

function readdirSyncWithTypes(dirPath: string) {
  return readdirSync(dirPath, { withFileTypes: true });
}

export class SkillRegistry {
  #documents = new Map<string, SkillDocument>();

  constructor(private readonly skillsDir: string = SKILLS_DIR) {
    this.reload();
  }

  reload(): void {
    this.#documents.clear();

    for (const skillPath of findSkillFiles(this.skillsDir)) {
      const text = readFileSync(skillPath, "utf8");
      const { meta, body } = parseFrontmatter(text);
      const name = meta["name"] || path.basename(path.dirname(skillPath));
      const description = meta["description"] || "No description";
      const manifest: SkillManifest = {
        name,
        description,
        path: path.relative(process.cwd(), skillPath),
      };

      this.#documents.set(name, {
        manifest,
        body: body.trim(),
      });
    }
  }

  describeAvailable(): string {
    if (this.#documents.size === 0) {
      return "(no skills available)";
    }

    return [...this.#documents.values()]
      .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
      .map((document) => `- ${document.manifest.name}: ${document.manifest.description}`)
      .join("\n");
  }

  listManifests(): SkillManifest[] {
    return [...this.#documents.values()]
      .map((document) => document.manifest)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  loadFullText(name: string): string {
    const document = this.#documents.get(name);

    if (!document) {
      const known = [...this.#documents.keys()].sort().join(", ") || "(none)";
      return `Error: Unknown skill '${name}'. Available skills: ${known}`;
    }

    return `<skill name="${document.manifest.name}">\n${document.body}\n</skill>`;
  }
}
