/**
 * Client Anthropic Claude API.
 * Modèle : claude-sonnet-4-20250514 (jamais changer — règle CLAUDE.md).
 * Toujours parser JSON dans try/catch → null en cas d'erreur.
 */

import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = "claude-sonnet-4-20250514"

export async function callClaude(
  systemPrompt: string,
  userContent: string,
  maxTokens: number = 1000
): Promise<string | null> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    })

    const block = response.content[0]
    if (block.type === "text") {
      return block.text
    }
    return null
  } catch (err) {
    console.error("[Claude API] Error:", err instanceof Error ? err.message : err)
    return null
  }
}
