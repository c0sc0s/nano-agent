import path from "node:path";

export const WORKDIR = process.cwd();

export function safePath(inputPath: string): string {
  const resolvedPath = path.resolve(WORKDIR, inputPath);
  const relativePath = path.relative(WORKDIR, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }

  return resolvedPath;
}
