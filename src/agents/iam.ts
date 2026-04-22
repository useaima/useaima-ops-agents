import { GitHubConnector } from "../connectors/github.js";
import { BaseAgent } from "../core/base-agent.js";
import type { AgentContext } from "../core/base-agent.js";
import type { AgentFinding } from "../core/types.js";

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
      const collaborators = await github.listOutsideCollaborators(repo);
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
