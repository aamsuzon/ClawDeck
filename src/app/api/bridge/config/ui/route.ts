import { ok, fail } from "@/lib/api";
import { readConfigUiData } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readConfigUiData();
    return ok(data);
  } catch (error) {
    return fail("Unable to load config UI data", 500, String(error));
  }
}
