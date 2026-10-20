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
        text: z
          .string()
          .describe("The check: a specific requirement of this video, phrased so 'yes' means the video gets it right."),
        brief_quote: z
          .string()
          .describe("The exact words from the brief this check comes from. Copied, not paraphrased."),
      }),
    )
    .describe("The key points of this brief, most important first."),
});

export type BriefCheck = { text: string; detail: string };

const SYSTEM = `You help a video-editing agency stop making mistakes that cost revision rounds.
The agency makes short health-supplement ads: AI UGC ads (an AI avatar talking to camera) and B-roll videos (a story told over B-roll clips).

Read the whole concept brief carefully, as a senior editor would before starting the job, and pull out its key points: the specific things this video must get right that an editor skimming the brief would miss or get wrong. Turn each into one check.

What matters most, in roughly this order:
- The avatar / narrator: who they are, age, gender, look, setting, and the exact emotion or delivery for each part of the script (e.g. worried while describing the symptom, relieved at the result). Be specific to this script, not "looks serious".
- The people in the story (husband, mom, kid...): who each one is, their age and look, and which lines or scenes they appear in.
- The structure: what the hook is and what must happen in it, the order of the beats, where the product reveal goes, the call to action.
- Exact lines, numbers, claims, prices, offers or on-screen text that must appear word for word.
- What each key scene or B-roll moment must show, and how the product and ingredients must look.
- Anything the brief says to avoid, and any constraint like length, format, music or pacing.

Every check must name something specific from this brief: a person, an age, a line, a scene, a number, a product detail. If a check would make sense for any ad, it is too generic — leave it out. Never repeat the standing rules you are given; they are already on the checklist.
Write plainly for editors whose second language is English: short sentences, no jargon, each check something you can confirm by watching the video.
Usually 5 to 12 checks. Don't pad a thin brief.`;

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
    // Reading a long brief closely is the whole job here; a few extra seconds
    // of thinking buys checks that are actually specific.
    output_config: { effort: "high", format: betaZodOutputFormat(BriefChecksSchema) },
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
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Couldn't read checks out of this brief.");
  }
  // A check with no quote behind it is a guess, not a key point of the brief.
  return response.parsed_output.checks
    .filter((c) => c.brief_quote.trim())
    .slice(0, 14)
    .map((c) => ({ text: c.text, detail: `Brief: "${c.brief_quote.trim()}"` }));
}
