import fs from "node:fs/promises";
import { z } from "zod";
import { PICO_CONFIG_PATH } from "@/lib/paths";
import { isSecretLikeKey, redactObject } from "@/lib/redact";

const configUpdateSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  force: z.boolean().optional(),
});

const messagingUpdateSchema = z.object({
  channelId: z.string().trim().min(1),
  enabled: z.boolean(),
  tokenField: z.string().trim().min(1).max(128).optional(),
  token: z.string().trim().max(4096).optional(),
  allowFromCsv: z.string().max(2048).optional(),
  mentionOnly: z.boolean().optional(),
  reasoningChannelId: z.string().max(128).optional(),
  force: z.boolean().optional(),
});

const modelUpdateSchema = z.object({
  modelName: z.string().trim().min(1),
  modelRef: z.string().trim().min(1).optional(),
  apiKey: z.string().trim().min(1).max(4096),
  apiBase: z.string().trim().max(1024).optional(),
  force: z.boolean().optional(),
});

const tokenFieldPriority = [
  "token",
  "bot_token",
  "app_token",
  "channel_access_token",
  "channel_secret",
  "app_secret",
  "corp_secret",
  "client_secret",
  "access_token",
  "webhook_url",
] as const;

type AnyObject = Record<string, unknown>;

type MessagingChannelUi = {
  id: string;
  enabled: boolean;
  hasToken: boolean;
  tokenField: string | null;
  tokenMasked: string | null;
  secretFields: Array<{
    key: string;
    masked: string | null;
    hasValue: boolean;
  }>;
  allowFrom: string[];
  mentionOnly: boolean;
  reasoningChannelId: string;
};

type ModelUi = {
  modelName: string;
  model: string;
  provider: string;
  modelId: string;
  apiBase: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export function parseConfigUpdateBody(input: unknown) {
  return configUpdateSchema.parse(input);
}

export function parseMessagingUpdateBody(input: unknown) {
  return messagingUpdateSchema.parse(input);
}

export function parseModelUpdateBody(input: unknown) {
  return modelUpdateSchema.parse(input);
}

function maskSecret(value: string): string {
  if (!value) {
    return "";
  }

  if (value.length <= 6) {
    return "***";
  }

  return `${value.slice(0, 3)}${"*".repeat(Math.max(3, value.length - 5))}${value.slice(-2)}`;
}

function pickTokenField(channel: AnyObject): string | null {
  for (const key of tokenFieldPriority) {
    if (typeof channel[key] === "string") {
      return key;
    }
  }

  const dynamic = Object.keys(channel).find((key) => isSecretLikeKey(key) && typeof channel[key] === "string");
  return dynamic ?? null;
}

function listSecretFields(channel: AnyObject): Array<{ key: string; value: string }> {
  const seen = new Set<string>();
  const fields: Array<{ key: string; value: string }> = [];

  for (const key of tokenFieldPriority) {
    const value = channel[key];
    if (typeof value === "string") {
      seen.add(key);
      fields.push({ key, value });
    }
  }

  for (const [key, value] of Object.entries(channel)) {
    if (!seen.has(key) && typeof value === "string" && isSecretLikeKey(key)) {
      fields.push({ key, value });
    }
  }

  return fields;
}

function splitModelRef(modelRef: string): { provider: string; modelId: string } {
  const trimmed = modelRef.trim();
  const slashIndex = trimmed.indexOf("/");

  if (slashIndex <= 0 || slashIndex >= trimmed.length - 1) {
    return { provider: "", modelId: trimmed };
  }

  return {
    provider: trimmed.slice(0, slashIndex),
    modelId: trimmed.slice(slashIndex + 1),
  };
}

async function readRawConfig(): Promise<AnyObject> {
  const raw = await fs.readFile(PICO_CONFIG_PATH, "utf8");
  return JSON.parse(raw) as AnyObject;
}

async function writeRawConfig(config: AnyObject) {
  const payload = JSON.stringify(config, null, 2);
  await fs.writeFile(PICO_CONFIG_PATH, payload, "utf8");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

export async function readSafeConfig() {
  const parsed = await readRawConfig();
  return redactObject(parsed);
}

export async function writeConfig(config: Record<string, unknown>) {
  await writeRawConfig(config as AnyObject);
}

export async function readConfigUiData(): Promise<{ messagingChannels: MessagingChannelUi[]; models: ModelUi[] }> {
  const config = await readRawConfig();
  const channelsRoot = (config.channels as AnyObject | undefined) ?? {};
  const messagingChannels: MessagingChannelUi[] = Object.entries(channelsRoot).map(([id, value]) => {
    const channel = (value as AnyObject | undefined) ?? {};
    const tokenField = pickTokenField(channel);
    const tokenValue = tokenField ? String(channel[tokenField] ?? "") : "";
    const secretFields = listSecretFields(channel);
    const groupTrigger = (channel.group_trigger as AnyObject | undefined) ?? {};

    return {
      id,
      enabled: Boolean(channel.enabled),
      hasToken: Boolean(tokenValue),
      tokenField,
      tokenMasked: tokenValue ? maskSecret(tokenValue) : null,
      secretFields: secretFields.map((item) => ({
        key: item.key,
        masked: item.value ? maskSecret(item.value) : null,
        hasValue: Boolean(item.value),
      })),
      allowFrom: toStringArray(channel.allow_from),
      mentionOnly: Boolean(channel.mention_only ?? groupTrigger.mention_only ?? false),
      reasoningChannelId: String(channel.reasoning_channel_id ?? ""),
    };
  });

  const modelList = Array.isArray(config.model_list) ? (config.model_list as AnyObject[]) : [];
  const models: ModelUi[] = modelList.map((item) => {
    const apiKey = String(item.api_key ?? "");
    const modelRef = String(item.model ?? "");
    const parsedRef = splitModelRef(modelRef);

    return {
      modelName: String(item.model_name ?? ""),
      model: modelRef,
      provider: parsedRef.provider,
      modelId: parsedRef.modelId,
      apiBase: String(item.api_base ?? ""),
      hasApiKey: Boolean(apiKey),
      apiKeyMasked: apiKey ? maskSecret(apiKey) : "",
    };
  });

  return { messagingChannels, models };
}

export async function updateMessagingConfig(input: z.infer<typeof messagingUpdateSchema>) {
  const config = await readRawConfig();
  const channelsRoot = ((config.channels as AnyObject | undefined) ?? {}) as AnyObject;
  const channel = ((channelsRoot[input.channelId] as AnyObject | undefined) ?? {}) as AnyObject;

  channel.enabled = input.enabled;

  const tokenField = input.tokenField?.trim() || pickTokenField(channel) || "token";
  if (input.token && input.token.length > 0) {
    channel[tokenField] = input.token;
  }

  if (typeof input.allowFromCsv === "string") {
    channel.allow_from = input.allowFromCsv
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof input.mentionOnly === "boolean") {
    channel.mention_only = input.mentionOnly;
  }

  if (typeof input.reasoningChannelId === "string") {
    channel.reasoning_channel_id = input.reasoningChannelId;
  }

  channelsRoot[input.channelId] = channel;
  config.channels = channelsRoot;

  await writeRawConfig(config);
}

export async function updateModelConfig(input: z.infer<typeof modelUpdateSchema>) {
  const config = await readRawConfig();
  const modelList = Array.isArray(config.model_list) ? (config.model_list as AnyObject[]) : [];

  const modelName = input.modelName.trim();
  const modelRef = input.modelRef?.trim();
  const found = modelList.find((item) => String(item.model_name ?? "") === modelName);

  if (found) {
    if (modelRef) {
      found.model = modelRef;
    }
    found.api_key = input.apiKey;

    if (typeof input.apiBase === "string") {
      found.api_base = input.apiBase;
    }
  } else {
    if (!modelRef) {
      throw new Error("Model reference is required for a new model (example: anthropic/claude-opus-4.1)");
    }

    modelList.push({
      model_name: modelName,
      model: modelRef,
      api_base: input.apiBase ?? "",
      api_key: input.apiKey,
    });
  }

  config.model_list = modelList;
  await writeRawConfig(config);
}
