# Incident Response

1. Confirm whether the finding is still active in the latest agent issue.
2. Check the action comments for anything already attempted.
3. If `AGENT_KILL_SWITCH=true`, leave it on until the root cause is understood.
4. Prefer reverting to a known-good configuration before introducing new changes.
5. Close the issue only after a later agent run verifies recovery.
