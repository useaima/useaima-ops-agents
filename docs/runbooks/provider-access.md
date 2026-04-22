# Provider Access

Minimum tokens:

- `GITHUB_TOKEN` with repository, actions, issues, dependabot, and variables scope
- `VERCEL_TOKEN` plus `VERCEL_TEAM_ID`
- `SUPABASE_ACCESS_TOKEN` with project inspection access
- `CLOUDFLARE_API_TOKEN` with DNS, cache, and zone read access

Use least privilege. Start in `AUTONOMY_MODE=observe` until the first smoke runs are clean.
