"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  ConfigUiData,
  CronJob,
  HealthData,
  SessionDetail,
  SessionListItem,
  VersionInfo,
} from "@/lib/types";

type Notice = { tone: "info" | "success" | "error"; text: string };

type CronForm = {
  name: string;
  schedule: string;
  message: string;
  deliver: boolean;
  channel: string;
  to: string;
};

const DEFAULT_CRON_FORM: CronForm = {
  name: "PM Daily Standup 11AM",
  schedule: "0 11 * * *",
  message: "11AM Daily Standup: PM collect blockers and post summary to Jupitar.",
  deliver: true,
  channel: "telegram",
  to: "",
};

const TIMELINE_PAGE_SIZE = 8;
const MESSAGE_PREVIEW_CHARS = 520;
const FACEBOOK_URL = "https://facebook.com/aamsuzon";
const GITHUB_PROFILE_URL = "https://github.com/aamsuzon";
const LINKEDIN_URL = "https://www.linkedin.com/in/aamsuzon/";
const PROVIDER_PRESETS: Array<{ id: string; label: string; defaultBase: string }> = [
  { id: "anthropic", label: "Anthropic", defaultBase: "https://api.anthropic.com/v1" },
  { id: "openai", label: "OpenAI", defaultBase: "https://api.openai.com/v1" },
  { id: "openrouter", label: "OpenRouter", defaultBase: "https://openrouter.ai/api/v1" },
  { id: "google", label: "Google", defaultBase: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "deepseek", label: "DeepSeek", defaultBase: "https://api.deepseek.com/v1" },
  { id: "mistral", label: "Mistral", defaultBase: "https://api.mistral.ai/v1" },
  { id: "groq", label: "Groq", defaultBase: "https://api.groq.com/openai/v1" },
  { id: "ollama", label: "Ollama", defaultBase: "http://localhost:11434/v1" },
  { id: "custom", label: "Custom", defaultBase: "" },
];

function pickPreferredChannel(channels: ConfigUiData["messagingChannels"]) {
  return (
    channels.find((item) => item.id === "telegram" && item.hasToken) ??
    channels.find((item) => item.enabled && item.hasToken) ??
    channels.find((item) => item.hasToken) ??
    channels.find((item) => item.enabled) ??
    channels[0] ??
    null
  );
}

function pickPreferredModel(models: ConfigUiData["models"]) {
  return (
    models.find((item) => item.hasApiKey) ??
    models.find((item) => item.provider === "anthropic") ??
    models[0] ??
    null
  );
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

export function MissionControl() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [agentMessage, setAgentMessage] = useState("Provide current status and next steps.");
  const [agentResponse, setAgentResponse] = useState("");
  const [cronForm, setCronForm] = useState<CronForm>(DEFAULT_CRON_FORM);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>({ tone: "info", text: "Initializing ClawDeck mission console..." });
  const [timelinePage, setTimelinePage] = useState(1);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  const [configUi, setConfigUi] = useState<ConfigUiData | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedTokenField, setSelectedTokenField] = useState("");
  const [channelEnabled, setChannelEnabled] = useState(false);
  const [channelToken, setChannelToken] = useState("");
  const [channelAllowFrom, setChannelAllowFrom] = useState("");
  const [channelMentionOnly, setChannelMentionOnly] = useState(false);
  const [channelReasoningChannelId, setChannelReasoningChannelId] = useState("");

  const [selectedModelName, setSelectedModelName] = useState("");
  const [modelFormName, setModelFormName] = useState("");
  const [modelProvider, setModelProvider] = useState("anthropic");
  const [modelId, setModelId] = useState("");
  const [modelApiKey, setModelApiKey] = useState("");
  const [modelApiBase, setModelApiBase] = useState("");
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const sessionCount = sessions.length;
  const messageCount = useMemo(() => sessions.reduce((sum, item) => sum + item.messageCount, 0), [sessions]);

  const timelineMessages = useMemo(() => sessionDetail?.messages ?? [], [sessionDetail]);
  const timelineTotalPages = Math.max(1, Math.ceil(timelineMessages.length / TIMELINE_PAGE_SIZE));
  const paginatedMessages = useMemo(() => {
    const start = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
    return timelineMessages.slice(start, start + TIMELINE_PAGE_SIZE);
  }, [timelineMessages, timelinePage]);

  const selectedChannel = useMemo(
    () => configUi?.messagingChannels.find((item) => item.id === selectedChannelId),
    [configUi, selectedChannelId],
  );

  const selectedModel = useMemo(
    () => configUi?.models.find((item) => item.modelName === selectedModelName),
    [configUi, selectedModelName],
  );

  const availableTokenFields = useMemo(() => {
    if (!selectedChannel) {
      return [];
    }

    const set = new Set<string>();

    for (const item of selectedChannel.secretFields) {
      set.add(item.key);
    }

    if (selectedChannel.tokenField) {
      set.add(selectedChannel.tokenField);
    }

    if (set.size === 0) {
      set.add("token");
    }

    return Array.from(set);
  }, [selectedChannel]);

  const selectedSecretField = useMemo(() => {
    if (!selectedChannel || !selectedTokenField) {
      return null;
    }

    return selectedChannel.secretFields.find((item) => item.key === selectedTokenField) ?? null;
  }, [selectedChannel, selectedTokenField]);

  const channelOptions = useMemo(
    () => configUi?.messagingChannels.map((item) => item.id) ?? ["telegram", "discord", "slack", "line"],
    [configUi],
  );

  const updateDismissKey = useMemo(
    () => (versionInfo?.latestVersion ? `clawdeck:update-dismissed:${versionInfo.latestVersion}` : ""),
    [versionInfo?.latestVersion],
  );

  const releaseUrl = useMemo(() => {
    if (!versionInfo) {
      return GITHUB_PROFILE_URL;
    }

    return versionInfo.releaseUrl || `${versionInfo.repoUrl}/releases`;
  }, [versionInfo]);

  const hasVersionUpdateNotice = Boolean(versionInfo?.hasUpdate && !updateDismissed);

  const loadHealth = useCallback(async () => {
    const { body } = await apiRequest<HealthData>("/api/bridge/health");
    if (body.ok && body.data) {
      setHealth(body.data);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    const { body } = await apiRequest<{ sessions: SessionListItem[] }>("/api/bridge/sessions");
    if (body.ok && body.data) {
      const next = body.data.sessions;
      setSessions(next);
      setSelectedSessionId((prev) => prev || next[0]?.id || "");
    }
  }, []);

  const loadSessionDetail = useCallback(async (id: string) => {
    if (!id) {
      return;
    }

    const { body } = await apiRequest<SessionDetail>(`/api/bridge/sessions/${encodeURIComponent(id)}`);
    if (body.ok && body.data) {
      setSessionDetail(body.data);
    }
  }, []);

  const loadCron = useCallback(async () => {
    const { body } = await apiRequest<{ jobs: CronJob[] }>("/api/bridge/cron");
    if (body.ok && body.data) {
      setCronJobs(body.data.jobs);
    }
  }, []);

  const loadConfigUi = useCallback(async () => {
    const { body } = await apiRequest<ConfigUiData>("/api/bridge/config/ui");
    if (body.ok && body.data) {
      const data = body.data;
      setConfigUi(data);
      const preferredChannel = pickPreferredChannel(data.messagingChannels);
      const preferredModel = pickPreferredModel(data.models);

      setSelectedChannelId((prev) => {
        if (prev && data.messagingChannels.some((item) => item.id === prev)) {
          return prev;
        }
        return preferredChannel?.id ?? "";
      });

      setSelectedModelName((prev) => {
        if (prev && data.models.some((item) => item.modelName === prev)) {
          return prev;
        }
        return preferredModel?.modelName ?? "";
      });

      setCronForm((state) => ({
        ...state,
        channel: data.messagingChannels.some((item) => item.id === state.channel)
          ? state.channel
          : preferredChannel?.id ?? state.channel,
      }));
    }
  }, []);

  const loadVersionInfo = useCallback(async () => {
    const { body } = await apiRequest<VersionInfo>("/api/meta/version");
    if (body.ok && body.data) {
      setVersionInfo(body.data);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsBusy(true);
    try {
      await Promise.all([loadHealth(), loadSessions(), loadCron(), loadConfigUi(), loadVersionInfo()]);
      setNotice({ tone: "success", text: "Synced with local PicoClaw runtime." });
    } catch (error) {
      setNotice({ tone: "error", text: `Refresh failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }, [loadConfigUi, loadCron, loadHealth, loadSessions, loadVersionInfo]);

  useEffect(() => {
    refreshAll();
    const timer = setInterval(loadHealth, 6000);
    return () => clearInterval(timer);
  }, [loadHealth, refreshAll]);

  useEffect(() => {
    loadSessionDetail(selectedSessionId);
  }, [loadSessionDetail, selectedSessionId]);

  useEffect(() => {
    setTimelinePage(1);
    setExpandedMessages({});
  }, [selectedSessionId]);

  useEffect(() => {
    setTimelinePage((prev) => Math.min(prev, timelineTotalPages));
  }, [timelineTotalPages]);

  useEffect(() => {
    if (!selectedChannel) {
      return;
    }

    setChannelEnabled(selectedChannel.enabled);
    setSelectedTokenField(selectedChannel.tokenField ?? selectedChannel.secretFields[0]?.key ?? "token");
    setChannelToken("");
    setChannelAllowFrom(selectedChannel.allowFrom.join(", "));
    setChannelMentionOnly(selectedChannel.mentionOnly);
    setChannelReasoningChannelId(selectedChannel.reasoningChannelId);
  }, [selectedChannel]);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    setModelFormName(selectedModel.modelName);
    setModelProvider(selectedModel.provider || "custom");
    setModelId(selectedModel.modelId || selectedModel.model);
    setModelApiKey("");
    setModelApiBase(selectedModel.apiBase);
  }, [selectedModel]);

  useEffect(() => {
    if (!updateDismissKey) {
      setUpdateDismissed(false);
      return;
    }

    const dismissed = window.localStorage.getItem(updateDismissKey) === "1";
    setUpdateDismissed(dismissed);
  }, [updateDismissKey]);

  useEffect(() => {
    if (selectedModelName) {
      return;
    }

    setModelFormName("");
    setModelProvider("anthropic");
    setModelId("");
    setModelApiBase("https://api.anthropic.com/v1");
  }, [selectedModelName]);

  useEffect(() => {
    if (!channelOptions.includes(cronForm.channel) && channelOptions.length > 0) {
      setCronForm((state) => ({ ...state, channel: selectedChannelId || channelOptions[0] || "telegram" }));
    }
  }, [channelOptions, cronForm.channel, selectedChannelId]);

  async function sendAgentMessage() {
    if (!agentMessage.trim()) {
      setNotice({ tone: "error", text: "Message cannot be empty." });
      return;
    }

    setIsBusy(true);
    try {
      const { body } = await apiRequest<{ output: string; stderr?: string }>("/api/bridge/agent/message", {
        method: "POST",
        body: JSON.stringify({
          agent: "main",
          message: agentMessage,
          session: `ui:${Date.now()}`,
        }),
      });

      if (!body.ok) {
        throw new Error(body.error ?? "Unknown error");
      }

      setAgentResponse(body.data?.output ?? "No output");
      setNotice({ tone: "success", text: "Agent executed successfully." });
      await loadSessions();
    } catch (error) {
      setNotice({ tone: "error", text: `Agent call failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }

  async function createCronJob() {
    setIsBusy(true);
    try {
      const payload = {
        name: cronForm.name,
        schedule: cronForm.schedule,
        message: cronForm.message,
        deliver: cronForm.deliver,
        channel: cronForm.channel || undefined,
        to: cronForm.to || undefined,
      };

      const { body } = await apiRequest<{ message: string }>("/api/bridge/cron", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!body.ok) {
        throw new Error(body.error ?? "Cron create failed");
      }

      setNotice({ tone: "success", text: body.data?.message ?? "Cron job created." });
      await loadCron();
    } catch (error) {
      setNotice({ tone: "error", text: `Cron create failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }

  async function patchCron(id: string, action: "enable" | "disable" | "remove") {
    if (action === "remove") {
      const confirmed = window.confirm("Remove this cron job permanently?");
      if (!confirmed) {
        return;
      }
    }

    setIsBusy(true);
    try {
      const { body } = await apiRequest<{ message: string }>(`/api/bridge/cron/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });

      if (!body.ok) {
        throw new Error(body.error ?? "Cron patch failed");
      }

      setNotice({ tone: "success", text: body.data?.message ?? "Cron updated." });
      await loadCron();
    } catch (error) {
      setNotice({ tone: "error", text: `Cron update failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }

  async function restartGateway() {
    const confirmed = window.confirm("Restart PicoClaw gateway now?");
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      const { body } = await apiRequest<{ message: string }>("/api/bridge/gateway", {
        method: "POST",
        body: JSON.stringify({ action: "restart", force: true }),
      });

      if (!body.ok) {
        throw new Error(body.error ?? "Gateway restart failed");
      }

      setNotice({ tone: "success", text: body.data?.message ?? "Gateway restarted." });
      await loadHealth();
    } catch (error) {
      setNotice({ tone: "error", text: `Gateway restart failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }

  async function saveMessagingConfig() {
    if (!selectedChannelId) {
      setNotice({ tone: "error", text: "Select a messaging channel first." });
      return;
    }

    const confirmed = window.confirm("This updates live bot configuration. Continue?");
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      const { body } = await apiRequest<{ message: string }>("/api/bridge/config/ui/messaging", {
        method: "PUT",
        body: JSON.stringify({
          channelId: selectedChannelId,
          enabled: channelEnabled,
          tokenField: selectedTokenField || undefined,
          token: channelToken || undefined,
          allowFromCsv: channelAllowFrom,
          mentionOnly: channelMentionOnly,
          reasoningChannelId: channelReasoningChannelId,
          force: true,
        }),
      });

      if (!body.ok) {
        throw new Error(body.error ?? "Messaging config update failed");
      }

      setNotice({ tone: "success", text: body.data?.message ?? "Messaging config updated." });
      await loadConfigUi();
    } catch (error) {
      setNotice({ tone: "error", text: `Messaging config failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }

  async function saveModelConfig() {
    const normalizedModelName = modelFormName.trim();
    const normalizedModelId = modelId.trim();

    if (!normalizedModelName) {
      setNotice({ tone: "error", text: "Model profile name is required." });
      return;
    }

    if (!normalizedModelId) {
      setNotice({ tone: "error", text: "Model ID is required (example: claude-opus-4.1)." });
      return;
    }

    if (!modelApiKey.trim()) {
      setNotice({ tone: "error", text: "API key is required for model update." });
      return;
    }

    const provider = modelProvider.trim();
    const modelRef = normalizedModelId.includes("/")
      ? normalizedModelId
      : provider && provider !== "custom"
        ? `${provider}/${normalizedModelId}`
        : normalizedModelId;

    const confirmed = window.confirm(
      "This will update or create a model profile in local config. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      const { body } = await apiRequest<{ message: string }>("/api/bridge/config/ui/model", {
        method: "PUT",
        body: JSON.stringify({
          modelName: normalizedModelName,
          modelRef,
          apiKey: modelApiKey,
          apiBase: modelApiBase,
          force: true,
        }),
      });

      if (!body.ok) {
        throw new Error(body.error ?? "Model config update failed");
      }

      setNotice({ tone: "success", text: body.data?.message ?? "Model profile saved." });
      await loadConfigUi();
      setSelectedModelName(normalizedModelName);
      setModelApiKey("");
    } catch (error) {
      setNotice({ tone: "error", text: `Model config failed: ${String(error)}` });
    } finally {
      setIsBusy(false);
    }
  }

  function startNewModelProfile() {
    setSelectedModelName("");
    setModelFormName("");
    setModelProvider("anthropic");
    setModelId("");
    setModelApiBase("https://api.anthropic.com/v1");
    setModelApiKey("");
  }

  function useProviderDefaultBase() {
    const preset = PROVIDER_PRESETS.find((item) => item.id === modelProvider);
    setModelApiBase(preset?.defaultBase ?? "");
  }

  function dismissUpdateNotice() {
    if (!updateDismissKey) {
      return;
    }

    window.localStorage.setItem(updateDismissKey, "1");
    setUpdateDismissed(true);
  }

  function toggleMessageExpand(messageKey: string) {
    setExpandedMessages((prev) => ({
      ...prev,
      [messageKey]: !prev[messageKey],
    }));
  }

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <section className="mb-6 rounded-[28px] border border-[#113f47]/30 bg-[#f4f0e4]/90 p-6 shadow-[0_20px_60px_rgba(7,42,48,0.15)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8a3f2e]">Local-First Agent Console</p>
            <h1 className="font-display text-5xl leading-none text-[#0f2f35] md:text-7xl">ClawDeck</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#234f57]">
              Mission Control UI for PicoClaw. No terminal required. Visual timeline, safe operations, and channel-aware
              automation in one cockpit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge label={health?.gatewayUp ? "Gateway Online" : "Gateway Offline"} tone={health?.gatewayUp ? "good" : "bad"} />
            <Badge label={health?.workspaceOk ? "Workspace Ready" : "Workspace Missing"} tone={health?.workspaceOk ? "good" : "bad"} />
            <Badge label={`Sessions ${sessionCount}`} />
            <Badge label={`Messages ${messageCount}`} />
            <Badge label={`Version v${versionInfo?.currentVersion ?? "0.1.0"}`} />
            <button
              className="rounded-full border border-[#0f2f35] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0f2f35] transition hover:bg-[#0f2f35] hover:text-[#f4f0e4]"
              onClick={refreshAll}
              disabled={isBusy}
            >
              {isBusy ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>
        <NoticeBar notice={notice} />
        {hasVersionUpdateNotice ? (
          <div className="mt-3 rounded-2xl border border-amber-700/30 bg-amber-200/70 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">New update available: {versionInfo?.latestVersion}</p>
            <p className="mt-1 text-xs">
              You are on v{versionInfo?.currentVersion}. Please update for latest fixes and features.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                className="chip"
                href={releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                View Release
              </a>
              <button className="chip" onClick={dismissUpdateNotice}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricCard label="Active Session" value={selectedSessionId || "none"} />
          <MetricCard label="Timeline Pages" value={`${timelineTotalPages}`} />
          <MetricCard label="Visible Messages" value={`${paginatedMessages.length}`} />
          <MetricCard label="Cron Jobs" value={`${cronJobs.length}`} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article className="panel xl:col-span-3">
          <h2 className="panel-title">Sessions</h2>
          <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {sessions.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedSessionId(item.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selectedSessionId === item.id
                    ? "border-[#0f2f35] bg-[#0f2f35] text-[#f5e7cd]"
                    : "border-[#0f2f35]/15 bg-white/60 text-[#13353b] hover:bg-white"
                }`}
              >
                <p className="truncate text-xs uppercase tracking-[0.12em]">{item.key}</p>
                <p className="mt-1 line-clamp-2 text-sm">{item.summary}</p>
                <p className="mt-2 text-[11px] opacity-75">{item.messageCount} messages</p>
              </button>
            ))}
          </div>
        </article>

        <article className="panel xl:col-span-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="panel-title !mb-0">Mission Timeline</h2>
            <div className="flex items-center gap-2">
              <button
                className="chip"
                onClick={() => setTimelinePage((prev) => Math.max(1, prev - 1))}
                disabled={timelinePage <= 1}
              >
                Prev
              </button>
              <span className="rounded-full border border-[#0f2f35]/20 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[#173b42]">
                Page {timelinePage} / {timelineTotalPages}
              </span>
              <button
                className="chip"
                onClick={() => setTimelinePage((prev) => Math.min(timelineTotalPages, prev + 1))}
                disabled={timelinePage >= timelineTotalPages}
              >
                Next
              </button>
            </div>
          </div>
          <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
            {paginatedMessages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#0f2f35]/25 bg-white/50 p-5 text-sm text-[#35535a]">
                No messages found in this session.
              </div>
            ) : null}
            {paginatedMessages.map((message) => {
              const messageKey = `${sessionDetail?.id ?? "na"}-${message.index}`;
              const rawText = message.content ?? "";
              const isLongMessage = rawText.length > MESSAGE_PREVIEW_CHARS;
              const isExpanded = Boolean(expandedMessages[messageKey]);
              const displayText =
                message.content && isLongMessage && !isExpanded
                  ? `${rawText.slice(0, MESSAGE_PREVIEW_CHARS)}...`
                  : message.content;

              return (
                <div
                  key={`${message.index}-${message.role}`}
                  className={`timeline-card ${
                    message.role === "assistant"
                      ? "timeline-assistant"
                      : message.role === "user"
                        ? "timeline-user"
                        : "timeline-system"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-[#35535a]">
                    <span className="font-semibold">{message.role}</span>
                    <span>#{message.index}</span>
                  </div>
                  {displayText ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#143940]">{displayText}</p>
                  ) : (
                    <pre className="overflow-x-auto text-xs text-[#143940]">{JSON.stringify(message.contentJson, null, 2)}</pre>
                  )}
                  {message.content && isLongMessage ? (
                    <button
                      className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8a3f2e]"
                      onClick={() => toggleMessageExpand(messageKey)}
                    >
                      {isExpanded ? "Show less" : "Load more"}
                    </button>
                  ) : null}
                  {message.toolCalls ? (
                    <details className="mt-2 text-xs text-[#29525a]">
                      <summary className="cursor-pointer">Tool calls</summary>
                      <pre className="mt-1 overflow-x-auto rounded-xl bg-[#0f2f35] p-2 text-[#f5e7cd]">
                        {JSON.stringify(message.toolCalls, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              );
            })}
            {timelineTotalPages > 1 ? (
              <div className="sticky bottom-0 mt-2 flex items-center justify-between rounded-xl border border-[#0f2f35]/15 bg-[#f4f0e4]/95 p-2">
                <span className="text-[11px] uppercase tracking-[0.12em] text-[#35535a]">
                  Showing {(timelinePage - 1) * TIMELINE_PAGE_SIZE + 1}-
                  {Math.min(timelinePage * TIMELINE_PAGE_SIZE, timelineMessages.length)} of {timelineMessages.length}
                </span>
                <div className="flex gap-2">
                  <button className="chip" onClick={() => setTimelinePage((prev) => Math.max(1, prev - 1))} disabled={timelinePage <= 1}>
                    Prev
                  </button>
                  <button
                    className="chip"
                    onClick={() => setTimelinePage((prev) => Math.min(timelineTotalPages, prev + 1))}
                    disabled={timelinePage >= timelineTotalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className="panel xl:col-span-3">
          <h2 className="panel-title">Action Console</h2>

          <div className="space-y-5">
            <section>
              <p className="section-label">Agent Message</p>
              <textarea value={agentMessage} onChange={(event) => setAgentMessage(event.target.value)} className="field min-h-24" />
              <button className="action-button" onClick={sendAgentMessage} disabled={isBusy}>
                Run Agent
              </button>
              {agentResponse ? <pre className="result-box">{agentResponse}</pre> : null}
            </section>

            <section>
              <p className="section-label">Gateway</p>
              <button className="action-button warning" onClick={restartGateway} disabled={isBusy}>
                Restart Gateway (High Risk)
              </button>
            </section>

            <section>
              <p className="section-label">Create Cron Job</p>
              <input
                className="field"
                value={cronForm.name}
                onChange={(event) => setCronForm((s) => ({ ...s, name: event.target.value }))}
                placeholder="Job name"
              />
              <input
                className="field"
                value={cronForm.schedule}
                onChange={(event) => setCronForm((s) => ({ ...s, schedule: event.target.value }))}
                placeholder="0 11 * * *"
              />
              <textarea
                className="field min-h-20"
                value={cronForm.message}
                onChange={(event) => setCronForm((s) => ({ ...s, message: event.target.value }))}
                placeholder="Job message"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="field"
                  value={cronForm.channel}
                  onChange={(event) => setCronForm((s) => ({ ...s, channel: event.target.value }))}
                >
                  {channelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  value={cronForm.to}
                  onChange={(event) => setCronForm((s) => ({ ...s, to: event.target.value }))}
                  placeholder="recipient id"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#234f57]">
                <input
                  type="checkbox"
                  checked={cronForm.deliver}
                  onChange={(event) => setCronForm((s) => ({ ...s, deliver: event.target.checked }))}
                />
                Deliver result to channel
              </label>
              <button className="action-button" onClick={createCronJob} disabled={isBusy}>
                Add Cron
              </button>
            </section>
          </div>
        </article>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article className="panel xl:col-span-7">
          <h2 className="panel-title">Configuration Center</h2>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[#0f2f35]/15 bg-white/60 p-4">
              <p className="section-label">Messaging Bot Configuration</p>

              <div className="mb-3 rounded-2xl border border-[#0f2f35]/15 bg-[#f7f2e7] p-3">
                <p className="section-label">Available Bots / Channels</p>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {(configUi?.messagingChannels ?? []).map((channel) => (
                    <button
                      key={channel.id}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selectedChannelId === channel.id
                          ? "border-[#0f2f35] bg-[#0f2f35] text-[#f6e8cd]"
                          : "border-[#0f2f35]/20 bg-white/80 text-[#15383f] hover:bg-white"
                      }`}
                      onClick={() => setSelectedChannelId(channel.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold uppercase tracking-[0.12em]">{channel.id}</span>
                        <span>{channel.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      <p className="mt-1 opacity-80">Token: {channel.hasToken ? "Configured" : "Not set"}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="section-label">Selected Channel</label>
                  <select className="field" value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)}>
                    {(configUi?.messagingChannels ?? []).map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="section-label">Token Field</label>
                  <select className="field" value={selectedTokenField} onChange={(event) => setSelectedTokenField(event.target.value)}>
                    {availableTokenFields.map((tokenField) => (
                      <option key={tokenField} value={tokenField}>
                        {tokenField}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-2 rounded-xl border border-[#0f2f35]/15 bg-[#f7f2e7] px-3 py-2 text-xs text-[#2d4f56]">
                <p>Current Token Mask: {selectedSecretField?.masked ?? selectedChannel?.tokenMasked ?? "Not set"}</p>
                <p>Allow From Count: {selectedChannel?.allowFrom.length ?? 0}</p>
                <p>Reasoning Channel: {selectedChannel?.reasoningChannelId || "Not set"}</p>
              </div>

              <input
                className="field"
                type="password"
                value={channelToken}
                onChange={(event) => setChannelToken(event.target.value)}
                placeholder={`New ${selectedTokenField || selectedChannel?.tokenField || "token"} (leave blank to keep current)`}
              />

              <label className="flex items-center gap-2 text-xs text-[#234f57]">
                <input type="checkbox" checked={channelEnabled} onChange={(event) => setChannelEnabled(event.target.checked)} />
                Enable channel
              </label>

              <input
                className="field"
                value={channelAllowFrom}
                onChange={(event) => setChannelAllowFrom(event.target.value)}
                placeholder="Allow from IDs (comma separated)"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-[#234f57]">
                  <input
                    type="checkbox"
                    checked={channelMentionOnly}
                    onChange={(event) => setChannelMentionOnly(event.target.checked)}
                  />
                  Mention only mode
                </label>
                <input
                  className="field"
                  value={channelReasoningChannelId}
                  onChange={(event) => setChannelReasoningChannelId(event.target.value)}
                  placeholder="Reasoning Channel ID (optional)"
                />
              </div>

              <button className="action-button" onClick={saveMessagingConfig} disabled={isBusy || !selectedChannelId}>
                Save Messaging Config
              </button>
            </section>

            <section className="rounded-2xl border border-[#0f2f35]/15 bg-white/60 p-4">
              <p className="section-label">AI API Key Configuration</p>

              <div className="mb-3 rounded-2xl border border-[#0f2f35]/15 bg-[#f7f2e7] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="section-label !mb-0">Model Profiles</p>
                  <button className="chip" onClick={startNewModelProfile}>
                    New Profile
                  </button>
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {(configUi?.models ?? []).map((model) => (
                    <button
                      key={model.modelName}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selectedModelName === model.modelName
                          ? "border-[#0f2f35] bg-[#0f2f35] text-[#f6e8cd]"
                          : "border-[#0f2f35]/20 bg-white/80 text-[#15383f] hover:bg-white"
                      }`}
                      onClick={() => setSelectedModelName(model.modelName)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{model.modelName}</span>
                        <span>{model.hasApiKey ? "Key set" : "No key"}</span>
                      </div>
                      <p className="mt-1 opacity-80">
                        {model.provider || "custom"} / {model.modelId || model.model}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="section-label">Edit Existing</label>
                  <select className="field" value={selectedModelName} onChange={(event) => setSelectedModelName(event.target.value)}>
                    <option value="">None (new profile)</option>
                    {(configUi?.models ?? []).map((model) => (
                      <option key={model.modelName} value={model.modelName}>
                        {model.modelName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="section-label">Profile Name</label>
                  <input
                    className="field"
                    value={modelFormName}
                    onChange={(event) => setModelFormName(event.target.value)}
                    placeholder="claude-opus"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="section-label">Provider</label>
                  <select className="field" value={modelProvider} onChange={(event) => setModelProvider(event.target.value)}>
                    {PROVIDER_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="self-end">
                  <button className="chip" onClick={useProviderDefaultBase}>
                    Use Provider Base
                  </button>
                </div>
              </div>

              <input
                className="field"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                placeholder="Model ID (example: claude-opus-4.1)"
              />

              {selectedModel ? (
                <div className="mb-2 rounded-xl border border-[#0f2f35]/15 bg-[#f7f2e7] px-3 py-2 text-xs text-[#2d4f56]">
                  <p>Current Model Ref: {selectedModel.model}</p>
                  <p>Current API Base: {selectedModel.apiBase || "n/a"}</p>
                  <p>Stored Key: {selectedModel.apiKeyMasked || "Not set"}</p>
                </div>
              ) : (
                <div className="mb-2 rounded-xl border border-dashed border-[#0f2f35]/20 bg-white/70 px-3 py-2 text-xs text-[#35535a]">
                  Create a new model profile by setting name + provider + model ID + API key.
                </div>
              )}

              <input
                className="field"
                type="password"
                value={modelApiKey}
                onChange={(event) => setModelApiKey(event.target.value)}
                placeholder="New API key"
              />
              <input
                className="field"
                value={modelApiBase}
                onChange={(event) => setModelApiBase(event.target.value)}
                placeholder="API base (provider default or custom)"
              />
              <button className="action-button" onClick={saveModelConfig} disabled={isBusy}>
                Save / Create Model Profile
              </button>
            </section>
          </div>
        </article>

        <article className="panel xl:col-span-5">
          <h2 className="panel-title">Cron Timeline</h2>
          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            {cronJobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-[#0f2f35]/20 bg-white/70 p-3 text-sm text-[#1a4148]">
                <p className="font-semibold">{job.name}</p>
                <p className="text-xs uppercase tracking-[0.08em] opacity-70">{job.schedule}</p>
                <p className="mt-1 text-xs">{job.enabled ? "Enabled" : "Disabled"}</p>
                <p className="text-xs opacity-80">Next: {job.nextRunAtMs ? new Date(job.nextRunAtMs).toLocaleString() : "n/a"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="chip" onClick={() => patchCron(job.id, "enable")}>Enable</button>
                  <button className="chip" onClick={() => patchCron(job.id, "disable")}>Disable</button>
                  <button className="chip danger" onClick={() => patchCron(job.id, "remove")}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer className="mt-6 rounded-[24px] border border-[#0f2f35]/20 bg-[#f7f0e2]/90 p-4 text-[#1f474f] shadow-[0_12px_30px_rgba(7,42,48,0.12)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs leading-5">
            <p className="font-semibold uppercase tracking-[0.14em] text-[#7d4030]">
              ClawDeck v{versionInfo?.currentVersion ?? "0.1.0"}
            </p>
            <p className="text-[#234f57]">
              Credit to build: Aam Suzon. For next updates, follow or star the GitHub repo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a className="chip" href={FACEBOOK_URL} target="_blank" rel="noreferrer">
              Facebook
            </a>
            <a className="chip" href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="chip" href={LINKEDIN_URL} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a className="chip" href={versionInfo?.repoUrl ?? GITHUB_PROFILE_URL} target="_blank" rel="noreferrer">
              Follow Repo
            </a>
          </div>
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-[#42656d]">
          Auto update check: {versionInfo?.latestVersion ? `latest ${versionInfo.latestVersion}` : "latest not available yet"}
        </p>
      </footer>
    </div>
  );
}

function NoticeBar({ notice }: { notice: Notice }) {
  const palette =
    notice.tone === "success"
      ? "border-emerald-700/30 bg-emerald-200/60 text-emerald-950"
      : notice.tone === "error"
        ? "border-red-700/30 bg-red-200/60 text-red-950"
        : "border-sky-700/30 bg-sky-200/60 text-sky-950";

  return <div className={`mt-4 rounded-2xl border px-4 py-2 text-sm ${palette}`}>{notice.text}</div>;
}

function Badge({ label, tone = "default" }: { label: string; tone?: "default" | "good" | "bad" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-700/30 bg-emerald-200/60 text-emerald-950"
      : tone === "bad"
        ? "border-red-700/30 bg-red-200/60 text-red-950"
        : "border-[#0f2f35]/20 bg-white/70 text-[#13353b]";

  return <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.12em] ${toneClass}`}>{label}</span>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value" title={value}>
        {value}
      </p>
    </div>
  );
}
