import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

import { executeSalesWorkflow } from '../../../workflows/sales';
import { executeProductWorkflow } from '../../../workflows/product';
import { executeDevOpsWorkflow } from '../../../workflows/devops';
import { executeSecurityWorkflow } from '../../../workflows/security';

// Master Orchestrator Webhook Receiver
export async function POST(req: Request) {
  const payload = await req.json();
  const eventName = req.headers.get('x-github-event') || 'manual_dispatch';

  console.log(`[MasterOrchestrator] Received Event: ${eventName}`);

  // Use Gemini to analyze the webhook and determine the best department agent
  const { text: decision } = await generateText({
    model: google('gemini-3.1-pro-preview'),
    system: `You are the Master Orchestrator for UseAima. 
    Analyze the incoming event and decide which department agent to spawn.
    Departments: 'sales', 'product', 'devops', 'security'.
    Respond ONLY with the department name.`,
    prompt: `Event: ${eventName}\nPayload: ${JSON.stringify(payload).substring(0, 1000)}`
  });

  const department = decision.trim().toLowerCase();
  console.log(`[MasterOrchestrator] Routing task to department: ${department}`);

  // Route to the specific department workflow
  let result;
  try {
    switch (department) {
      case 'sales':
        result = await executeSalesWorkflow(payload);
        break;
      case 'product':
        result = await executeProductWorkflow(payload);
        break;
      case 'devops':
        result = await executeDevOpsWorkflow(payload);
        break;
      case 'security':
        result = await executeSecurityWorkflow(payload);
        break;
      default:
        console.warn(`[MasterOrchestrator] Unknown department: ${department}. Defaulting to devops.`);
        result = await executeDevOpsWorkflow(payload);
    }
  } catch (error: any) {
    console.error(`[MasterOrchestrator] Failed to execute workflow for ${department}:`, error);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }

  return Response.json({
    status: 'success',
    routed_to: department,
    result
  });
}
