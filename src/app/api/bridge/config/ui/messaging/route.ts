import { ok, fail } from "@/lib/api";
import { parseMessagingUpdateBody, updateMessagingConfig } from "@/lib/config";
import { classifyRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const payload = parseMessagingUpdateBody(await request.json());
    const risk = classifyRisk("CONFIG_UPDATE");

    if (risk.requiresApproval && payload.force !== true) {
      return fail("Explicit approval required for messaging config update", 409, risk);
    }

    await updateMessagingConfig(payload);

    return ok({
      message: "Messaging configuration updated",
      risk,
    });
  } catch (error) {
    return fail("Unable to update messaging config", 400, String(error));
  }
}
