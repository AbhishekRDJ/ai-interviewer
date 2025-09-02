// app/api/llm/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

// Types for better type safety
interface InterviewState {
  currentQuestion: string;
  timeElapsedSec: number;
  questionsRemaining: number;
  questionIndex: number;
  totalQuestions: number;
}

interface LlmDecision {
  responseQuality: "complete" | "incomplete" | "off-topic";
  action: "follow_up" | "next" | "wrap_up";
  message: string;
  reasoning?: string;
}

const INTERVIEWER_PROMPT = `You are an expert interviewer conducting a screening for an SDR (Sales Development Representative) position.

Your role:
- Ask questions clearly and professionally
- Listen for complete answers
- Ask follow-ups when responses are vague or incomplete
- Keep the interview moving (aim for 10 minutes total)
- Be encouraging but maintain professional standards

Guidelines:
- Wait for candidate to finish speaking
- Maximum 1 follow-up per question
- If candidate rambles, politely redirect
- Track time and adjust pace accordingly
- Be supportive but assess honestly

Assessment criteria for SDR responses:
- Communication skills and clarity
- Sales knowledge and experience
- Enthusiasm and motivation
- Problem-solving approach
- Ability to handle objections
- Professional demeanor

Response quality levels:
- "complete": Answer directly addresses the question with relevant details
- "incomplete": Answer is too brief, vague, or missing key elements
- "off-topic": Answer doesn't relate to the question asked

Actions you can take:
- "follow_up": Ask a clarifying question to get more complete response
- "next": Move to next question (acknowledge current response positively)
- "wrap_up": End the interview professionally

CRITICAL: You must respond with valid JSON only. No additional text before or after the JSON.

Example responses:
{
  "responseQuality": "complete",
  "action": "next",
  "message": "Great answer! That shows good understanding of the sales process. Let's move to our next question."
}

{
  "responseQuality": "incomplete",
  "action": "follow_up",
  "message": "Could you give me a specific example of how you would handle that situation?"
}

Current interview state:
- Question: {currentQuestion}
- Time elapsed: {timeElapsed} seconds
- Questions remaining: {questionsRemaining}
- Question {questionIndex + 1} of {totalQuestions}

Candidate's response: "{transcript}"

Based on this response, provide your assessment as valid JSON:`;

function buildInterviewerPrompt(transcript: string, state: InterviewState): string {
  return INTERVIEWER_PROMPT
    .replace("{currentQuestion}", state.currentQuestion)
    .replace("{timeElapsed}", state.timeElapsedSec.toString())
    .replace("{questionsRemaining}", state.questionsRemaining.toString())
    .replace("{questionIndex + 1}", (state.questionIndex + 1).toString())
    .replace("{totalQuestions}", state.totalQuestions.toString())
    .replace("{transcript}", transcript);
}

export async function POST(req: Request) {
  try {
    const { transcript, state } = (await req.json()) as {
      transcript: string;
      state: InterviewState
    };

    // Validation
    if (!transcript?.trim()) {
      return Response.json(
        { error: "Empty transcript provided" },
        { status: 400 }
      );
    }

    if (!state?.currentQuestion) {
      return Response.json(
        { error: "Invalid interview state" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY environment variable");
      return Response.json(
        { error: "LLM service not configured" },
        { status: 500 }
      );
    }

    // Build the prompt
    const prompt = buildInterviewerPrompt(transcript.trim(), state);

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7, // Balanced creativity
        maxOutputTokens: 500, // Keep responses concise
      }
    });

    console.log("Sending prompt to Gemini:", prompt.substring(0, 200) + "...");

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log("Gemini response:", text);

    // Robust JSON extraction
    const stripCodeFences = (s: string) => {
      return s
        .replace(/```json[\r\n]?/gi, "")
        .replace(/```[\r\n]?/g, "")
        .trim();
    };

    const cleaned = stripCodeFences(text);

    // Try direct parse first
    let decision: LlmDecision | null = null;
    try {
      decision = JSON.parse(cleaned) as LlmDecision;
    } catch (e) {
      console.log("Direct JSON parse failed:", e);
    }

    // Fallback: extract first {...} block
    if (!decision) {
      const braceMatch = cleaned.match(/\{[\s\S]*?\}/);
      if (braceMatch) {
        try {
          decision = JSON.parse(braceMatch[0]) as LlmDecision;
        } catch (e) {
          console.log("Fallback JSON parse failed:", e);
        }
      }
    }

    // Final validation
    if (!decision || !decision.responseQuality || !decision.action || !decision.message) {
      console.error("Invalid decision structure:", decision);
      return Response.json(
        {
          error: "Invalid response from LLM",
          raw: text,
          parsed: decision
        },
        { status: 502 }
      );
    }

    // Validate enum values
    const validQualities = ["complete", "incomplete", "off-topic"];
    const validActions = ["follow_up", "next", "wrap_up"];

    if (!validQualities.includes(decision.responseQuality)) {
      decision.responseQuality = "incomplete"; // Default fallback
    }

    if (!validActions.includes(decision.action)) {
      decision.action = "next"; // Default fallback
    }

    // Auto wrap-up logic based on time
    if (state.timeElapsedSec > 600 || state.questionsRemaining === 0) { // 10 minutes
      decision.action = "wrap_up";
      if (!decision.message.toLowerCase().includes("wrap") &&
        !decision.message.toLowerCase().includes("complete")) {
        decision.message += " Thank you for your time. Let's wrap up the interview.";
      }
    }

    return Response.json(decision);

  } catch (err) {
    console.error("LLM API error:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
        type: "server_error"
      },
      { status: 500 }
    );
  }
}