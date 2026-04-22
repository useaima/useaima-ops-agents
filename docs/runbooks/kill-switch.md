# Kill Switch

Set `AGENT_KILL_SWITCH=true` in the repo variables when you want every autonomous action to stop immediately.

Effects:

- inspections still run
- findings still become GitHub issues
- mutations are blocked

Recovery:

1. verify the triggering incident is stable
2. switch `AUTONOMY_MODE=observe`
3. set `AGENT_KILL_SWITCH=false`
4. watch one full schedule cycle before restoring `AUTONOMY_MODE=active`
