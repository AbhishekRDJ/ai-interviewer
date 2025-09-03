// app/api/score/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { interviewConfig } from "@/interview-config/interviewConfig";

export const runtime = "nodejs";

interface ScoringResult {
  overallScore: number;
  categoryScores: {
    communication: number;
    salesKnowledge: number;
    problemSolving: number;
    professionalism: number;
  };
  questionScores: Array<{
    questionId: string;
    question: string;
    response: string;
    score: number;
    feedback: string;
  }>;
  summary: string;
  recommendations: string[];
  decision: "hire" | "maybe" | "no_hire";
}

const SCORING_PROMPT = `
You are an expert interviewer evaluating responses for an SDR (Sales Development Representative) position.

CRITICAL INSTRUCTION: Respond with **valid JSON only** that matches this TypeScript interface:

{
  "overallScore": number,
  "categoryScores": {
    "communication": number,
    "salesKnowledge": number,
    "problemSolving": number,
    "professionalism": number
  },
  "questionScores": Array<{
    "questionId": string,
    "question": string,
    "response": string,
    "score": number,
    "feedback": string
  }>,
  "summary": string,
  "recommendations": string[],
  "decision": "hire" | "maybe" | "no_hire"
}

Scoring Rules:
- Communication (25%), Sales Knowledge (30%), Problem Solving (25%), Professionalism (20%)
- Question scores: 1–10
- Overall decision: hire (>=7.5), maybe (6.0–7.4), no_hire (<6.0)

Transcript:
{transcript}

Questions:
{questions}
`;

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();

    if (!transcript?.trim()) {
      return Response.json({ error: "No transcript provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Scoring service not configured" }, { status: 500 });
    }

    // Build questions summary
    const questionsList = interviewConfig.screening.questions
      .map((q) => `- ${q.question}`)
      .join("\n");

    const prompt = SCORING_PROMPT
      .replace("{transcript}", transcript)
      .replace("{questions}", questionsList);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
      },
    });

    console.log("Scoring interview transcript...");

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let scoringResult: ScoringResult | null = null;

    try {
      scoringResult = JSON.parse(text);
    } catch {
      console.error("JSON parse failed:", text);
    }

    if (!scoringResult) {
      return Response.json({
        overallScore: 5,
        categoryScores: {
          communication: 5,
          salesKnowledge: 5,
          problemSolving: 5,
          professionalism: 5,
        },
        questionScores: [],
        summary: "Interview completed. Detailed scoring temporarily unavailable.",
        recommendations: ["Review responses and provide detailed feedback"],
        decision: "maybe",
        raw: text,
      });
    }

    // --- Normalize numeric fields ---
    scoringResult.overallScore = Number(scoringResult.overallScore);

    for (const [key, val] of Object.entries(scoringResult.categoryScores)) {
      scoringResult.categoryScores[key as keyof typeof scoringResult.categoryScores] = Number(val);
    }

    scoringResult.questionScores = scoringResult.questionScores.map((q) => ({
      ...q,
      score: Number(q.score),
    }));

    // --- Ensure valid decision ---
    const validDecisions = ["hire", "maybe", "no_hire"];
    if (!validDecisions.includes(scoringResult.decision)) {
      if (scoringResult.overallScore >= 7.5) scoringResult.decision = "hire";
      else if (scoringResult.overallScore >= 6.0) scoringResult.decision = "maybe";
      else scoringResult.decision = "no_hire";
    }

    console.log("Scoring completed:", {
      overallScore: scoringResult.overallScore,
      decision: scoringResult.decision,
    });

    return Response.json(scoringResult);
  } catch (error) {
    console.error("Scoring error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Scoring failed",
        overallScore: 5,
        summary: "Scoring service encountered an error. Please review manually.",
      },
      { status: 500 }
    );
  }
}
