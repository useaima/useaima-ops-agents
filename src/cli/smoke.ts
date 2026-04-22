import { CloudflareConnector } from "../connectors/cloudflare.js";
import { GitHubConnector } from "../connectors/github.js";
import { SupabaseConnector } from "../connectors/supabase.js";
import { VercelConnector } from "../connectors/vercel.js";
import { writeArtifact } from "../core/artifacts.js";
import { loadConfig } from "../core/config.js";

async function main(): Promise<void> {
  const config = await loadConfig();
  const github = new GitHubConnector();
  const vercel = new VercelConnector();
  const supabase = new SupabaseConnector();
  const cloudflare = new CloudflareConnector();

  const smoke = {
    timestamp: new Date().toISOString(),
    connectors: {
      github: github.isConfigured() ? "configured" : "missing token",
      vercel: vercel.isConfigured() ? "configured" : "missing config",
      supabase: supabase.isConfigured() ? "configured" : "missing config",
      cloudflare: cloudflare.isConfigured() ? "configured" : "missing config"
    },
    targets: {
      github: config.targets.github.length,
      vercel: config.targets.vercel.length,
      supabase: config.targets.supabase.length,
      cloudflare: config.targets.cloudflare.length
    }
  };

  const artifact = await writeArtifact("smoke", smoke);
  console.log(JSON.stringify({ ...smoke, artifact }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
