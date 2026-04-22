# Cloudflare Routing

Use this skill when DNS or cache behavior is the likely cause of downtime.

Checklist:
- verify zone and record presence
- compare against `config/targets.json`
- prefer cache purge before record mutation
- only patch allowlisted records
