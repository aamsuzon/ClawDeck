import { ok, fail } from "@/lib/api";
import { parseCreateCronBody, readCronJobs } from "@/lib/cron";
import { runCronAdd } from "@/lib/picoclaw";
import { classifyRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await readCronJobs();
    return ok({ jobs, count: jobs.length });
  } catch (error) {
    return fail("Unable to load cron jobs", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = parseCreateCronBody(await request.json());
    const risk = classifyRisk("CRON_ADD");

    const result = await runCronAdd({
      name: payload.name,
      cron: payload.schedule,
      message: payload.message,
      deliver: payload.deliver,
      channel: payload.channel,
      to: payload.to,
    });

    return ok({
      message: "Cron job created",
      risk,
      cli: result,
    }, 201);
  } catch (error) {
    return fail("Unable to create cron job", 400, String(error));
  }
}
