import { Buffer } from "node:buffer";

import { fetchJson } from "../core/http.js";
import type { GitHubRepoTarget } from "../core/types.js";

interface GitHubLabel {
  name: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name?: string }>;
  html_url: string;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  path?: string;
}

interface DependabotAlert {
  number: number;
  state: string;
  dependency?: {
    package?: {
      name?: string;
    };
  };
  security_advisory?: {
    summary?: string;
    severity?: string;
  };
  html_url: string;
}

interface RepositoryInfo {
  private: boolean;
  archived: boolean;
  html_url: string;
  default_branch: string;
}

export class GitHubConnector {
  private readonly token = process.env.GITHUB_TOKEN;
  private readonly baseUrl = "https://api.github.com";

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  private headers(extra: Record<string, string> = {}): HeadersInit {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "User-Agent": "useaima-ops-agents",
      "X-GitHub-Api-Version": "2022-11-28",
      ...extra
    };
  }

  async listWorkflowRuns(target: GitHubRepoTarget): Promise<WorkflowRun[]> {
    const payload = await fetchJson<{ workflow_runs: WorkflowRun[] }>(
      `${this.baseUrl}/repos/${target.owner}/${target.repo}/actions/runs?per_page=20`,
      { headers: this.headers() }
    );
    return payload.workflow_runs;
  }

  async rerunWorkflowRun(target: GitHubRepoTarget, runId: number): Promise<void> {
    await fetch(`${this.baseUrl}/repos/${target.owner}/${target.repo}/actions/runs/${runId}/rerun-failed-jobs`, {
      method: "POST",
      headers: this.headers()
    });
  }

  async ensureLabels(owner: string, repo: string, labels: string[]): Promise<void> {
    const existing = await fetchJson<GitHubLabel[]>(
      `${this.baseUrl}/repos/${owner}/${repo}/labels?per_page=100`,
      { headers: this.headers() }
    );
    const existingNames = new Set(existing.map((label) => label.name));

    for (const label of labels) {
      if (existingNames.has(label)) {
        continue;
      }

      await fetch(`${this.baseUrl}/repos/${owner}/${repo}/labels`, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: label,
          color: "0f766e",
          description: "Managed by UseAima Ops Agents"
        })
      });
    }
  }

  async listIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "all"): Promise<GitHubIssue[]> {
    return fetchJson<GitHubIssue[]>(`${this.baseUrl}/repos/${owner}/${repo}/issues?state=${state}&per_page=100`, {
      headers: this.headers()
    });
  }

  async createIssue(owner: string, repo: string, input: { title: string; body: string; labels: string[] }): Promise<GitHubIssue> {
    return fetchJson<GitHubIssue>(`${this.baseUrl}/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(input)
    });
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, input: { title?: string; body?: string; state?: "open" | "closed"; labels?: string[] }): Promise<GitHubIssue> {
    return fetchJson<GitHubIssue>(`${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: "PATCH",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(input)
    });
  }

  async commentIssue(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ body })
    });
  }

  async listDependabotAlerts(target: GitHubRepoTarget): Promise<DependabotAlert[]> {
    return fetchJson<DependabotAlert[]>(
      `${this.baseUrl}/repos/${target.owner}/${target.repo}/dependabot/alerts?state=open&per_page=100`,
      { headers: this.headers() }
    );
  }

  async getRepository(target: GitHubRepoTarget): Promise<RepositoryInfo> {
    return fetchJson<RepositoryInfo>(`${this.baseUrl}/repos/${target.owner}/${target.repo}`, {
      headers: this.headers()
    });
  }

  async listOutsideCollaborators(target: GitHubRepoTarget): Promise<Array<{ login: string; html_url: string }>> {
    return fetchJson<Array<{ login: string; html_url: string }>>(
      `${this.baseUrl}/repos/${target.owner}/${target.repo}/collaborators?affiliation=outside&per_page=100`,
      { headers: this.headers() }
    );
  }

  async listRepositoryVariables(owner: string, repo: string): Promise<Array<{ name: string; value: string }>> {
    const payload = await fetchJson<{ variables: Array<{ name: string; value: string }> }>(
      `${this.baseUrl}/repos/${owner}/${repo}/actions/variables`,
      { headers: this.headers() }
    );
    return payload.variables;
  }

  async upsertRepositoryVariable(owner: string, repo: string, name: string, value: string): Promise<void> {
    const existing = await this.listRepositoryVariables(owner, repo);
    const found = existing.find((item) => item.name === name);
    const method = found ? "PATCH" : "POST";
    const url = found
      ? `${this.baseUrl}/repos/${owner}/${repo}/actions/variables/${name}`
      : `${this.baseUrl}/repos/${owner}/${repo}/actions/variables`;
    await fetch(url, {
      method,
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(found ? { name, value } : { name, value })
    });
  }

  async createConfigPullRequest(input: {
    owner: string;
    repo: string;
    baseBranch: string;
    branchName: string;
    path: string;
    content: string;
    commitMessage: string;
    prTitle: string;
    prBody: string;
  }): Promise<string> {
    const refPayload = await fetchJson<{ object: { sha: string } }>(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/git/ref/heads/${input.baseBranch}`,
      { headers: this.headers() }
    );

    await fetch(`${this.baseUrl}/repos/${input.owner}/${input.repo}/git/refs`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ref: `refs/heads/${input.branchName}`,
        sha: refPayload.object.sha
      })
    });

    let existingSha: string | undefined;
    const existingResponse = await fetch(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/contents/${input.path}?ref=${input.branchName}`,
      {
        headers: this.headers()
      }
    );

    if (existingResponse.ok) {
      const existingPayload = (await existingResponse.json()) as { sha: string };
      existingSha = existingPayload.sha;
    }

    await fetch(`${this.baseUrl}/repos/${input.owner}/${input.repo}/contents/${input.path}`, {
      method: "PUT",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: input.commitMessage,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: input.branchName,
        sha: existingSha
      })
    });

    const prPayload = await fetchJson<{ html_url: string }>(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/pulls`,
      {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: input.prTitle,
          head: input.branchName,
          base: input.baseBranch,
          body: input.prBody
        })
      }
    );

    return prPayload.html_url;
  }
}
