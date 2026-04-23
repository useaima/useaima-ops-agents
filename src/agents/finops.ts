import { SupabaseConnector } from "../connectors/supabase.js";
import { VercelConnector } from "../connectors/vercel.js";
import { BaseAgent } from "../core/base-agent.js";
import type { AgentContext } from "../core/base-agent.js";
import type { AgentFinding } from "../core/types.js";

export class FinOpsAgent extends BaseAgent {
  constructor() {
    super("finops");
  }

  async run({ config }: AgentContext): Promise<{ findings: AgentFinding[]; proposals: [] }> {
    const vercel = new VercelConnector();
    const supabase = new SupabaseConnector();
    const findings: AgentFinding[] = [];

    if (vercel.isConfigured()) {
      for (const target of config.targets.vercel) {
        const projectId = process.env[target.projectIdEnv];
        if (!projectId) {
          continue;
        }

        const deployments = await vercel.listDeployments(projectId);
        const latestCompletedDeployments = deployments
          .filter((deployment) => deployment.readyState !== "BUILDING" && deployment.readyState !== "QUEUED")
          .slice(0, 3);
        const recentFailures = latestCompletedDeployments.filter((deployment) => deployment.readyState === "ERROR").length;
        if (latestCompletedDeployments.length < 2 || recentFailures < 2) {
          continue;
        }

        findings.push({
          id: `finops-vercel-${target.id}`,
          agent: this.name,
          system: "vercel",
          severity: "medium",
          title: `Repeated failed deployments for ${target.name}`,
          summary: `${recentFailures} recent deployments are in ERROR state and may be wasting build budget.`,
          details: `Review the Vercel project ${target.name} for repeated unsuccessful builds and cache churn.`,
          detected_at: new Date().toISOString(),
          dedupe_key: `finops-vercel-${target.id}-deployment-errors`,
          metadata: {
            projectId,
            recentFailures
          }
        });
      }
    }

    if (supabase.isConfigured()) {
      for (const target of config.targets.supabase) {
        const project = await supabase.getProject(target.projectRef);
        const status = `${project.status ?? project.project_status ?? "unknown"}`;
        if (status.toLowerCase() === "active") {
          continue;
        }

        findings.push({
          id: `finops-supabase-${target.projectRef}`,
          agent: this.name,
          system: "supabase",
          severity: "high",
          title: `Supabase project not in active state`,
          summary: `Supabase project ${target.projectRef} is reporting status ${status}.`,
          details: `Non-active project state can disrupt EVA finance operations and may indicate quota or billing pressure.`,
          detected_at: new Date().toISOString(),
          dedupe_key: `finops-supabase-${target.projectRef}-status-${status}`,
          metadata: {
            projectRef: target.projectRef,
            status
          }
        });
      }
    }

    return { findings, proposals: [] };
  }
}
