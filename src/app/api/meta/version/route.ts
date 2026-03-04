import fs from "node:fs/promises";
import path from "node:path";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

type VersionPayload = {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  checkedAt: string;
  repo: string;
  repoUrl: string;
  releaseUrl: string | null;
  latestPublishedAt: string | null;
  latestCheckError: string | null;
};

function parseSemver(version: string): number[] {
  const clean = version.trim().replace(/^v/i, "").split("-")[0] ?? "";
  const parts = clean.split(".").map((item) => Number.parseInt(item, 10));

  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareSemver(current: string, latest: string): number {
  const a = parseSemver(current);
  const b = parseSemver(latest);

  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;

  return 0;
}

async function readCurrentVersion(): Promise<string> {
  const packagePath = path.join(process.cwd(), "package.json");
  const raw = await fs.readFile(packagePath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };

  return parsed.version?.trim() || "0.0.0";
}

export async function GET() {
  const repo = process.env.CLAWDECK_GITHUB_REPO?.trim() || "aamsuzon/clawdeck";
  const repoUrl = `https://github.com/${repo}`;
  const currentVersion = await readCurrentVersion();

  const payload: VersionPayload = {
    currentVersion,
    latestVersion: null,
    hasUpdate: false,
    checkedAt: new Date().toISOString(),
    repo,
    repoUrl,
    releaseUrl: null,
    latestPublishedAt: null,
    latestCheckError: null,
  };

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "ClawDeck-Version-Checker",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      payload.latestCheckError = `GitHub API status ${response.status}`;
      return ok(payload);
    }

    const data = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
      published_at?: string;
    };

    const latestVersion = (data.tag_name || "").trim();
    payload.latestVersion = latestVersion || null;
    payload.releaseUrl = data.html_url || `${repoUrl}/releases`;
    payload.latestPublishedAt = data.published_at || null;
    payload.hasUpdate = latestVersion ? compareSemver(currentVersion, latestVersion) < 0 : false;

    return ok(payload);
  } catch (error) {
    payload.latestCheckError = String(error);
    return ok(payload);
  }
}

