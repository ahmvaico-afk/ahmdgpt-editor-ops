import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AD_TYPE_LABELS, type AdType } from "@/lib/ad-types";

/*
 * Reads a concept brief and writes the checks that are specific to it — who's
 * in the story, who it's aimed at, what the product shots must show — on top
 * of the client's standing rules. Optional: without ANTHROPIC_API_KEY the
 * checklist is just the standing rules, and QA adds brief lines by hand.
 */

const BriefChecksSchema = z.object({
  checks: z
    .array(
      z.object({
        text: z.string().describe("The check, phrased so 'yes' means the video is right."),
        detail: z.string().describe("One short line of how/why, quoting the brief where useful."),
      }),
    )
    .describe("Checks specific to this brief, most important first."),
});

export type BriefCheck = z.infer<typeof BriefChecksSchema>["checks"][number];

const SYSTEM = `You help a video-editing agency stop making mistakes that cost revision rounds.
The agency makes short health-supplement ads for one client: AI UGC ads (an AI actor talking to camera) and B-roll videos (a story told over B-roll clips).
Given a concept brief, write the checks an editor should tick before sending THIS video to QA.

Only write checks that come from this brief: the specific people in the story and keeping each one the same person throughout, who the ad targets (so the people on screen match), the product and ingredients that must be shown and how they should look, required hooks, lines, claims or on-screen text, tone, and anything the brief says to avoid.
Do not repeat the standing rules you are given — they are already on the checklist.
Write plainly for editors whose second language is English: short sentences, no jargon. Each check is one concrete, visible thing someone can confirm by watching the video.
Between 3 and 10 checks. Fewer is better than padding.`;

export function briefAiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function checksFromBrief(
  brief: string,
  adType: AdType,
  standingRules: string[],
): Promise<BriefCheck[]> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // If a safety filter ever declines a supplement brief, retry on another
    // model in the same call rather than failing the whole checklist.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Ad type: ${AD_TYPE_LABELS[adType]}

Standing rules already on the checklist (don't repeat these):
${standingRules.map((r) => `- ${r}`).join("\n")}

<brief>
${brief}
</brief>`,
      },
    ],
    output_config: { format: betaZodOutputFormat(BriefChecksSchema) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Couldn't read checks out of this brief.");
  }
  return response.parsed_output.checks.slice(0, 12);
}
