import { runPicoclawStatus } from "@/lib/picoclaw";
import { PICO_GATEWAY_HEALTH, PICO_WORKSPACE } from "@/lib/paths";
import fs from "node:fs/promises";

export type HealthSnapshot = {
  gatewayUp: boolean;
  gatewayHealth?: unknown;
  statusText?: string;
  workspaceOk: boolean;
  checkedAt: string;
};

export async function readHealthSnapshot(): Promise<HealthSnapshot> {
  const checkedAt = new Date().toISOString();

  let gatewayUp = false;
  let gatewayHealth: unknown = null;

  try {
    const response = await fetch(PICO_GATEWAY_HEALTH, { cache: "no-store" });
    gatewayUp = response.ok;
    gatewayHealth = await response.json();
  } catch {
    gatewayUp = false;
  }

  let statusText = "";
  try {
    const status = await runPicoclawStatus();
    statusText = status.stdout;
  } catch {
    statusText = "status_unavailable";
  }

  let workspaceOk = false;
  try {
    const stat = await fs.stat(PICO_WORKSPACE);
    workspaceOk = stat.isDirectory();
  } catch {
    workspaceOk = false;
  }

  return {
    gatewayUp,
    gatewayHealth,
    statusText,
    workspaceOk,
    checkedAt,
  };
}
