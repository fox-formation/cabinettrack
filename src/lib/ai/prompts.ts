/**
 * Chargement des prompts depuis /prompts/*.md
 * Les prompts ne sont jamais inline dans le code (règle CLAUDE.md).
 */

import fs from "fs"
import path from "path"

const PROMPTS_DIR = path.join(process.cwd(), "prompts")

const cache = new Map<string, string>()

export function loadPrompt(filename: string): string {
  if (cache.has(filename)) {
    return cache.get(filename)!
  }

  const filePath = path.join(PROMPTS_DIR, filename)
  const content = fs.readFileSync(filePath, "utf-8")
  cache.set(filename, content)
  return content
}
