import { CloudflareSpecialistAgent } from "./cloudflare-specialist.js";
import { DevOpsLeadAgent } from "./devops-lead.js";
import { FinOpsAgent } from "./finops.js";
import { IAMAgent } from "./iam.js";
import { SecurityOpsAgent } from "./security-ops.js";
import { VulnerabilityScannerAgent } from "./vulnerability-scanner.js";

export const AGENTS = {
  "devops-lead": new DevOpsLeadAgent(),
  "cloudflare-specialist": new CloudflareSpecialistAgent(),
  finops: new FinOpsAgent(),
  "security-ops": new SecurityOpsAgent(),
  "vulnerability-scanner": new VulnerabilityScannerAgent(),
  iam: new IAMAgent()
} as const;
