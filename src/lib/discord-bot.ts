import { createPublicKey, verify } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { thisWeekStandings } from "@/lib/weekly";

/*
 * The /ask slash command in the AI Editors Discord. Discord calls
 * /api/discord/interactions; we answer "thinking…" at once, then ask Claude and
 * edit that reply with the answer. No gateway connection, so nothing extra to
 * host. Env:
 *   DISCORD_APP_ID      — the Discord application's ID (public).
 *   DISCORD_PUBLIC_KEY  — its public key, to check requests really come from Discord.
 *   DISCORD_BOT_TOKEN   — only used once, by /api/discord/register, to add /ask.
 *   ANTHROPIC_API_KEY   — shared with the brief checker.
 */

export const AI_EDITORS_GUILD_ID = "1399674473778774137";

// Ed25519 public keys come from Discord as 32 raw bytes in hex; Node wants SPKI.
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function isFromDiscord(rawBody: string, signature: string | null, timestamp: string | null) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

async function systemPrompt() {
  const rules = await prisma.clientRule.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { category: true, text: true, detail: true },
  });
  const ruleLines = rules.map((r) => `- [${r.category}] ${r.text}${r.detail ? ` (${r.detail})` : ""}`);

  return [
    "You are the assistant in the AHMD.GPT \"AI Editors\" Discord. AHMD.GPT is an agency that makes AI UGC video ads; the people asking you are its video editors and admins.",
    "Help with editing questions: AI video tools (Veo, Kling, etc.), prompts, pacing, hooks, captions, audio, and the client's rules below. Be practical and concrete.",
    "Keep answers short enough for a Discord message (well under 1,800 characters). Plain Discord markdown only.",
    "You can't see anyone's pay, logins, or private portal data, and you can't change anything in the portal. If asked, say so and point them to the portal or an admin.",
    "",
    "Client rules every video must pass:",
    ruleLines.length ? ruleLines.join("\n") : "- (none set)",
  ].join("\n");
}

export async function answerQuestion(question: string, askedBy: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: await systemPrompt(),
    messages: [
      {
        role: "user",
        content: `Videos logged this week so far:\n${await thisWeekStandings()}\n\n${askedBy} asks: ${question}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return "Sorry, I can't help with that one.";
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return text || "I couldn't come up with an answer, try rephrasing.";
}

/** Replaces the deferred "thinking…" reply with the real answer. */
export async function editOriginalReply(interactionToken: string, content: string) {
  const appId = process.env.DISCORD_APP_ID;
  await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 2000), allowed_mentions: { parse: [] } }),
  });
}
