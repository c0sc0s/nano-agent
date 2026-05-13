import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

marked.use(
  markedTerminal({
    width: Math.max(60, process.stdout.columns || 80),
    reflowText: true,
    showSectionPrefix: false,
  }),
);

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, {
    async: false,
  });

  return rendered.trimEnd();
}
