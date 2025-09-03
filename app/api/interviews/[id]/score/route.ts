// app/api/interviews/[id]/score/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { Session } from "../../../../models/Session";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { interviewConfig } from "../../../../../interview-config/interviewConfig";
import { SessionDocument } from "../../../../../lib/types/interview";

/**
 * If LLM is unavailable (429/quota/etc) we compute a simple deterministic fallback score
 * based on response lengths and presence of follow-ups. It's deliberately conservative.
 */
function fallbackScoreFromResponses(responses: Array<{ questionId?: string; question?: string; response?: string; followUps?: unknown[] }>) {
    // Score each question by length & presence of follow-ups
    const questionScores = responses.map((r) => {
        const text = (r.response || "").toString().trim();
        const wordCount = text ? text.split(/\s+/).length : 0;
        // base score 1..10 derived from wordCount with sensible clamping
        // short answers => low score, long thorough answers => higher score
        let score = Math.round(Math.min(9, Math.max(2, (wordCount / 80) * 10)));
        if (r.followUps && r.followUps.length > 0) score = Math.min(10, score + 1); // small boost
        // feedback hint (simple)
        let feedback = "";
        if (!text) feedback = "No response provided.";
        else if (wordCount < 20) feedback = "Short answer — try adding a specific example.";
        else if (wordCount < 60) feedback = "Good, but could use one concrete example or data point.";
        else feedback = "Solid answer — clear, specific, and detailed.";
        return {
            questionId: r.questionId || "",
            question: r.question || "",
            response: text,
            score,
            feedback,
        };
    });

    // Compute category scores as averages of question scores with small modifiers
    const avgQuestionScore = questionScores.length
        ? questionScores.reduce((s, q) => s + q.score, 0) / questionScores.length
        : 5;

    // Heuristic distribution (you can tune)
    const communication = Math.min(10, Math.max(1, avgQuestionScore));
    const salesKnowledge = Math.min(10, Math.max(1, avgQuestionScore - 0.5)); // slightly lower by default
    const problemSolving = Math.min(10, Math.max(1, avgQuestionScore));
    const professionalism = Math.min(10, Math.max(1, avgQuestionScore - 0.2));

    // Weighted overall: Communication (25%), Sales Knowledge (30%), Problem Solving (25%), Professionalism (20%)
    const overallScore =
        (communication * 0.25 +
            salesKnowledge * 0.3 +
            problemSolving * 0.25 +
            professionalism * 0.2);

    // Decision thresholds
    let decision: "hire" | "maybe" | "no_hire" = "no_hire";
    if (overallScore >= 7.5) decision = "hire";
    else if (overallScore >= 6.0) decision = "maybe";
    else decision = "no_hire";

    const summary = `Fallback scoring computed from responses (word counts & follow-ups). This is an approximate result while LLM scoring is unavailable.`;

    const recommendations = [
        "Provide concise concrete examples where possible.",
        "Expand short answers to include challenges you faced and the outcome.",
    ];

    return {
        overallScore: Number(overallScore.toFixed(1)),
        categoryScores: {
            communication: Number(communication.toFixed(1)),
            salesKnowledge: Number(salesKnowledge.toFixed(1)),
            problemSolving: Number(problemSolving.toFixed(1)),
            professionalism: Number(professionalism.toFixed(1)),
        },
        questionScores,
        summary,
        recommendations,
        decision,
        fallback: true, // indicate this was fallback
    };
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
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();

        const { id: sessionId } = await params;
        if (!sessionId) {
            return new NextResponse(
                JSON.stringify({ error: "Missing session id" }),
                { status: 400 }
            );
        }

        const doc = await Session.findById(sessionId).lean() as SessionDocument | null;
        if (!doc) {
            return new NextResponse(JSON.stringify({ error: "Session not found" }), { status: 404 });
        }

        const transcript = (doc.transcript || "").toString();
        const responses = (doc.responses || []) as Array<{ questionId?: string; question?: string; response?: string; followUps?: unknown[] }>;

        if (!transcript.trim()) {
            return new NextResponse(JSON.stringify({ error: "No transcript to score" }), { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            // If no API key configured, produce fallback scoring (useful in dev)
            const fallback = fallbackScoreFromResponses(responses);
            await Session.findByIdAndUpdate(sessionId, {
                $set: { scoring: fallback, status: "scored", scoredAt: new Date() },
            });
            return NextResponse.json(fallback);
        }

        const questionsList = (interviewConfig?.screening?.questions || [])
            .map((q: { question: string }) => `- ${q.question}`)
            .join("\n");

        const prompt = SCORING_PROMPT.replace("{transcript}", transcript).replace("{questions}", questionsList);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1500,
                responseMimeType: "application/json",
            },
        });

        let scoringResult: Record<string, unknown> | null = null;
        let rawLLMText = "";

        try {
            const result = await model.generateContent(prompt);
            rawLLMText = result.response.text();
            try {
                scoringResult = JSON.parse(rawLLMText);
            } catch (parseErr) {
                console.error("Failed to parse LLM JSON:", parseErr, rawLLMText);
            }
        } catch (llmErr: unknown) {
            // Inspect the error and determine if it's a rate-limit / quota error
            const errText = String((llmErr as Error)?.message || llmErr);
            console.error("LLM call error:", errText);

            // Treat quota / 429 errors specially: fall back
            if (errText.includes("429") || errText.toLowerCase().includes("quota") || errText.toLowerCase().includes("too many requests")) {
                const fallback = fallbackScoreFromResponses(responses);

                // Save fallback and raw error for debugging
                await Session.findByIdAndUpdate(sessionId, {
                    $set: {
                        scoring: { ...fallback, rawLLMError: errText },
                        status: "scored",
                        scoredAt: new Date(),
                    },
                });

                return NextResponse.json({ ...fallback, rawLLMError: errText });
            }

            // For other errors, also fall back but mark error
            const fallback = fallbackScoreFromResponses(responses);
            await Session.findByIdAndUpdate(sessionId, {
                $set: {
                    scoring: { ...fallback, rawLLMError: errText },
                    status: "scored",
                    scoredAt: new Date(),
                },
            });
            return NextResponse.json({ ...fallback, rawLLMError: errText });
        }

        if (!scoringResult) {
            // LLM returned something unparsable or empty — fallback
            const fallback = fallbackScoreFromResponses(responses);
            await Session.findByIdAndUpdate(sessionId, {
                $set: {
                    scoring: { ...fallback, rawLLMText },
                    status: "scored",
                    scoredAt: new Date(),
                },
            });
            return NextResponse.json({ ...fallback, rawLLMText });
        }

        // Normalize numeric fields & ensure decision valid
        scoringResult.overallScore = Number(scoringResult.overallScore || 0);

        if (!scoringResult.categoryScores) {
            scoringResult.categoryScores = { communication: 5, salesKnowledge: 5, problemSolving: 5, professionalism: 5 };
        }
        for (const k of Object.keys(scoringResult.categoryScores as Record<string, unknown>)) {
            (scoringResult.categoryScores as Record<string, unknown>)[k] = Number((scoringResult.categoryScores as Record<string, unknown>)[k] || 0);
        }

        scoringResult.questionScores = ((scoringResult.questionScores as Array<{ questionId?: string; question?: string; response?: string; score?: number }>) || []).map((q) => ({
            ...q,
            score: Number(q.score || 0),
        }));

        const validDecisions = ["hire", "maybe", "no_hire"];
        if (!validDecisions.includes((scoringResult.decision as string))) {
            const overallScore = scoringResult.overallScore as number;
            if (overallScore >= 7.5) scoringResult.decision = "hire";
            else if (overallScore >= 6.0) scoringResult.decision = "maybe";
            else scoringResult.decision = "no_hire";
        }

        // Save scoring to the session doc and include raw LLM text for debugging
        await Session.findByIdAndUpdate(sessionId, {
            $set: { scoring: scoringResult, status: "scored", scoredAt: new Date(), rawLLMText },
        });

        return NextResponse.json(scoringResult);
    } catch (err) {
        console.error("Score route error:", err);
        return new NextResponse(JSON.stringify({ error: String(err) }), { status: 500 });
    }
}
