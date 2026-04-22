import { fetchJson } from "../core/http.js";

interface VercelDeployment {
  uid: string;
  name: string;
  readyState: string;
  createdAt: number;
  url: string;
}

interface VercelProject {
  id: string;
  name: string;
  link?: {
    repo?: string;
  };
}

export class VercelConnector {
  private readonly token = process.env.VERCEL_TOKEN;
  private readonly teamId = process.env.VERCEL_TEAM_ID;
  private readonly baseUrl = "https://api.vercel.com";

  isConfigured(): boolean {
    return Boolean(this.token && this.teamId);
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };
  }

  private withTeam(url: string): string {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}teamId=${this.teamId}`;
  }

  async getProject(projectId: string): Promise<VercelProject> {
    return fetchJson<VercelProject>(this.withTeam(`${this.baseUrl}/v9/projects/${projectId}`), {
      headers: this.headers()
    });
  }

  async listDeployments(projectId: string): Promise<VercelDeployment[]> {
    const payload = await fetchJson<{ deployments: VercelDeployment[] }>(
      this.withTeam(`${this.baseUrl}/v6/deployments?projectId=${projectId}&limit=10`),
      { headers: this.headers() }
    );
    return payload.deployments;
  }

  async redeploy(deploymentId: string): Promise<{ id?: string; url?: string }> {
    return fetchJson<{ id?: string; url?: string }>(
      this.withTeam(`${this.baseUrl}/v13/deployments/${deploymentId}/redeploy`),
      {
        method: "POST",
        headers: this.headers()
      }
    );
  }
}
