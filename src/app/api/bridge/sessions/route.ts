import { ok, fail } from "@/lib/api";
import { listSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await listSessions();
    return ok({ sessions, count: sessions.length });
  } catch (error) {
    return fail("Unable to load sessions", 500, String(error));
  }
}
