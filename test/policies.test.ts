import { describe, expect, it, vi } from "vitest";

import { canExecuteAction, getAutonomyMode, isKillSwitchEnabled } from "../src/core/policies.js";
import type { LoadedConfig } from "../src/core/types.js";

const config: LoadedConfig = {
  targets: { github: [], vercel: [], supabase: [], cloudflare: [] },
  policies: {
    defaultAutonomyMode: "active",
    issueRepo: { owner: "useaima", repo: "useaima-ops-agents" },
    allowedActions: {
      "devops-lead": ["create_issue", "rerun_workflow", "trigger_vercel_redeploy"],
      "cloudflare-specialist": ["create_issue", "purge_cloudflare_cache", "patch_cloudflare_dns"],
      finops: ["create_issue"],
      "security-ops": ["create_issue", "disable_workflow"],
      "vulnerability-scanner": ["create_issue", "open_pr"],
      iam: ["create_issue", "revoke_token"]
    },
    severityThresholds: {
      disable_workflow: "high"
    },
    workflowAllowlist: ["ci.yml"],
    dnsAllowlist: ["eva.useaima.com"]
  },
  labels: {
    agent: [],
    system: [],
    severity: [],
    status: []
  },
  schedules: {}
};

describe("policies", () => {
  it("honors the kill switch", () => {
    vi.stubEnv("AGENT_KILL_SWITCH", "true");
    expect(isKillSwitchEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("downgrades autonomy mode to observe when requested in env", () => {
    vi.stubEnv("AUTONOMY_MODE", "observe");
    expect(getAutonomyMode(config, "active")).toBe("observe");
    vi.unstubAllEnvs();
  });

  it("blocks non-allowlisted DNS patches", () => {
    const result = canExecuteAction(
      config,
      "cloudflare-specialist",
      {
        id: "1",
        finding_id: "1",
        action_type: "patch_cloudflare_dns",
        target: "bad.example.com",
        reason: "test",
        risk: "medium"
      },
      "active"
    );
    expect(result.allowed).toBe(false);
  });
});
