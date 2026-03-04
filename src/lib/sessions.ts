import fs from "node:fs/promises";
import path from "node:path";
import { PICO_SESSIONS_DIR } from "@/lib/paths";

export type SessionListItem = {
  id: string;
  key: string;
  created?: string;
  updated?: string;
  messageCount: number;
  summary: string;
};

export type SessionMessage = {
  index: number;
  role: string;
  content: string | null;
  contentJson: unknown;
  toolCalls: unknown;
  toolCallId: string | null;
};

export type SessionDetail = {
  id: string;
  key: string;
  created?: string;
  updated?: string;
  summary?: string;
  messages: SessionMessage[];
};

type RawSession = {
  key?: string;
  created?: string;
  updated?: string;
  summary?: string;
  messages?: Array<Record<string, unknown>>;
};

async function readSessionFile(filePath: string): Promise<RawSession> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as RawSession;
}

function extractSummary(session: RawSession): string {
  if (typeof session.summary === "string" && session.summary.trim()) {
    return session.summary.slice(0, 220);
  }

  const messages = session.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === "assistant" && typeof msg.content === "string" && msg.content.trim()) {
      return msg.content.slice(0, 220);
    }
  }

  return "No summary available";
}

export async function listSessions(): Promise<SessionListItem[]> {
  const entries = await fs.readdir(PICO_SESSIONS_DIR, { withFileTypes: true });
  const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

  const results = await Promise.all(
    jsonFiles.map(async (entry) => {
      const id = entry.name;
      const filePath = path.join(PICO_SESSIONS_DIR, entry.name);
      const raw = await readSessionFile(filePath);

      return {
        id,
        key: raw.key ?? entry.name.replace(/\.json$/, ""),
        created: raw.created,
        updated: raw.updated,
        messageCount: raw.messages?.length ?? 0,
        summary: extractSummary(raw),
      } satisfies SessionListItem;
    }),
  );

  return results.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
}

export async function getSessionById(id: string): Promise<SessionDetail> {
  const safeId = path.basename(id);
  const filePath = path.join(PICO_SESSIONS_DIR, safeId);
  const raw = await readSessionFile(filePath);

  const messages = (raw.messages ?? []).map((msg, idx) => {
    const content = msg.content;

    return {
      index: idx + 1,
      role: String(msg.role ?? "unknown"),
      content: typeof content === "string" ? content : null,
      contentJson: typeof content === "string" ? null : content,
      toolCalls: msg.tool_calls ?? null,
      toolCallId: typeof msg.tool_call_id === "string" ? msg.tool_call_id : null,
    } satisfies SessionMessage;
  });

  return {
    id: safeId,
    key: raw.key ?? safeId.replace(/\.json$/, ""),
    created: raw.created,
    updated: raw.updated,
    summary: typeof raw.summary === "string" ? raw.summary : undefined,
    messages,
  };
}
