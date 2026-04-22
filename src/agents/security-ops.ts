import { GitHubConnector } from "../connectors/github.js";
import { SupabaseConnector } from "../connectors/supabase.js";
import { BaseAgent } from "../core/base-agent.js";
import type { AgentContext } from "../core/base-agent.js";
import type { ActionProposal, AgentFinding } from "../core/types.js";

function makeKey(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
}

export class SecurityOpsAgent extends BaseAgent {
  constructor() {
    super("security-ops");
  }

  async run({ config }: AgentContext): Promise<{ findings: AgentFinding[]; proposals: ActionProposal[] }> {
    const github = new GitHubConnector();
    const supabase = new SupabaseConnector();
    const findings: AgentFinding[] = [];
    const proposals: ActionProposal[] = [];

    if (github.isConfigured()) {
      const opsRepo = config.targets.github.find((repo) => repo.id === "ops-agents");
      if (opsRepo) {
        const runs = await github.listWorkflowRuns(opsRepo);
        const latestFailures = runs.filter((run) => run.conclusion === "failure").slice(0, 3);
        if (latestFailures.length >= 3) {
          const findingId = makeKey("security-github", `${opsRepo.owner}-${opsRepo.repo}`);
          findings.push({
            id: findingId,
            agent: this.name,
            system: "github",
            severity: "critical",
            title: "Ops agent workflows are repeatedly failing",
            summary: "Three recent runs failed in the ops-agent control plane.",
            details: "Repeated failures in the ops-agent platform can lead to blind spots or unsafe retries.",
            detected_at: new Date().toISOString(),
            dedupe_key: `security-github-ops-runs-${latestFailures[0]?.id ?? "none"}`,
            metadata: {
              runs: latestFailures.map((run) => ({
                id: run.id,
                url: run.html_url,
                name: run.name
              }))
            }
          });
          proposals.push({
            id: makeKey("proposal", `${findingId}-kill-switch`),
            finding_id: findingId,
            action_type: "disable_workflow",
            target: "AGENT_KILL_SWITCH",
            reason: "Enable the kill switch until the control plane is healthy again.",
            risk: "high"
          });
        }
      }
    }

    if (supabase.isConfigured()) {
      for (const target of config.targets.supabase) {
        const functions = await supabase.listFunctions(target.projectRef);
        const missing = target.functions.filter(
          (expected) => !functions.some((fn) => fn.name === expected || fn.slug === expected)
        );

        if (missing.length === 0) {
          continue;
        }

        findings.push({
          id: makeKey("security-supabase", `${target.projectRef}-${missing.join("-")}`),
          agent: this.name,
          system: "supabase",
          severity: "high",
          title: "Expected Supabase functions are missing",
          summary: `Supabase project ${target.projectRef} is missing ${missing.length} expected functions.`,
          details: `Missing functions weaken the security and reliability posture of EVA backend workflows.`,
          detected_at: new Date().toISOString(),
          dedupe_key: `security-supabase-functions-${target.projectRef}-${missing.join(",")}`,
          metadata: {
            projectRef: target.projectRef,
            missing
          }
        });
      }
    }

    return { findings, proposals };
  }
}
