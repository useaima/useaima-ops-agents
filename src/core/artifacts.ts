import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getRepoRoot } from "./config.js";

export async function writeArtifact(name: string, data: unknown): Promise<string> {
  const artifactsDir = resolve(getRepoRoot(), ".artifacts");
  await mkdir(artifactsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = resolve(artifactsDir, `${timestamp}-${name}.json`);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return filePath;
}
