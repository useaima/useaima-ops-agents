import { DurableObject } from "cloudflare:workers";

export class MasterOrchestrator extends DurableObject {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "POST" && url.pathname === "/webhook/github") {
      return await this.handleGitHubWebhook(request);
    }
    
    if (method === "POST" && url.pathname === "/dispatch") {
      return await this.handleInternalDispatch(request);
    }

    return new Response("Master Orchestrator Ready", { status: 200 });
  }

  private async handleGitHubWebhook(request: Request): Promise<Response> {
    const payload = await request.json();
    const event = request.headers.get("x-github-event");
    
    // Dispatch to CTO Agent or Coding Agent depending on event
    console.log(`[MasterOrchestrator] Received GitHub Event: ${event}`);
    
    // Save state
    await this.ctx.storage.put(`event_${Date.now()}`, { event, payload });

    return new Response("Webhook Received", { status: 202 });
  }

  private async handleInternalDispatch(request: Request): Promise<Response> {
    const { department, task } = await request.json() as { department: string; task: any };
    console.log(`[MasterOrchestrator] Dispatching to ${department} department:`, task);
    return new Response("Dispatched", { status: 200 });
  }
}
