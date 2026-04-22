export type AgentName =
  | "devops-lead"
  | "cloudflare-specialist"
  | "finops"
  | "security-ops"
  | "vulnerability-scanner"
  | "iam";

export type SystemName = "github" | "vercel" | "supabase" | "cloudflare";

export type Severity = "low" | "medium" | "high" | "critical";

export type ActionType =
  | "create_issue"
  | "rerun_workflow"
  | "open_pr"
  | "trigger_vercel_redeploy"
  | "purge_cloudflare_cache"
  | "patch_cloudflare_dns"
  | "disable_workflow"
  | "revoke_token";

export type RunMode = "active" | "dry-run" | "observe";

export interface AgentFinding {
  id: string;
  agent: AgentName;
  system: SystemName;
  severity: Severity;
  title: string;
  summary: string;
  details: string;
  detected_at: string;
  dedupe_key: string;
  metadata?: Record<string, unknown>;
}

export interface ActionProposal {
  id: string;
  finding_id: string;
  action_type: ActionType;
  target: string;
  reason: string;
  risk: "low" | "medium" | "high";
  dry_run_result?: string;
  payload?: Record<string, unknown>;
}

export interface ActionRecord {
  id: string;
  action_type: ActionType;
  target: string;
  status: "skipped" | "dry-run" | "succeeded" | "failed";
  started_at: string;
  completed_at: string;
  result_summary: string;
  links?: string[];
}

export interface AgentRunRecord {
  agent: AgentName;
  mode: RunMode;
  started_at: string;
  completed_at: string;
  findings_count: number;
  actions_taken: ActionRecord[];
  artifact_path: string;
}

export interface GitHubRepoTarget {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}

export interface VercelTarget {
  id: string;
  name: string;
  projectIdEnv: string;
}

export interface SupabaseTarget {
  id: string;
  projectRef: string;
  functions: string[];
}

export interface CloudflareDnsRecordExpectation {
  type: string;
  name: string;
}

export interface CloudflareZoneTarget {
  id: string;
  zoneIdEnv: string;
  zoneName: string;
  expectedDnsRecords?: CloudflareDnsRecordExpectation[];
}

export interface TargetsConfig {
  github: GitHubRepoTarget[];
  vercel: VercelTarget[];
  supabase: SupabaseTarget[];
  cloudflare: CloudflareZoneTarget[];
}

export interface PoliciesConfig {
  defaultAutonomyMode: "active" | "observe";
  issueRepo: { owner: string; repo: string };
  allowedActions: Record<AgentName, ActionType[]>;
  severityThresholds: Partial<Record<ActionType, Severity>>;
  workflowAllowlist: string[];
  dnsAllowlist: string[];
}

export interface LabelsConfig {
  agent: string[];
  system: string[];
  severity: string[];
  status: string[];
}

export interface SchedulesConfig {
  [agentName: string]: string;
}

export interface LoadedConfig {
  targets: TargetsConfig;
  policies: PoliciesConfig;
  labels: LabelsConfig;
  schedules: SchedulesConfig;
}

export interface OpenAIRefinement {
  refinedSummary?: string;
  recommendedAction?: ActionType;
  reasoning?: string;
}
