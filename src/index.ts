import { Hono } from "hono";
import { MasterOrchestrator } from "./orchestrator/MasterOrchestrator";
import { EmailConnector } from "./connectors/email";

// Export the Durable Object class so Cloudflare can bind it
export { MasterOrchestrator };

type Bindings = {
  MASTER_ORCHESTRATOR: DurableObjectNamespace;
  EMAIL_SENDER: any;
  SENTRY_DSN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check
app.get("/ping", (c) => c.text("UseAima Ops Agents - Global Mesh Active"));

// Webhook for GitHub (Custom App)
app.post("/webhook/github", async (c) => {
  // We delegate webhooks to the Master Orchestrator DO
  const id = c.env.MASTER_ORCHESTRATOR.idFromName("global-orchestrator");
  const obj = c.env.MASTER_ORCHESTRATOR.get(id);
  
  // Forward the request to the Durable Object
  return await obj.fetch(c.req.raw);
});

// Admin Endpoint to trigger agents manually
app.post("/api/admin/dispatch", async (c) => {
  const body = await c.req.json();
  const id = c.env.MASTER_ORCHESTRATOR.idFromName("global-orchestrator");
  const obj = c.env.MASTER_ORCHESTRATOR.get(id);
  
  const dispatchReq = new Request("http://orchestrator/dispatch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });

  return await obj.fetch(dispatchReq);
});

// Test Email
app.post("/api/admin/test-email", async (c) => {
  const email = new EmailConnector();
  await email.send(c.env, {
    to: "mukabanealvins@gmail.com",
    subject: "UseAima Master Orchestrator Online",
    body: "The global mesh has successfully initialized and the Cloudflare Agents SDK is active."
  });
  return c.text("Test email sent");
});

export default app;
