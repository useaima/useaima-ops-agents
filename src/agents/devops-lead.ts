import { GitHubConnector } from "../connectors/github.js";
import { VercelConnector } from "../connectors/vercel.js";
import { BaseAgent } from "../core/base-agent.js";
import type { AgentContext } from "../core/base-agent.js";
import type { ActionProposal, AgentFinding } from "../core/types.js";

function makeId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
}

export class DevOpsLeadAgent extends BaseAgent {
  constructor() {
    super("devops-lead");
  }

  async run({ config }: AgentContext): Promise<{ findings: AgentFinding[]; proposals: ActionProposal[] }> {
    const github = new GitHubConnector();
    const vercel = new VercelConnector();
    const findings: AgentFinding[] = [];
    const proposals: ActionProposal[] = [];

    if (github.isConfigured()) {
      for (const repo of config.targets.github) {
        const runs = await github.listWorkflowRuns(repo);
        const latestCompletedRun = runs.find((run) => run.status === "completed");
        const failedRun =
          latestCompletedRun &&
          (latestCompletedRun.conclusion === "failure" || latestCompletedRun.conclusion === "startup_failure")
            ? latestCompletedRun
            : undefined;
        if (!failedRun) {
          continue;
        }

        const findingId = makeId("github-run", `${repo.owner}-${repo.repo}-${failedRun.id}`);
        findings.push({
          id: findingId,
          agent: this.name,
          system: "github",
          severity: repo.id === "ops-agents" ? "high" : "medium",
          title: `Failed workflow run in ${repo.owner}/${repo.repo}`,
          summary: `${failedRun.name} failed and may be blocking release flow.`,
          details: `The latest failing workflow run was ${failedRun.id} with conclusion ${failedRun.conclusion}.`,
          detected_at: new Date().toISOString(),
          dedupe_key: `github-workflow-${repo.owner}-${repo.repo}-${failedRun.id}`,
          metadata: {
            repo: `${repo.owner}/${repo.repo}`,
            runId: failedRun.id,
            url: failedRun.html_url
          }
        });
        proposals.push({
          id: makeId("proposal", `${findingId}-rerun`),
          finding_id: findingId,
          action_type: "rerun_workflow",
          target: `${repo.owner}/${repo.repo}#${failedRun.id}`,
          reason: "The supported first response is to rerun failed jobs before escalating.",
          risk: "medium",
          payload: {
            owner: repo.owner,
            repo: repo.repo,
            runId: failedRun.id
          }
        });
      }
    }

    if (vercel.isConfigured()) {
      for (const target of config.targets.vercel) {
        const projectId = process.env[target.projectIdEnv];
        if (!projectId) {
          continue;
        }

        const deployments = await vercel.listDeployments(projectId);
        const latest = deployments[0];
        if (!latest || latest.readyState === "READY" || latest.readyState === "CANCELED") {
          continue;
        }

        const findingId = makeId("vercel-deploy", `${target.id}-${latest.uid}`);
        findings.push({
          id: findingId,
          agent: this.name,
          system: "vercel",
          severity: latest.readyState === "ERROR" ? "high" : "medium",
          title: `Unhealthy Vercel deployment for ${target.name}`,
          summary: `The latest deployment is in ${latest.readyState} state.`,
          details: `Deployment ${latest.uid} for ${target.name} is not healthy.`,
          detected_at: new Date().toISOString(),
          dedupe_key: `vercel-deployment-${target.id}-${latest.uid}`,
          metadata: {
            deploymentId: latest.uid,
            projectId,
            url: latest.url
          }
        });
        proposals.push({
          id: makeId("proposal", `${findingId}-redeploy`),
          finding_id: findingId,
          action_type: "trigger_vercel_redeploy",
          target: `${target.name}:${latest.uid}`,
          reason: "Redeploy the latest failing build to clear transient deployment failures.",
          risk: "high",
          payload: {
            deploymentId: latest.uid
          }
        });
      }
    }

    return { findings, proposals };
  }
}
