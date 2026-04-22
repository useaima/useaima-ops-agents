import { CloudflareConnector } from "../connectors/cloudflare.js";
import { GitHubConnector } from "../connectors/github.js";
import { SupabaseConnector } from "../connectors/supabase.js";
import { VercelConnector } from "../connectors/vercel.js";
import { AGENTS } from "../agents/index.js";
import { writeArtifact } from "./artifacts.js";
import { loadConfig } from "./config.js";
import { appendActionComment, ensureIssueLabels, resolveRecoveredIssues, upsertFindingIssue } from "./issues.js";
import { logError, logInfo } from "./logger.js";
import { refineFindingWithOpenAI } from "./openai.js";
import { canExecuteAction, getAutonomyMode } from "./policies.js";
import type { ActionProposal, ActionRecord, AgentName, AgentRunRecord, RunMode } from "./types.js";

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runAgent(agentName: AgentName, requestedMode: RunMode = "active"): Promise<AgentRunRecord> {
  const config = await loadConfig();
  const mode = getAutonomyMode(config, requestedMode);
  const startedAt = new Date().toISOString();
  const agent = AGENTS[agentName];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  const github = new GitHubConnector();
  const vercel = new VercelConnector();
  const supabase = new SupabaseConnector();
  const cloudflare = new CloudflareConnector();
  const issueRepoOwner = process.env.ALERT_REPO_OWNER || config.policies.issueRepo.owner;
  const issueRepoName = process.env.ALERT_REPO || config.policies.issueRepo.repo;

  if (github.isConfigured()) {
    await ensureIssueLabels(github, issueRepoOwner, issueRepoName, config.labels);
  }

  const result = await agent.run({
    config,
    mode
  });

  const actionsTaken: ActionRecord[] = [];
  const activeDedupeKeys = new Set(result.findings.map((finding) => finding.dedupe_key));

  for (const finding of result.findings) {
    const linkedProposals = result.proposals.filter((proposal) => proposal.finding_id === finding.id);
    const refinement = await refineFindingWithOpenAI({
      summary: finding.summary,
      details: finding.details,
      actions: linkedProposals.map((proposal) => proposal.action_type)
    });

    if (refinement?.refinedSummary) {
      finding.summary = refinement.refinedSummary;
    }

    if (!github.isConfigured()) {
      continue;
    }

    const issue = await upsertFindingIssue({
      connector: github,
      owner: issueRepoOwner,
      repo: issueRepoName,
      labelsConfig: config.labels,
      finding
    });

    const chosenProposal =
      (refinement?.recommendedAction
        ? linkedProposals.find((proposal) => proposal.action_type === refinement.recommendedAction)
        : undefined) ?? linkedProposals[0];

    if (!chosenProposal) {
      continue;
    }

    const actionRecord = await executeProposal({
      proposal: chosenProposal,
      agentName,
      issueRepoOwner,
      issueRepoName,
      github,
      vercel,
      supabase,
      cloudflare,
      config,
      mode
    });

    actionsTaken.push(actionRecord);
    await appendActionComment({
      connector: github,
      owner: issueRepoOwner,
      repo: issueRepoName,
      issueNumber: issue.issueNumber,
      actionRecord
    });
  }

  if (github.isConfigured()) {
    await resolveRecoveredIssues({
      connector: github,
      owner: issueRepoOwner,
      repo: issueRepoName,
      labelsConfig: config.labels,
      agent: agentName,
      activeDedupeKeys
    });
  }

  const artifact_path = await writeArtifact(`${agentName}`, {
    agent: agentName,
    mode,
    findings: result.findings,
    proposals: result.proposals,
    actionsTaken
  });

  const runRecord: AgentRunRecord = {
    agent: agentName,
    mode,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    findings_count: result.findings.length,
    actions_taken: actionsTaken,
    artifact_path
  };

  logInfo("Agent run completed", { ...runRecord });
  return runRecord;
}

async function executeProposal(input: {
  proposal: ActionProposal;
  agentName: AgentName;
  issueRepoOwner: string;
  issueRepoName: string;
  github: GitHubConnector;
  vercel: VercelConnector;
  supabase: SupabaseConnector;
  cloudflare: CloudflareConnector;
  config: Awaited<ReturnType<typeof loadConfig>>;
  mode: RunMode;
}): Promise<ActionRecord> {
  const started_at = new Date().toISOString();
  const gate = canExecuteAction(input.config, input.agentName, input.proposal, input.mode);

  if (!gate.allowed && input.proposal.action_type !== "create_issue") {
    return {
      id: randomId("action"),
      action_type: input.proposal.action_type,
      target: input.proposal.target,
      status: input.mode === "dry-run" ? "dry-run" : "skipped",
      started_at,
      completed_at: new Date().toISOString(),
      result_summary: `Action not executed: ${gate.reason ?? "blocked by policy"}.`
    };
  }

  try {
    switch (input.proposal.action_type) {
      case "create_issue":
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: "Finding issue is up to date."
        };
      case "rerun_workflow": {
        const payload = input.proposal.payload as { owner: string; repo: string; runId: number };
        await input.github.rerunWorkflowRun(
          {
            id: `${payload.owner}/${payload.repo}`,
            owner: payload.owner,
            repo: payload.repo,
            defaultBranch: "main"
          },
          payload.runId
        );
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: `Requested rerun for workflow run ${payload.runId}.`
        };
      }
      case "trigger_vercel_redeploy": {
        const payload = input.proposal.payload as { deploymentId: string };
        const result = await input.vercel.redeploy(payload.deploymentId);
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: `Triggered redeploy for deployment ${payload.deploymentId}.`,
          links: result.url ? [`https://${result.url}`] : undefined
        };
      }
      case "purge_cloudflare_cache": {
        const payload = input.proposal.payload as { zoneId: string };
        await input.cloudflare.purgeCache(payload.zoneId);
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: `Purged Cloudflare cache for ${input.proposal.target}.`
        };
      }
      case "patch_cloudflare_dns": {
        const payload = input.proposal.payload as {
          zoneId: string;
          recordId: string;
          type: string;
          name: string;
          content: string;
          proxied?: boolean;
        };
        await input.cloudflare.patchDnsRecord(payload.zoneId, payload.recordId, payload);
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: `Patched DNS record ${payload.name}.`
        };
      }
      case "disable_workflow": {
        await input.github.upsertRepositoryVariable(input.issueRepoOwner, input.issueRepoName, "AGENT_KILL_SWITCH", "true");
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: "Enabled the repo kill switch by setting AGENT_KILL_SWITCH=true."
        };
      }
      case "open_pr": {
        const payload = input.proposal.payload as {
          owner: string;
          repo: string;
          baseBranch: string;
          branchName: string;
          path: string;
          content: string;
          commitMessage: string;
          prTitle: string;
          prBody: string;
        };
        const url = await input.github.createConfigPullRequest(payload);
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "succeeded",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: `Opened bounded remediation pull request for ${payload.owner}/${payload.repo}.`,
          links: [url]
        };
      }
      case "revoke_token":
        throw new Error("Token revocation is intentionally disabled until a provider-specific scoped implementation is configured.");
      default:
        return {
          id: randomId("action"),
          action_type: input.proposal.action_type,
          target: input.proposal.target,
          status: "skipped",
          started_at,
          completed_at: new Date().toISOString(),
          result_summary: "Unsupported action."
        };
    }
  } catch (error) {
    logError("Action execution failed", {
      actionType: input.proposal.action_type,
      target: input.proposal.target,
      error: summarizeError(error)
    });
    return {
      id: randomId("action"),
      action_type: input.proposal.action_type,
      target: input.proposal.target,
      status: "failed",
      started_at,
      completed_at: new Date().toISOString(),
      result_summary: summarizeError(error)
    };
  }
}
