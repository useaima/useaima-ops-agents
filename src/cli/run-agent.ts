import { runAgent } from "../core/runtime.js";
import type { AgentName, RunMode } from "../core/types.js";

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const agent = readFlag("--agent") as AgentName | undefined;
  const mode = (readFlag("--mode") as RunMode | undefined) ?? "active";

  if (!agent) {
    throw new Error("Missing required --agent flag.");
  }

  const record = await runAgent(agent, mode);
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
