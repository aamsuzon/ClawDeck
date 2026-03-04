export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskDecision = {
  level: RiskLevel;
  reason: string;
  requiresApproval: boolean;
};

export function classifyRisk(action: string): RiskDecision {
  switch (action) {
    case "CONFIG_UPDATE":
      return {
        level: "HIGH",
        reason: "Config update can break gateway and expose secrets if misconfigured.",
        requiresApproval: true,
      };
    case "GATEWAY_RESTART":
      return {
        level: "HIGH",
        reason: "Gateway restart interrupts active channels and scheduled operations.",
        requiresApproval: true,
      };
    case "CRON_REMOVE":
      return {
        level: "MEDIUM",
        reason: "Removing jobs can break automation flow.",
        requiresApproval: false,
      };
    case "CRON_ADD":
    case "CRON_ENABLE":
    case "CRON_DISABLE":
      return {
        level: "MEDIUM",
        reason: "Cron changes alter automated behavior.",
        requiresApproval: false,
      };
    default:
      return {
        level: "LOW",
        reason: "Read-only or low-impact action.",
        requiresApproval: false,
      };
  }
}
