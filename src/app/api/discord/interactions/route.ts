import { NextRequest, NextResponse, after } from "next/server";
import { answerQuestion, editOriginalReply, isFromDiscord } from "@/lib/discord-bot";

export const dynamic = "force-dynamic";

// Discord's Interactions Endpoint URL. See lib/discord-bot.ts.
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const DEFERRED_CHANNEL_MESSAGE = 5;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const ok = isFromDiscord(
    rawBody,
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
  );
  if (!ok) return new NextResponse("Bad signature", { status: 401 });

  const interaction = JSON.parse(rawBody);

  if (interaction.type === PING) {
    return NextResponse.json({ type: PONG });
  }

  if (interaction.type === APPLICATION_COMMAND && interaction.data?.name === "ask") {
    const question: string =
      interaction.data.options?.find((o: { name: string }) => o.name === "question")?.value ?? "";
    const user = interaction.member?.user ?? interaction.user;
    const askedBy: string = interaction.member?.nick || user?.global_name || user?.username || "Someone";

    // Discord needs an answer within 3 seconds; Claude can take longer, so say
    // "thinking…" now and edit the reply once the answer is ready.
    after(async () => {
      let answer: string;
      try {
        answer = await answerQuestion(question, askedBy);
      } catch (err) {
        console.error("Discord /ask failed", err);
        answer = "Something went wrong on my side, try again in a minute.";
      }
      await editOriginalReply(interaction.token, `> ${question.slice(0, 300)}\n\n${answer}`);
    });

    return NextResponse.json({ type: DEFERRED_CHANNEL_MESSAGE });
  }

  return NextResponse.json({ error: "Unknown command." }, { status: 400 });
}
