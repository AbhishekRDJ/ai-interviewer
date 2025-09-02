import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildInterviewerPrompt, type InterviewState, type LlmDecision } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { transcript, state } = (await req.json()) as { transcript: string; state: InterviewState };
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const prompt = buildInterviewerPrompt(transcript, state);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Robust JSON extraction: handle code fences and extra prose
    const stripCodeFences = (s: string) => {
      return s
        .replace(/```json[\r\n]?/gi, "")
        .replace(/```[\r\n]?/g, "")
        .trim();
    };

    let cleaned = stripCodeFences(text);

    // Try direct parse first
    let decision: LlmDecision | null = null;
    try {
      decision = JSON.parse(cleaned) as LlmDecision;
    } catch { }

    if (!decision) {
      // Fallback: extract first {...} block
      const braceMatch = cleaned.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          decision = JSON.parse(braceMatch[0]) as LlmDecision;
        } catch { }
      }
    }

    if (!decision) {
      return new Response(
        JSON.stringify({ error: "invalid-json-from-llm", raw: text }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(decision), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}


