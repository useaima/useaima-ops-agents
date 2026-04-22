import { CloudflareConnector } from "../connectors/cloudflare.js";
import { BaseAgent } from "../core/base-agent.js";
import type { AgentContext } from "../core/base-agent.js";
import type { AgentFinding } from "../core/types.js";

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
}

export class CloudflareSpecialistAgent extends BaseAgent {
  constructor() {
    super("cloudflare-specialist");
  }

  async run({ config }: AgentContext): Promise<{ findings: AgentFinding[]; proposals: [] }> {
    const connector = new CloudflareConnector();
    const findings: AgentFinding[] = [];

    if (!connector.isConfigured()) {
      return { findings, proposals: [] };
    }

    for (const zone of config.targets.cloudflare) {
      const zoneId = process.env[zone.zoneIdEnv];
      if (!zoneId) {
        continue;
      }

      const dnsRecords = await connector.listDnsRecords(zoneId);
      for (const expected of zone.expectedDnsRecords ?? []) {
        const record = dnsRecords.find((item) => item.type === expected.type && item.name === expected.name);
        if (record) {
          continue;
        }

        findings.push({
          id: `cloudflare-missing-${slug(expected.name)}`,
          agent: this.name,
          system: "cloudflare",
          severity: "high",
          title: `Missing DNS record for ${expected.name}`,
          summary: `${expected.type} ${expected.name} was not found in Cloudflare zone ${zone.zoneName}.`,
          details: `The zone ${zone.zoneName} is missing an expected DNS record, which can break routing or email workflows.`,
          detected_at: new Date().toISOString(),
          dedupe_key: `cloudflare-dns-${zone.zoneName}-${expected.type}-${expected.name}`,
          metadata: {
            zone: zone.zoneName,
            expected
          }
        });
      }
    }

    return { findings, proposals: [] };
  }
}
