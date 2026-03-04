import path from "node:path";

const USER_HOME = process.env.USERPROFILE ?? process.env.HOME ?? "C:\\Users\\ACT";

export const PICO_HOME = process.env.PICO_HOME ?? path.join(USER_HOME, ".picoclaw");
export const PICO_WORKSPACE = process.env.PICO_WORKSPACE ?? path.join(PICO_HOME, "workspace");
export const PICO_CONFIG_PATH = process.env.PICO_CONFIG_PATH ?? path.join(PICO_HOME, "config.json");
export const PICO_SESSIONS_DIR = path.join(PICO_WORKSPACE, "sessions");
export const PICO_STATE_PATH = path.join(PICO_WORKSPACE, "state", "state.json");
export const PICO_JOBS_PATH = path.join(PICO_WORKSPACE, "cron", "jobs.json");

export const PICO_EXE =
  process.env.PICO_EXE ??
  (process.platform === "win32" ? "C:\\picoclaw\\picoclaw.exe" : "picoclaw");

export const PICO_GATEWAY_HEALTH = process.env.PICO_GATEWAY_HEALTH ?? "http://127.0.0.1:18790/health";

export const ALLOWED_CHANNELS = [
  "telegram",
  "discord",
  "slack",
  "line",
  "wecom",
  "wecom_app",
  "qq",
  "dingtalk",
  "onebot",
  "pico",
  "whatsapp",
  "feishu",
] as const;

export const MAX_MESSAGE_CHARS = 3000;
