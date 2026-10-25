import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { AI_EDITORS_GUILD_ID } from "@/lib/discord-bot";

export const dynamic = "force-dynamic";

// One-off setup: the owner opens this URL while logged in to add (or update)
// the /ask command in the AI Editors server. Safe to open again.
export async function GET() {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Log in as the owner first." }, { status: 401 });
  }

  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !token) {
    return NextResponse.json({ error: "DISCORD_APP_ID and DISCORD_BOT_TOKEN must be set." }, { status: 500 });
  }

  const res = await fetch(
    `https://discord.com/api/v10/applications/${appId}/guilds/${AI_EDITORS_GUILD_ID}/commands`,
    {
      method: "PUT",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          name: "ask",
          description: "Ask the AHMD.GPT assistant (Claude) anything about editing",
          options: [
            { type: 3, name: "question", description: "Your question", required: true, max_length: 1500 },
          ],
        },
      ]),
    },
  );

  const body = await res.json().catch(() => null);
  return NextResponse.json({ ok: res.ok, status: res.status, discord: body });
}
