import { GitHubConnector } from "../connectors/github.js";
import { logWarn } from "./logger.js";
import type { ActionRecord, AgentFinding, LabelsConfig } from "./types.js";

const DEDUPE_PREFIX = "<!-- dedupe:";

function dedupeMarker(dedupeKey: string): string {
  return `<!-- dedupe:${dedupeKey} -->`;
}

function issueBody(finding: AgentFinding): string {
  return [
    dedupeMarker(finding.dedupe_key),
    `## Summary`,
    finding.summary,
    ``,
    `## Details`,
    finding.details,
    ``,
    `## Metadata`,
    "```json",
    JSON.stringify(finding.metadata ?? {}, null, 2),
    "```"
  ].join("\n");
}

function issueLabels(labelsConfig: LabelsConfig, finding: AgentFinding, status: "open" | "acting" | "resolved" | "muted"): string[] {
  const labels = [
    `agent:${finding.agent}`,
    `system:${finding.system}`,
    `severity:${finding.severity}`,
    `status:${status}`
  ];

  const allowed = new Set([
    ...labelsConfig.agent,
    ...labelsConfig.system,
    ...labelsConfig.severity,
    ...labelsConfig.status
  ]);

  return labels.filter((label) => allowed.has(label));
}

export async function ensureIssueLabels(
  connector: GitHubConnector,
  owner: string,
  repo: string,
  labelsConfig: LabelsConfig
): Promise<void> {
  if (!connector.isConfigured()) {
    return;
  }

  await connector.ensureLabels(owner, repo, [
    ...labelsConfig.agent,
    ...labelsConfig.system,
    ...labelsConfig.severity,
    ...labelsConfig.status
  ]);
}

export async function upsertFindingIssue(input: {
  connector: GitHubConnector;
  owner: string;
  repo: string;
  labelsConfig: LabelsConfig;
  finding: AgentFinding;
}): Promise<{ issueNumber: number; issueUrl: string }> {
  const issues = await input.connector.listIssues(input.owner, input.repo, "all");
  const marker = dedupeMarker(input.finding.dedupe_key);
  const existing = issues.find((issue) => issue.body?.includes(marker));
  const labels = issueLabels(input.labelsConfig, input.finding, "open");

  if (!existing) {
    const created = await input.connector.createIssue(input.owner, input.repo, {
      title: input.finding.title,
      body: issueBody(input.finding),
      labels
    });
    return { issueNumber: created.number, issueUrl: created.html_url };
  }

  const updated = await input.connector.updateIssue(input.owner, input.repo, existing.number, {
    title: input.finding.title,
    body: issueBody(input.finding),
    state: "open",
    labels
  });

  return { issueNumber: updated.number, issueUrl: updated.html_url };
}

export async function appendActionComment(input: {
  connector: GitHubConnector;
  owner: string;
  repo: string;
  issueNumber: number;
  actionRecord: ActionRecord;
}): Promise<void> {
  const lines = [
    `### Action ${input.actionRecord.action_type}`,
    `- status: ${input.actionRecord.status}`,
    `- target: ${input.actionRecord.target}`,
    `- started_at: ${input.actionRecord.started_at}`,
    `- completed_at: ${input.actionRecord.completed_at}`,
    ``,
    input.actionRecord.result_summary
  ];

  if (input.actionRecord.links?.length) {
    lines.push("", "Links:");
    for (const link of input.actionRecord.links) {
      lines.push(`- ${link}`);
    }
  }

  await input.connector.commentIssue(input.owner, input.repo, input.issueNumber, lines.join("\n"));
}

export async function resolveRecoveredIssues(input: {
  connector: GitHubConnector;
  owner: string;
  repo: string;
  labelsConfig: LabelsConfig;
  agent: AgentFinding["agent"];
  activeDedupeKeys: Set<string>;
}): Promise<void> {
  if (!input.connector.isConfigured()) {
    return;
  }

  const issues = await input.connector.listIssues(input.owner, input.repo, "open");
  for (const issue of issues) {
    const agentLabel = issue.labels.find((label) => label.name === `agent:${input.agent}`);
    if (!agentLabel || !issue.body?.includes(DEDUPE_PREFIX)) {
      continue;
    }

    const markerMatch = issue.body.match(/<!-- dedupe:([^>]+) -->/);
    const dedupeKey = markerMatch?.[1];
    if (!dedupeKey || input.activeDedupeKeys.has(dedupeKey)) {
      continue;
    }

    try {
      await input.connector.commentIssue(
        input.owner,
        input.repo,
        issue.number,
        "The latest run did not reproduce this finding, so the agent is marking it resolved."
      );
      const nextLabels = issue.labels
        .map((label) => label.name)
        .filter((label): label is string => typeof label === "string" && !label.startsWith("status:"));
      nextLabels.push("status:resolved");
      await input.connector.updateIssue(input.owner, input.repo, issue.number, {
        state: "closed",
        labels: nextLabels
      });
    } catch (error) {
      logWarn("Failed to resolve recovered issue", {
        issueNumber: issue.number,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
