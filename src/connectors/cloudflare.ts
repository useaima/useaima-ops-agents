import { fetchJson } from "../core/http.js";

interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
}

interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

export class CloudflareConnector {
  private readonly token = process.env.CLOUDFLARE_API_TOKEN;
  private readonly baseUrl = "https://api.cloudflare.com/client/v4";

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };
  }

  async getZone(zoneId: string): Promise<Record<string, unknown>> {
    const payload = await fetchJson<CloudflareEnvelope<Record<string, unknown>>>(
      `${this.baseUrl}/zones/${zoneId}`,
      { headers: this.headers() }
    );
    return payload.result;
  }

  async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    const payload = await fetchJson<CloudflareEnvelope<CloudflareDnsRecord[]>>(
      `${this.baseUrl}/zones/${zoneId}/dns_records?per_page=100`,
      { headers: this.headers() }
    );
    return payload.result;
  }

  async purgeCache(zoneId: string): Promise<void> {
    await fetch(`${this.baseUrl}/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ purge_everything: true })
    });
  }

  async patchDnsRecord(zoneId: string, recordId: string, input: { type: string; name: string; content: string; proxied?: boolean }): Promise<void> {
    await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(input)
    });
  }
}
