import { ok, fail } from "@/lib/api";
import { readHealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await readHealthSnapshot();
    return ok(snapshot);
  } catch (error) {
    return fail("Unable to read health status", 500, String(error));
  }
}
