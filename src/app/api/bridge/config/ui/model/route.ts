import { ok, fail } from "@/lib/api";
import { parseModelUpdateBody, updateModelConfig } from "@/lib/config";
import { classifyRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const payload = parseModelUpdateBody(await request.json());
    const risk = classifyRisk("CONFIG_UPDATE");

    if (risk.requiresApproval && payload.force !== true) {
      return fail("Explicit approval required for model config update", 409, risk);
    }

    await updateModelConfig(payload);

    return ok({
      message: "Model API configuration updated",
      risk,
    });
  } catch (error) {
    return fail("Unable to update model config", 400, String(error));
  }
}
