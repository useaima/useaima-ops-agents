import { GitHubConnector } from "../connectors/github.js";
import { BaseAgent } from "../core/base-agent.js";
import type { AgentContext } from "../core/base-agent.js";
import { HttpError } from "../core/http.js";
import type { AgentFinding } from "../core/types.js";

function describeError(error: unknown): string {
  if (error instanceof HttpError) {
    const detail = error.responseText.trim().slice(0, 240);
    return `HTTP ${error.status}${detail ? `: ${detail}` : ""}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown GitHub API error";
}

function isCrossRepoScopeUnavailable(repoFullName: string): boolean {
  if (process.env.GITHUB_TOKEN_SOURCE !== "github-token") {
    return false;
  }

  const alertRepo = [process.env.ALERT_REPO_OWNER, process.env.ALERT_REPO].filter(Boolean).join("/");
  return !alertRepo || repoFullName !== alertRepo;
}

export class IAMAgent extends BaseAgent {
  constructor() {
    super("iam");
  }

  async run({ config }: AgentContext): Promise<{ findings: AgentFinding[]; proposals: [] }> {
    const github = new GitHubConnector();
    const findings: AgentFinding[] = [];

    if (!github.isConfigured()) {
      return { findings, proposals: [] };
    }

    for (const repo of config.targets.github) {
      const repoFullName = `${repo.owner}/${repo.repo}`;
      if (isCrossRepoScopeUnavailable(repoFullName)) {
        continue;
      }

      let collaborators;
      try {
        collaborators = await github.listOutsideCollaborators(repo);
      } catch (error) {
        findings.push({
          id: `iam-access-${repo.id}`,
          agent: this.name,
          system: "github",
          severity: "medium",
          title: `Unable to inspect collaborator access for ${repo.owner}/${repo.repo}`,
          summary: `The agent could not verify outside collaborators for ${repo.owner}/${repo.repo}.`,
          details: `GitHub API access failed while listing outside collaborators. This usually means the workflow token cannot inspect that repository or needs a broader org token. ${describeError(error)}`,
          detected_at: new Date().toISOString(),
          dedupe_key: `iam-access-${repo.owner}-${repo.repo}`,
          metadata: {
            repo: repoFullName
          }
        });
        continue;
      }

      for (const collaborator of collaborators) {
        findings.push({
          id: `iam-${repo.id}-${collaborator.login}`,
          agent: this.name,
          system: "github",
          severity: "medium",
          title: `Outside collaborator on ${repo.owner}/${repo.repo}`,
          summary: `${collaborator.login} has outside collaborator access.`,
          details: "Review whether this access is still needed and whether it matches current policy.",
          detected_at: new Date().toISOString(),
          dedupe_key: `iam-outside-collaborator-${repo.owner}-${repo.repo}-${collaborator.login}`,
          metadata: {
            repo: `${repo.owner}/${repo.repo}`,
            collaborator: collaborator.login,
            url: collaborator.html_url
          }
        });
      }
    }

    return { findings, proposals: [] };
  }
}
