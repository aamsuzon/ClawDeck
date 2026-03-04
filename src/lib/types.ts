export type HealthData = {
  gatewayUp: boolean;
  workspaceOk: boolean;
  checkedAt: string;
  gatewayHealth?: {
    status?: string;
    uptime?: string;
  };
  statusText?: string;
};

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

export type MessagingChannelUi = {
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

export type ModelUi = {
  modelName: string;
  model: string;
  provider: string;
  modelId: string;
  apiBase: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
};

export type ConfigUiData = {
  messagingChannels: MessagingChannelUi[];
  models: ModelUi[];
};

export type VersionInfo = {
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

export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
};
