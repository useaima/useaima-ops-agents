import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// We use the Gemini 3.1 Pro model for advanced reasoning
const model = google('gemini-3.1-pro-preview');

export async function executeSalesWorkflow(eventPayload: any) {
  console.log(`[SalesWorkflow] Executing for event:`, eventPayload);

  const { text, toolCalls } = await generateText({
    model,
    system: `You are the Sales Director Agent. 
    You assign leads, analyze CRM data, and instruct worker agents.
    Your available tools are 'prospectLead', 'generateContent', and 'handleChurn'.`,
    prompt: `Incoming payload: ${JSON.stringify(eventPayload)}`,
    tools: {
      prospectLead: tool({
        description: 'Scans LinkedIn/GitHub to enrich lead data.',
        parameters: z.object({
          targetPersona: z.string(),
        }),
        execute: async ({ targetPersona }) => {
          console.log(`[ProspectingAgent] Searching for ${targetPersona}...`);
          return { leadsGenerated: 5, target: targetPersona };
        },
      }),
      generateContent: tool({
        description: 'Generates marketing blogs or posts.',
        parameters: z.object({
          topic: z.string(),
        }),
        execute: async ({ topic }) => {
          console.log(`[ContentMarketingAgent] Writing content about ${topic}...`);
          return { status: 'published', topic };
        },
      }),
      handleChurn: tool({
        description: 'Emails churned users to recover them.',
        parameters: z.object({
          userId: z.string(),
        }),
        execute: async ({ userId }) => {
          console.log(`[FeedbackChurnAgent] Contacting lost user: ${userId}`);
          return { status: 'recovery_email_sent', userId };
        },
      }),
    },
    maxSteps: 5,
  });

  return { result: text, toolCalls };
}
