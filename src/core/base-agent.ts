import type { ActionProposal, AgentFinding, AgentName, LoadedConfig, RunMode } from "./types.js";

export interface AgentContext {
  config: LoadedConfig;
  mode: RunMode;
}

export interface AgentResult {
  findings: AgentFinding[];
  proposals: ActionProposal[];
}

export abstract class BaseAgent {
  constructor(readonly name: AgentName) {}

  abstract run(context: AgentContext): Promise<AgentResult>;
}
