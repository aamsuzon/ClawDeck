import fs from "node:fs/promises";
import { z } from "zod";
import { ALLOWED_CHANNELS, MAX_MESSAGE_CHARS, PICO_JOBS_PATH } from "@/lib/paths";

export type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  nextRunAtMs?: number;
  message?: string;
  channel?: string;
  to?: string;
};

const cronExprRegex = /^([\d*/,-]+\s){4}[\d*/,-]+$/;

const cronCreateSchema = z.object({
  name: z.string().trim().min(3).max(80),
  schedule: z
    .string()
    .trim()
    .refine((value) => cronExprRegex.test(value), "Invalid cron expression format"),
  message: z.string().trim().min(2).max(MAX_MESSAGE_CHARS),
  deliver: z.boolean().default(false),
  channel: z.enum(ALLOWED_CHANNELS).optional(),
  to: z.string().trim().max(128).optional(),
});

const cronPatchSchema = z.object({
  action: z.enum(["enable", "disable", "remove"]),
  force: z.boolean().optional(),
});

export function parseCreateCronBody(input: unknown) {
  return cronCreateSchema.parse(input);
}

export function parsePatchCronBody(input: unknown) {
  return cronPatchSchema.parse(input);
}

type RawJobs = {
  jobs?: Array<{
    id?: string;
    name?: string;
    enabled?: boolean;
    schedule?: { expr?: string };
    payload?: { message?: string; channel?: string; to?: string };
    state?: { nextRunAtMs?: number };
  }>;
};

export async function readCronJobs(): Promise<CronJob[]> {
  const raw = await fs.readFile(PICO_JOBS_PATH, "utf8");
  const parsed = JSON.parse(raw) as RawJobs;

  return (parsed.jobs ?? []).map((job) => ({
    id: String(job.id ?? ""),
    name: String(job.name ?? "Unnamed job"),
    enabled: Boolean(job.enabled),
    schedule: String(job.schedule?.expr ?? ""),
    nextRunAtMs: job.state?.nextRunAtMs,
    message: job.payload?.message,
    channel: job.payload?.channel,
    to: job.payload?.to,
  }));
}
