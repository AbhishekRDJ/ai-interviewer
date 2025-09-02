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

const SCORING_PROMPT = `You are an expert interviewer evaluating responses for an SDR (Sales Development Representative) position.

Evaluate the candidate based on these criteria:
1. **Communication Skills** (25%): Clarity, articulation, professional language
2. **Sales Knowledge** (30%): Understanding of sales process, techniques, best practices  
3. **Problem Solving** (25%): Ability to think through scenarios, handle objections
4. **Professionalism** (20%): Appropriate responses, enthusiasm, preparation

For each question, score 1-10 where:
- 1-3: Poor (major concerns)
- 4-6: Average (meets basic requirements)
- 7-8: Good (above average performance)
- 9-10: Excellent (exceptional candidate)

Overall decision guidelines:
- **hire**: Score 7.5+ overall, strong in sales knowledge and communication
- **maybe**: Score 6.0-7.4, some strengths but areas for development
- **no_hire**: Score below 6.0 or major red flags

CRITICAL: Respond with valid JSON only. No additional text.

Interview transcript:
{transcript}

Questions asked:
{questions}

Provide detailed scoring analysis as JSON:`;

export async function POST(req: Request) {
  try {
    const { transcript, responses } = await req.json();

    if (!transcript?.trim()) {
      return Response.json(
        { error: "No transcript provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Scoring service not configured" },
        { status: 500 }
      );
    }

    // Build questions summary
    const questionsList = interviewConfig.screening.questions
      .map(q => `- ${q.question}`)
      .join('\n');

    const prompt = SCORING_PROMPT
      .replace('{transcript}', transcript)
      .replace('{questions}', questionsList);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.3, // Lower temperature for consistent scoring
        maxOutputTokens: 1500,
      }
    });

    console.log("Scoring interview transcript...");

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON response
    let scoringResult: ScoringResult | null = null;

    try {
      // Clean up response
      const cleaned = text
        .replace(/```json[\r\n]?/gi, "")
        .replace(/```[\r\n]?/g, "")
        .trim();

      scoringResult = JSON.parse(cleaned);
    } catch (e) {
      // Fallback parsing
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          scoringResult = JSON.parse(jsonMatch[0]);
        } catch { }
      }
    }

    if (!scoringResult) {
      console.error("Failed to parse scoring result:", text);

      // Return a basic fallback score
      return Response.json({
        overallScore: 5,
        categoryScores: {
          communication: 5,
          salesKnowledge: 5,
          problemSolving: 5,
          professionalism: 5
        },
        questionScores: [],
        summary: "Interview completed. Detailed scoring temporarily unavailable.",
        recommendations: ["Review responses and provide detailed feedback"],
        decision: "maybe",
        raw: text
      });
    }

    // Validate and sanitize scores
    if (typeof scoringResult.overallScore !== 'number' ||
      scoringResult.overallScore < 1 ||
      scoringResult.overallScore > 10) {
      scoringResult.overallScore = 5; // Default
    }

    // Ensure decision is valid
    const validDecisions = ["hire", "maybe", "no_hire"];
    if (!validDecisions.includes(scoringResult.decision)) {
      // Auto-decide based on score
      if (scoringResult.overallScore >= 7.5) scoringResult.decision = "hire";
      else if (scoringResult.overallScore >= 6.0) scoringResult.decision = "maybe";
      else scoringResult.decision = "no_hire";
    }

    console.log("Scoring completed:", {
      overallScore: scoringResult.overallScore,
      decision: scoringResult.decision
    });

    return Response.json(scoringResult);

  } catch (error) {
    console.error("Scoring error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Scoring failed",
        overallScore: 5,
        summary: "Scoring service encountered an error. Please review manually."
      },
      { status: 500 }
    );
  }
}