# UseAima Ops Agents

UseAima Ops Agents is the dedicated operational agent platform for UseAima infrastructure. It is intentionally separate from EVA product code and is designed to inspect, decide, act, and log across GitHub, Vercel, Supabase, and Cloudflare.

## What is in scope

- DevOps Lead Agent
- Cloudflare Specialist Agent
- FinOps Agent
- Security Ops Agent
- Vulnerability Scanner Agent
- IAM Agent

Every agent:
- writes machine-readable run artifacts
- opens or updates GitHub issues for findings
- respects a global kill switch
- acts only inside the supported action catalog

## Runtime

- Node 22
- TypeScript
- GitHub Actions for scheduling and manual dispatch
- OpenAI Responses API for optional reasoning and action refinement

## Quick start

```bash
npm install
npm run build
npm run lint
npm run test
npm run agent:smoke
```

Run a single agent:

```bash
npm run agent:run -- --agent devops-lead
```

Run in dry-run mode:

```bash
npm run agent:run -- --agent security-ops --mode dry-run
```

## Environment

Copy `.env.example` to `.env` and provide the provider tokens you want the platform to use. Missing provider secrets do not break the smoke check; they produce connector warnings instead of mutations.

- `GITHUB_TOKEN` is enough for same-repo issue automation.
- `USEAIMA_GITHUB_TOKEN` is the optional org-scoped token for cross-repo checks such as outside collaborators, Dependabot alerts, and workflow inspection across multiple UseAima repositories.

## Safety model

- `AGENT_KILL_SWITCH=true` disables all autonomous actions.
- `AUTONOMY_MODE=observe` keeps inspection and issue creation active, but blocks mutations.
- `AUTONOMY_MODE=active` allows supported actions when policies permit them.

## Repo layout

- `src/agents` runnable agent modules
- `src/connectors` provider adapters
- `src/core` orchestration, issues, policies, artifacts, OpenAI refinement
- `config` targets, policies, labels, schedules
- `docs/runbooks` human operator runbooks
- `skills` Codex-oriented operator skills

## Supported actions in v1

- create and update GitHub issues
- rerun GitHub Actions workflows
- trigger Vercel redeploys
- purge Cloudflare cache
- update allowlisted Cloudflare DNS records
- disable scheduled workflows through the repo kill switch workflow path

Some high-risk actions are defined but intentionally blocked until policy and token scope are explicitly configured, such as machine-token revocation.
