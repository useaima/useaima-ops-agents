import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { LabelsConfig, LoadedConfig, PoliciesConfig, SchedulesConfig, TargetsConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const filePath = resolve(repoRoot, relativePath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadConfig(): Promise<LoadedConfig> {
  const [targets, policies, labels, schedules] = await Promise.all([
    readJsonFile<TargetsConfig>("config/targets.json"),
    readJsonFile<PoliciesConfig>("config/policies.json"),
    readJsonFile<LabelsConfig>("config/labels.json"),
    readJsonFile<SchedulesConfig>("config/schedules.json")
  ]);

  return { targets, policies, labels, schedules };
}

export function getRepoRoot(): string {
  return repoRoot;
}

export function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}
