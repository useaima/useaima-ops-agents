import type { ActionType, OpenAIRefinement } from "./types.js";

const SUPPORTED_ACTIONS: ActionType[] = [
  "create_issue",
  "rerun_workflow",
  "open_pr",
  "trigger_vercel_redeploy",
  "purge_cloudflare_cache",
  "patch_cloudflare_dns",
  "disable_workflow",
  "revoke_token"
];

export async function refineFindingWithOpenAI(input: {
  summary: string;
  details: string;
  actions: ActionType[];
}): Promise<OpenAIRefinement | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      reasoning: {
        effort: process.env.OPENAI_REASONING_EFFORT || "medium"
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are an infrastructure operations assistant. Return compact JSON with keys refinedSummary, recommendedAction, reasoning. Keep recommendedAction within the provided actions or null."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                summary: input.summary,
                details: input.details,
                actions: input.actions.filter((action) => SUPPORTED_ACTIONS.includes(action))
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "refinement",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              refinedSummary: { type: ["string", "null"] },
              recommendedAction: {
                anyOf: [
                  { type: "null" },
                  { type: "string", enum: SUPPORTED_ACTIONS }
                ]
              },
              reasoning: { type: ["string", "null"] }
            },
            required: ["refinedSummary", "recommendedAction", "reasoning"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };

  if (!payload.output_text) {
    return null;
  }

  return JSON.parse(payload.output_text) as OpenAIRefinement;
}
