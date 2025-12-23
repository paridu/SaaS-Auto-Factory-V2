import { GoogleGenAI, Type } from "@google/genai";
import { IdeaInput, QAMetrics } from "../types";

// Note: In a real app, you might want to move these system instructions to a config.
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("MISSING_API_KEY");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

const handleApiError = (error: any): never => {
  console.error("GenAI API Error:", error);
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  
  if (msg.includes('401') || msg.includes('403') || msg.includes('api key') || msg.includes('unauthenticated')) {
    throw new Error("INVALID_API_KEY");
  }
  
  if (msg.includes('429') || msg.includes('quota')) {
    throw new Error("QUOTA_EXCEEDED");
  }

  if (msg === "MISSING_API_KEY") {
    throw new Error("MISSING_API_KEY");
  }

  throw error;
};


const MASTER_PROMPT = `
You are SaaS Auto-Factory AI.
Your goal is to rapidly create micro-SaaS using a fixed stack.
Optimize for speed, validation, and portfolio thinking.
Never overbuild. MVP only.
`;

// Helper to sanitize JSON strings from LLM responses
function cleanJsonString(text: string): string {
  if (!text) return '{}';
  
  // Remove markdown code blocks if present (both ```json and just ```)
  let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Find the first '{' and the last '}' to extract the JSON object
  const firstOpen = clean.indexOf('{');
  const lastClose = clean.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    return clean.substring(firstOpen, lastClose + 1);
  }
  
  return clean;
}

export const GenerateIdeaFromTrends = async (): Promise<IdeaInput> => {
  const prompt = `
  ${MASTER_PROMPT}

  1. Use Google Search to find current rising trends, "breakout" search queries related to business problems, or popular discussions on IndieHackers/Reddit regarding unmet software needs in late 2024/2025.
  2. Select ONE high-potential, specific micro-SaaS opportunity based on this research.
  3. Optimize the idea into a clear value proposition.
  4. KEEP THE DESCRIPTION CONCISE (under 150 words) to ensure valid JSON output.

  Return a JSON object with this structure:
  {
    "name": "Catchy Project Name",
    "targetUser": "Specific Niche Audience",
    "painPoint": "The burning problem they have",
    "description": "The optimized solution description based on the trend."
  }
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            targetUser: { type: Type.STRING },
            painPoint: { type: Type.STRING },
            description: { type: Type.STRING }
          }
        },
        maxOutputTokens: 8192, // Increased to prevent truncation
      }
    });

    const text = response.text || '{}';
    try {
        return JSON.parse(cleanJsonString(text));
    } catch (parseError) {
        console.error("JSON Parse Error in GenerateIdeaFromTrends:", parseError, "Text:", text);
        // Return a fallback instead of crashing
        return {
            name: "Manual Input Required",
            targetUser: "Define your audience",
            painPoint: "Define the problem",
            description: "The AI could not generate a valid format. Please enter your idea manually."
        };
    }
  } catch (error) {
    handleApiError(error);
  }
};

export const IdeaRadarAgent = async (input: IdeaInput) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Evaluate this SaaS idea:
  - Idea Name: ${input.name}
  - Description: ${input.description}
  - Target user: ${input.targetUser}
  - Pain point: ${input.painPoint}
  
  Score demand, urgency, and willingness to pay.
  
  Return a JSON object with the following structure:
  {
    "score": number (0-100),
    "decision": "PROCEED" or "KILL",
    "reasoning": "string explanation (concise, max 3 sentences)"
  }
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            decision: { type: Type.STRING, enum: ['PROCEED', 'KILL'] },
            reasoning: { type: Type.STRING }
          }
        },
        // IMPORTANT: Limit tokens to prevent massive loops/hallucinations which cause JSON parse errors
        maxOutputTokens: 4096, 
      }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
  } catch (error) {
    try {
      handleApiError(error);
    } catch (e: any) {
      if (e.message === "INVALID_API_KEY" || e.message === "MISSING_API_KEY" || e.message === "QUOTA_EXCEEDED") {
        throw e;
      }
      console.error("Radar Agent Error:", error);
      // Return a safe fallback to keep the app running for non-critical errors
      return {
          score: 0,
          decision: 'KILL',
          reasoning: "Analysis failed due to model response error. Please try again."
      };
    }
  }
};

export const ProductDesignerAgent = async (ideaContext: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Create a PRD (Product Requirements Document) for this SaaS Idea context:
  ${ideaContext}
  
  1. Limit MVP to max 3 core features.
  2. Define user flow.
  3. Define success metric.
  
  Output in Markdown format.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    handleApiError(error);
  }
};

export const ProductMVPReviewer = async (prd: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Analyze the following PRD and MVP scope:
  ${prd}
  
  Task:
  Review the current MVP features and suggest potential optimizations or additions to enhance initial user value, ensuring no feature exceeds the initial 3-feature limit. Consolidate if necessary and explain why these changes improve the odds of success.
  
  Output in concise Markdown.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    handleApiError(error);
  }
};

export const ProductUserFlowDesigner = async (prd: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Create a visual user flow based on this PRD:
  ${prd}
  
  Output STRICTLY ONLY valid Mermaid.js graph syntax (e.g., 'graph TD').
  Do not include markdown code fences or other text. Just the mermaid code.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Strip code fences just in case the model adds them
    let clean = response.text || '';
    if (clean.startsWith('```mermaid')) {
        clean = clean.replace(/^```mermaid\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return clean;
  } catch (error) {
    handleApiError(error);
  }
};

export const ProductTechSpecGenerator = async (prd: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Extract core requirements from this PRD and generate a Detailed Technical Specification Document:
  ${prd}
  
  Include:
  1. Data Models (Entities & Relationships)
  2. API Contract Guidelines
  3. **Monetization & Subscription Model**: Define the pricing tiers (e.g., Free, Pro, Business) and limits for each.
  4. Third-party integrations required (**MUST include Stripe/Payment Gateway for subscriptions**).
  5. **Error Handling Requirements**: Define how the system should handle Payment Failures, Card Declines, and Missing Subscription permissions.
  6. Non-functional requirements (Performance, Security)
  
  Output in Markdown.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    handleApiError(error);
  }
};

export const TechLeadAgent = async (prd: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Your task is to design the system architecture using the **Toh Framework** (https://github.com/wasintoh/toh-framework).
  
  First, use Google Search to analyze the repository: https://github.com/wasintoh/toh-framework
  Understand its core tech stack (e.g., Next.js, Hono, Drizzle ORM, Shadcn/UI) and directory structure.
  
  Then, based on this PRD:
  ${prd}
  
  1. **Stack Confirmation**: List the specific technologies used in Toh Framework.
  2. **DB Schema**: Design the database schema. **MANDATORY: Include a 'subscriptions' table with fields: stripe_subscription_id, stripe_customer_id, stripe_price_id, status, current_period_end.**
  3. **API Endpoints**: Define key API routes. **Include: POST /api/checkout (creates session), POST /api/portal (customer portal), POST /api/webhooks/stripe.**
  4. **Stripe Integration Plan**: 
     - Map pricing tiers from PRD to Stripe Product/Price strategies.
     - Define the webhook lifecycle (checkout.session.completed -> create/update subscription).
     - **Error Handling Strategy**: Explicitly define how to handle signature verification failures and payment method errors.
     - Explicitly list required Env Vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
  5. **Folder Structure**: Show where files should go based on the repo's structure.
  6. **Do not change stack**: You must strictly adhere to the tools found in the repo.
  
  Output in Markdown format.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Using Pro + Search for accurate repo analysis
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text;
  } catch (error) {
    handleApiError(error);
  }
};

export const DevAgent = async (architecture: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Act as a Vibe Coding Dev Agent specialized in the **Toh Framework** (https://github.com/wasintoh/toh-framework).
  Generate production-ready code structure based on this architecture:
  ${architecture}
  
  1. **Scaffold**: Provide the main folder structure tree.
  2. **Config**: Provide the content for .env.example **(Must include STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_APP_URL)**.
  3. **Stripe Integration (CRITICAL)**:
     - \`lib/stripe.ts\`: Initialize Stripe singleton. **Add a runtime check: throw specific error if STRIPE_SECRET_KEY is missing.**
     - \`app/api/webhooks/stripe/route.ts\`: **GENERATE FULL CODE** for the webhook handler. 
       - MUST use \`stripe.webhooks.constructEvent\` with \`process.env.STRIPE_WEBHOOK_SECRET\`.
       - **Robust Error Handling**: Wrap logic in try/catch. Specifically catch signature verification errors and return status 400 with "Webhook Error: {error.message}". Log all errors.
       - Handle \`checkout.session.completed\` to insert/update subscription in DB.
       - Handle \`invoice.payment_succeeded\` to extend subscription.
     - \`app/api/checkout/route.ts\`: Code to create a checkout session for a specific priceId.
       - **Error Handling**: Wrap in try/catch. Return 500 status with a JSON object \`{ error: message }\` if session creation fails (e.g. invalid price ID, API network error).
  4. **Getting Started**: README snippet on how to get Stripe keys, set up the webhook secret, and test locally using Stripe CLI.
  5. Focus only on MVP.
  
  Output in Markdown.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return response.text;
  } catch (error) {
    handleApiError(error);
  }
};

export const DecisionGateAgent = async (metrics: QAMetrics, ideaContext: string) => {
  const prompt = `
  ${MASTER_PROMPT}
  
  Context: ${ideaContext}
  
  Given these metrics:
  - Users: ${metrics.users}
  - Retention: ${metrics.retention}
  - Revenue: ${metrics.revenue}
  - Feedback: ${metrics.feedback}
  
  Decide: ITERATE, PIVOT, or KILL.
  Explain briefly.
  
  Return JSON:
  {
    "decision": "ITERATE" | "PIVOT" | "KILL",
    "analysis": "string (concise)"
  }
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                decision: { type: Type.STRING, enum: ['ITERATE', 'PIVOT', 'KILL'] },
                analysis: { type: Type.STRING }
            }
        },
        maxOutputTokens: 2048, // Increased to prevent truncation
      }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
  } catch (error) {
    try {
      handleApiError(error);
    } catch (e: any) {
        if (e.message === "INVALID_API_KEY" || e.message === "MISSING_API_KEY" || e.message === "QUOTA_EXCEEDED") {
            throw e;
        }
        console.error("Decision Gate Error:", error);
        return {
            decision: 'ITERATE',
            analysis: "Error analyzing metrics. Suggesting iteration by default."
        };
    }
  }
};