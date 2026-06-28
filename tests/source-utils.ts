import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

export function readSource(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

export function assertContains(source: string, patterns: string[]): boolean {
  return patterns.every((pattern) => source.includes(pattern));
}
