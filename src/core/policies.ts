import type { ActionProposal, AgentName, LoadedConfig, RunMode } from "./types.js";

function severityRank(level: string): number {
  switch (level) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

export function isKillSwitchEnabled(): boolean {
  return `${process.env.AGENT_KILL_SWITCH ?? "false"}`.toLowerCase() === "true";
}

export function getAutonomyMode(config: LoadedConfig, requestedMode: RunMode): RunMode {
  if (requestedMode !== "active") {
    return requestedMode;
  }

  const envMode = process.env.AUTONOMY_MODE;
  if (envMode === "observe") {
    return "observe";
  }
  if (envMode === "active") {
    return "active";
  }
  return config.policies.defaultAutonomyMode;
}

export function canExecuteAction(
  config: LoadedConfig,
  agent: AgentName,
  proposal: ActionProposal,
  mode: RunMode
): { allowed: boolean; reason?: string } {
  if (proposal.action_type === "create_issue") {
    return { allowed: true };
  }

  if (mode === "dry-run" || mode === "observe") {
    return { allowed: false, reason: `mode:${mode}` };
  }

  if (isKillSwitchEnabled()) {
    return { allowed: false, reason: "kill-switch-enabled" };
  }

  const allowedActions = config.policies.allowedActions[agent] ?? [];
  if (!allowedActions.includes(proposal.action_type)) {
    return { allowed: false, reason: "action-not-allowed-for-agent" };
  }

  const threshold = config.policies.severityThresholds[proposal.action_type];
  if (threshold && severityRank(proposal.risk) > severityRank(threshold)) {
    return { allowed: false, reason: "risk-threshold-blocked" };
  }

  if (proposal.action_type === "patch_cloudflare_dns" && !config.policies.dnsAllowlist.includes(proposal.target)) {
    return { allowed: false, reason: "dns-target-not-allowlisted" };
  }

  if (
    proposal.action_type === "disable_workflow" &&
    !config.policies.workflowAllowlist.includes(proposal.target)
  ) {
    return { allowed: false, reason: "workflow-not-allowlisted" };
  }

  return { allowed: true };
}
