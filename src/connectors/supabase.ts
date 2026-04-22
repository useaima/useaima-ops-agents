import { fetchJson } from "../core/http.js";

interface SupabaseFunctionInfo {
  name: string;
  status?: string;
  slug?: string;
}

export class SupabaseConnector {
  private readonly token = process.env.SUPABASE_ACCESS_TOKEN;
  private readonly baseUrl = "https://api.supabase.com/v1";

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };
  }

  async getProject(projectRef: string): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${this.baseUrl}/projects/${projectRef}`, {
      headers: this.headers()
    });
  }

  async listFunctions(projectRef: string): Promise<SupabaseFunctionInfo[]> {
    return fetchJson<SupabaseFunctionInfo[]>(`${this.baseUrl}/projects/${projectRef}/functions`, {
      headers: this.headers()
    });
  }
}
