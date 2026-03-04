import { ok, fail } from "@/lib/api";
import { getSessionById } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getSessionById(id);
    return ok(session);
  } catch (error) {
    return fail("Unable to load session", 404, String(error));
  }
}