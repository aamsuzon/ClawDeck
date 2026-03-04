import { ok, fail } from "@/lib/api";
import { parseConfigUpdateBody, readSafeConfig, writeConfig } from "@/lib/config";
import { classifyRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await readSafeConfig();
    return ok({ config });
  } catch (error) {
    return fail("Unable to read safe config", 500, String(error));
  }
}

export async function PUT(request: Request) {
  try {
    const payload = parseConfigUpdateBody(await request.json());
    const risk = classifyRisk("CONFIG_UPDATE");

    if (risk.requiresApproval && payload.force !== true) {
      return fail("Explicit approval required for high-risk config update", 409, risk);
    }

    await writeConfig(payload.config);

    return ok({
      message: "Config updated",
      risk,
    });
  } catch (error) {
    return fail("Unable to update config", 400, String(error));
  }
}
