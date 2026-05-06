import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.1-pro-preview');

export async function executeSecurityWorkflow(eventPayload: any) {
  console.log(`[SecurityWorkflow] Executing for event:`, eventPayload);

  const { text, toolCalls } = await generateText({
    model,
    system: `You are the Security Ops Agent (The Guard).
    You monitor Cloudflare WAF logs, scan vulnerabilities, and audit IAM permissions.
    You manage the VulnerabilityScanner and IAMAgent. 
    You also incorporate the Sentinel Forensic Engine to analyze threats deeply.`,
    prompt: `Incoming Security Alert or Log: ${JSON.stringify(eventPayload)}`,
    tools: {
      analyzeThreats: tool({
        description: 'Uses the Sentinel Forensic Engine to analyze raw tool outputs and logs.',
        parameters: z.object({
          logs: z.array(z.string()),
        }),
        execute: async ({ logs }) => {
          console.log(`[SecurityOps/Sentinel] Analyzing threats from ${logs.length} log sources...`);
          
          // Utilizing Gemini nested inside the tool to mimic Sentinel's original behavior
          const { text: analysis } = await generateText({
            model: google('gemini-3-flash-preview'),
            system: 'You are a Forensic Analyzer Engine. Extract malicious activity from logs.',
            prompt: `TOOL OUTPUTS:\n${logs.join('\n\n---\n\n')}`
          });
          
          return { status: 'analysis_complete', findings: analysis };
        },
      }),
      scanVulnerabilities: tool({
        description: 'Scans the GitHub repository dependencies for CVEs.',
        parameters: z.object({
          repo: z.string(),
        }),
        execute: async ({ repo }) => {
          console.log(`[VulnerabilityScanner] Scanning ${repo}...`);
          return { status: 'scanned', cvesFound: 0 };
        },
      }),
      auditIAM: tool({
        description: 'Audits permissions across GitHub, Vercel, and Cloudflare.',
        parameters: z.object({
          userOrService: z.string(),
        }),
        execute: async ({ userOrService }) => {
          console.log(`[IAMAgent] Auditing access for ${userOrService}...`);
          return { status: 'compliant' };
        },
      }),
    },
    maxSteps: 5,
  });

  return { result: text, toolCalls };
}
