import { ok, fail } from "@/lib/api";
import { parsePatchCronBody } from "@/lib/cron";
import { runCronAction } from "@/lib/picoclaw";
import { classifyRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = parsePatchCronBody(await request.json());

    const risk = classifyRisk(
      payload.action === "remove" ? "CRON_REMOVE" : payload.action === "enable" ? "CRON_ENABLE" : "CRON_DISABLE",
    );

    const result = await runCronAction(payload.action, id);

    return ok({
      message: `Cron job ${payload.action}d`,
      risk,
      cli: result,
    });
  } catch (error) {
    return fail("Unable to update cron job", 400, String(error));
  }
}