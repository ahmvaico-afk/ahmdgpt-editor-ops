import { after } from "next/server";

// Posts a line to the AI Editors Discord (#portal-activity) through a channel
// webhook. Runs after the response is sent so Discord can never slow down or
// break a portal request. No-op when DISCORD_WEBHOOK_URL isn't set (local dev).
// The channel is visible to every editor, so never put money amounts in here.
export function notifyDiscord(content: string) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;
  after(() => postDiscord(content));
}

/** Awaitable version, for callers that need to know the post went out. */
export async function postDiscord(content: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.slice(0, 2000),
        username: "AHMD.GPT Portal",
        // The ahmdgpt.com eye logo, rendered to PNG (Discord won't take SVG).
        avatar_url: "https://lionfish-app-3km5x.ondigitalocean.app/discord-avatar.png",
        // Titles are typed by editors; don't let one ping @everyone.
        allowed_mentions: { parse: [] },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Discord notify failed", err);
    return false;
  }
}

const STATUS_LINE: Record<string, string> = {
  approved: "✅ approved",
  rejected: "❌ sent back",
  paid: "💸 marked paid",
  submitted: "↩️ moved back to submitted",
};

export function statusLine(status: string) {
  return STATUS_LINE[status] ?? status;
}
