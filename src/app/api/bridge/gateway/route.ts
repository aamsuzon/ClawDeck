import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { readHealthSnapshot } from "@/lib/health";
import { restartGatewayWindows } from "@/lib/picoclaw";
import { classifyRisk } from "@/lib/risk";

const gatewayActionSchema = z.object({
  action: z.enum(["restart"]),
  force: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await readHealthSnapshot();
    return ok(snapshot);
  } catch (error) {
    return fail("Unable to read gateway state", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = gatewayActionSchema.parse(await request.json());
    const risk = classifyRisk("GATEWAY_RESTART");

    if (risk.requiresApproval && payload.force !== true) {
      return fail("Explicit approval required for gateway restart", 409, risk);
    }

    const result = await restartGatewayWindows();
    return ok({
      message: "Gateway restarted",
      risk,
      cli: result,
    });
  } catch (error) {
    return fail("Unable to restart gateway", 400, String(error));
  }
}
