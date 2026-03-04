import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { MAX_MESSAGE_CHARS } from "@/lib/paths";
import { runAgentMessage } from "@/lib/picoclaw";
import { classifyRisk } from "@/lib/risk";

const messageSchema = z.object({
  agent: z.string().trim().min(1).max(64).default("main"),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  session: z.string().trim().max(120).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = messageSchema.parse(await request.json());
    const risk = classifyRisk("AGENT_MESSAGE");

    const result = await runAgentMessage(payload.message, payload.session);

    return ok({
      agent: payload.agent,
      risk,
      output: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    return fail("Unable to send agent message", 400, String(error));
  }
}
