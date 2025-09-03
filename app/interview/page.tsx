
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import InterviewControls from "@/components/InterviewControls";
import TranscriptBox from "@/components/TranscriptBox";
import StatusBar from "@/components/StatusBar";
import { useInterviewState } from "@/lib/hooks/useInterviewState";


const VideoCall = dynamic(() => import("@/components/VideoCall"), { ssr: false });

type Phase = "idle" | "speaking" | "listening" | "evaluating" | "wrap_up" | "completed";

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

export default function InterviewPage() {
  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Import from your custom hook
  const {
    currentQuestion,
    currentIndex,
    totalQuestions,
    timeElapsedSec,
    nextQuestion,
    recordResponse,
    isLastQuestion,
    responses
  } = useInterviewState();

  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const transcriptRef = useRef<string>("");
  const recognitionRef = useRef<any>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsRemaining, setSecondsRemaining] = useState<number | undefined>();

  // Interview control refs
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const runGuardRef = useRef(false);
  const recordingApiRef = useRef<{ startRecording: () => Promise<void>; stopRecording: () => Promise<void> } | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const [scoring, setScoring] = useState<ScoringResult | null>(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const createSession = useCallback(async (payload: { roomUrl?: string; transcript?: string; responses?: any[] }) => {
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    // store both state and ref
    sessionIdRef.current = data.id as string;
    setSessionId(sessionIdRef.current);
    return data.id as string;
  }, []);

  // append response to server (stable)
  const appendResponseToSession = useCallback(async (id: string, responseObj: any) => {
    const res = await fetch(`/api/interviews/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appendResponse: responseObj }),
    });
    if (!res.ok) {
      console.warn("Failed to append response to session:", await res.text());
    }
    return res.ok;
  }, []);

  // finalize and ask server to score (stable)
  const finalizeAndScoreSession = useCallback(async (id: string, finalTranscript?: string) => {
    // finalize (set completedAt etc.)
    await fetch(`/api/interviews/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ finalize: true, transcript: finalTranscript }),
    });

    // request server to compute score
    const res = await fetch(`/api/interviews/${id}/score`, { method: "POST" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Scoring failed");
    }
    const scoringResult = await res.json();
    return scoringResult;
  }, []);
  // Track all Q&A pairs for scoring
  const interviewDataRef = useRef<Array<{
    questionId: string;
    question: string;
    response: string;
    followUps?: Array<{ question: string; response: string }>;
  }>>([]);

  // Promise resolvers for async flow control
  const transcriptResolverRef = useRef<((val: string) => void) | null>(null);
  const ttsResolverRef = useRef<(() => void) | null>(null);

  /** ---- Daily room setup ---- */
  const createRoom = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/createRoom", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRoomUrl(data?.room?.url || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    createRoom();
  }, [createRoom]);

  /** ---- TTS with better error handling ---- */
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!window.speechSynthesis) {
          reject(new Error("Speech synthesis not supported"));
          return;
        }

        const synth = window.speechSynthesis;
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        let settled = false;
        const resolveOnce = () => {
          if (!settled) {
            settled = true;
            ttsResolverRef.current = null;
            resolve();
          }
        };
        const rejectOnce = (err: Error) => {
          if (!settled) {
            settled = true;
            ttsResolverRef.current = null;
            reject(err);
          }
        };

        ttsResolverRef.current = resolveOnce;

        utterance.onend = () => resolveOnce();
        utterance.onerror = (event) => {
          const errName = String((event as any)?.error || "unknown");
          if (errName === "interrupted" || errName === "canceled" || errName === "service-not-allowed") {
            resolveOnce();
            return;
          }
          rejectOnce(new Error(`TTS error: ${errName}`));
        };

        if (synth.getVoices().length === 0) {
          synth.onvoiceschanged = () => synth.speak(utterance);
        } else {
          synth.speak(utterance);
        }

        setTimeout(() => {
          if (!settled && ttsResolverRef.current) resolveOnce();
        }, Math.min(12000, Math.max(2000, text.length * 60)));

      } catch (err) {
        reject(err);
      }
    });
  }, []);

  /** ---- Speech Recognition ---- */
  const startRecognition = useCallback(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Web Speech API not supported in this browser.");
      return null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { }
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + " ";
          transcriptRef.current = finalTranscript;
        } else {
          interimTranscript += transcript;
        }
      }

      setLiveTranscript(finalTranscript + interimTranscript);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        if (phase === "listening" && isRunningRef.current && !isPausedRef.current) {
          submitTranscript(transcriptRef.current.trim());
        }
      }, 3000);
    };

    recognition.onerror = (event: any) => {
      const errName = String(event?.error || "");
      console.warn("Speech recognition error:", errName);
      if (errName && errName !== "no-speech" && errName !== "aborted") {
        setError(`Speech recognition error: ${errName}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };

    try {
      recognition.start();
      setListening(true);
      recognitionRef.current = recognition;
      return recognition;
    } catch (error) {
      setError("Failed to start speech recognition");
      return null;
    }
  }, [phase]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { }
      recognitionRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setListening(false);
  }, []);

  const waitForTranscript = useCallback(() => {
    return new Promise<string>((resolve) => {
      transcriptResolverRef.current = resolve;
    });
  }, []);

  const submitTranscript = useCallback((text: string) => {
    stopRecognition();

    if (transcriptResolverRef.current) {
      transcriptResolverRef.current(text);
      transcriptResolverRef.current = null;
    }

    setSecondsRemaining(undefined);
  }, [stopRecognition]);

  /** ---- LLM Integration ---- */
  const askLLM = useCallback(
    async (transcript: string) => {
      const payload = {
        transcript,
        state: {
          currentQuestion: currentQuestion?.question || "",
          timeElapsedSec,
          questionsRemaining: Math.max(0, totalQuestions - currentIndex - 1),
          questionIndex: currentIndex,
          totalQuestions,
        },
      };

      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
      }

      return (await res.json()) as {
        responseQuality: "complete" | "incomplete" | "off-topic";
        action: "follow_up" | "next" | "wrap_up";
        message: string;
      };
    },
    [currentQuestion?.question, timeElapsedSec, totalQuestions, currentIndex]
  );

  /** ---- Main interview loop ---- */
  const runInterviewLoop = useCallback(async () => {
    if (!currentQuestion || !isRunningRef.current) return;
    if (runGuardRef.current) return;
    runGuardRef.current = true;

    try {
      transcriptRef.current = "";
      setLiveTranscript("");

      // Track current Q&A
      const currentQA = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        response: "",
        followUps: [] as Array<{ question: string; response: string }>
      };

      fullTranscriptRef.current += `\n\nQ${currentIndex + 1}: ${currentQuestion.question}\n`;

      setPhase("speaking");
      await speak(currentQuestion.question);

      if (!isRunningRef.current) return;

      setPhase("listening");
      stopRecognition();
      const recognition = startRecognition();
      if (!recognition) return;

      const maxResponseTime = (currentQuestion.maxResponseTime || 120) * 1000;
      const transcriptPromise = waitForTranscript();
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve(transcriptRef.current.trim()), maxResponseTime);
      });

      const transcript = await Promise.race([transcriptPromise, timeoutPromise]);

      if (!transcript.trim()) {
        // Store empty response
        currentQA.response = "[No response provided]";
        interviewDataRef.current.push(currentQA);
        const sid = sessionIdRef.current;
        if (sid) {
          // non-blocking append (best-effort)
          appendResponseToSession(sid, currentQA).catch((e) => console.warn("append failed", e));
        }

        nextQuestion();
        return;
      }

      // Record main response
      currentQA.response = transcript;
      recordResponse(transcript);
      fullTranscriptRef.current += `A: ${transcript}\n`;

      if (!isRunningRef.current) return;

      setPhase("evaluating");
      const decision = await askLLM(transcript);

      if (!isRunningRef.current) return;

      if (decision.action === "follow_up") {
        setPhase("speaking");
        await speak(decision.message);

        if (!isRunningRef.current) return;

        setPhase("listening");
        transcriptRef.current = "";
        setLiveTranscript("");

        stopRecognition();
        const followUpRecognition = startRecognition();
        if (!followUpRecognition) return;

        const followUpTranscript = await waitForTranscript();

        if (followUpTranscript.trim()) {
          currentQA.followUps?.push({
            question: decision.message,
            response: followUpTranscript
          });
          recordResponse(followUpTranscript);
          fullTranscriptRef.current += `Follow-up: ${decision.message}\nA: ${followUpTranscript}\n`;
        }

        const followUpDecision = await askLLM(followUpTranscript);
        await speak(followUpDecision.message);
      } else {
        await speak(decision.message);
      }

      // Store the Q&A data
      interviewDataRef.current.push(currentQA);
      if (sessionId) {
        // non-blocking append (best-effort)
        appendResponseToSession(sessionId, currentQA).catch((e) => console.warn("append failed", e));
      }

      if (!isRunningRef.current) return;

      if (decision.action === "wrap_up" || isLastQuestion) {
        setPhase("wrap_up");
        await speak("Thank you for your time. Let me prepare your interview report...");
        await endInterview();
        return;
      } else {
        nextQuestion();
      }

    } catch (error) {
      console.error("Interview loop error:", error);
      setError(error instanceof Error ? error.message : "Interview error occurred");
      setPhase("idle");
      isRunningRef.current = false;
    } finally {
      runGuardRef.current = false;
    }
  }, [
    currentQuestion,
    currentIndex,
    isLastQuestion,
    speak,
    startRecognition,
    waitForTranscript,
    recordResponse,
    askLLM,
    nextQuestion
  ]);

  useEffect(() => {
    if (isRunningRef.current && currentQuestion && phase !== "wrap_up" && phase !== "completed") {
      const timer = setTimeout(runInterviewLoop, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, runInterviewLoop]);

  /** ---- Interview controls ---- */
  const handleStart = useCallback(async () => {
    if (isRunningRef.current) return;

    try {
      setError("");
      isRunningRef.current = true;
      interviewDataRef.current = []; // Reset interview data

      if (recordingApiRef.current) {
        await recordingApiRef.current.startRecording();
      }

      fullTranscriptRef.current = "AI INTERVIEW TRANSCRIPT\n" + `Started at: ${new Date().toISOString()}\n` + "==================================================";

      // create session in mongo to start tracking
      const id = await createSession({ roomUrl, transcript: fullTranscriptRef.current, responses: [] });
      setSessionId(id);

      await runInterviewLoop();

    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to start interview");
      isRunningRef.current = false;
    }
  }, [runInterviewLoop, roomUrl]);


  const handleStop = useCallback(async () => {
    isRunningRef.current = false;
    stopRecognition();

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (recordingApiRef.current) {
      try {
        await recordingApiRef.current.stopRecording();
      } catch { }
    }

    setPhase("wrap_up");
    setLiveTranscript("");
    transcriptRef.current = "";
    await endInterview();
  }, [stopRecognition]);

  const handlePauseResume = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;

    if (isPausedRef.current) {
      stopRecognition();
      if (window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
    } else {
      if (phase === "listening") {
        startRecognition();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
    }
  }, [phase, startRecognition, stopRecognition]);

  const handleRepeat = useCallback(async () => {
    if (!currentQuestion) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      await speak(currentQuestion.question);
    } catch (error) {
      setError("Failed to repeat question");
    }
  }, [currentQuestion, speak]);

  const handleNext = useCallback(() => {
    if (isRunningRef.current) {
      const currentTranscript = transcriptRef.current || liveTranscript || "";
      if (currentTranscript.trim()) {
        recordResponse(currentTranscript);
        fullTranscriptRef.current += `A: ${currentTranscript}\n`;

        // Store Q&A for current question
        const saved = {
          questionId: currentQuestion?.id || "",
          question: currentQuestion?.question || "",
          response: currentTranscript
        };
        interviewDataRef.current.push(saved);
        const sid = sessionIdRef.current;
        if (sid) {
          appendResponseToSession(sid, saved).catch(e => console.warn("append failed", e));
        }
      }
      nextQuestion();
    }
  }, [liveTranscript, nextQuestion, recordResponse, currentQuestion]);

  const handleManualSubmit = useCallback(() => {
    const finalText = transcriptRef.current || liveTranscript || "";
    if (finalText.trim()) {
      submitTranscript(finalText.trim());
    }
  }, [liveTranscript, submitTranscript]);

  /** ---- End interview and generate score ---- */
  const endInterview = useCallback(async () => {
    try {
      setPhase("completed");
      isRunningRef.current = false;
      setScoringLoading(true);

      if (recordingApiRef.current) {
        await recordingApiRef.current.stopRecording();
      }

      fullTranscriptRef.current += `\n\nInterview completed at: ${new Date().toISOString()}`;

      const sid = sessionIdRef.current;
      if (sid) {
        // finalize & server computes score based on stored data
        const scoringResult = await finalizeAndScoreSession(sid, fullTranscriptRef.current);
        setScoring(scoringResult);
      } else {
        // fallback: call the old /api/score directly with current transcript & responses
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            transcript: fullTranscriptRef.current,
            responses: interviewDataRef.current,
          }),
        });

        if (res.ok) {
          setScoring(await res.json());
        } else {
          setError("Failed to generate score. Please try again.");
        }
      }
    } catch (error) {
      console.error("End interview error:", error);
      setError("Failed to complete interview scoring");
    } finally {
      setScoringLoading(false);
    }
  }, [finalizeAndScoreSession]);



  const closeScoreModal = useCallback(() => {
    setScoring(null);
    // Optionally reset the interview state
    setPhase("idle");
    isRunningRef.current = false;
    isPausedRef.current = false;
    setLiveTranscript("");
    transcriptRef.current = "";
    setSecondsRemaining(undefined);
    setSessionId(null);
    sessionIdRef.current = null;

    // navigate to /home 
    window.location.href = "/";

  }, []);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [stopRecognition]);

  /** ---- Render ---- */
  if (loading) return <div className="p-6">Creating interview room...</div>;
  if (error && !roomUrl) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!roomUrl) return <div className="p-6">Failed to create room.</div>;

  return (
    <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="top-0 left-1/4 absolute bg-blue-500/5 blur-3xl rounded-full w-96 h-96"></div>
        <div className="right-1/4 bottom-0 absolute bg-purple-500/5 blur-3xl rounded-full w-96 h-96"></div>
      </div>

      <VideoCall
        roomUrl={roomUrl}
        onReady={(api) => (recordingApiRef.current = api)}
      />

      <div className="z-10 relative mx-auto px-4 py-6 container">
        <StatusBar
          phase={phase}
          secondsRemaining={secondsRemaining}
          questionIndex={currentIndex}
          totalQuestions={totalQuestions}
        />

        <div className="gap-6 grid lg:grid-cols-3 mt-6">
          <div className="space-y-6 lg:col-span-2">
            {/* Question Card */}
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 shadow-2xl backdrop-blur-xl p-8 border border-slate-700/50 rounded-2xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex justify-center items-center bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg rounded-xl w-10 h-10 font-bold text-white">
                    {currentIndex + 1}
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Current Question</p>
                    <p className="text-gray-500 text-xs">
                      {currentIndex + 1} of {totalQuestions}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1">
                  {[...Array(totalQuestions)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-8 rounded-full transition-all duration-300 ${i < currentIndex
                        ? 'bg-green-500'
                        : i === currentIndex
                          ? 'bg-blue-500 animate-pulse'
                          : 'bg-slate-700'
                        }`}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                <h2 className="mb-2 font-semibold text-white text-2xl leading-relaxed">
                  {currentQuestion?.question || "Preparing next question..."}
                </h2>
                <p className="mt-4 text-gray-400 text-sm">
                  Take your time to provide a thoughtful response
                </p>
              </div>
            </div>

            {/* Transcript Box */}
            <TranscriptBox text={liveTranscript} listening={listening} />
          </div>

          <div className="space-y-6">
            {/* Recording Status */}
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl p-6 border border-slate-700/50 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${phase === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
                  }`}></div>
                <span className="font-medium text-gray-300 text-sm">
                  {phase === 'listening' ? 'Recording Active' : 'Recording Paused'}
                </span>
              </div>

              <div className="flex justify-center items-center gap-1 h-16">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full transition-all duration-150 ${listening ? 'animate-pulse' : ''
                      }`}
                    style={{
                      height: listening ? `${Math.random() * 100}%` : '20%',
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Controls */}
            <InterviewControls
              onStart={handleStart}
              onStop={handleStop}
              onPauseResume={handlePauseResume}
              onRepeat={handleRepeat}
              onNext={handleNext}
              onAnswer={() => startRecognition()}
              onSubmit={handleManualSubmit}
              disabled={phase === "speaking" || phase === "evaluating"}
              isPaused={isPausedRef.current}
              isListening={listening}
              isRunning={isRunningRef.current}
              phase={phase}
            />

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 backdrop-blur-xl p-6 border border-blue-700/30 rounded-2xl">
              <h3 className="mb-3 font-semibold text-blue-300 text-sm">Interview Tips</h3>
              <ul className="space-y-2 text-gray-400 text-xs">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-400">•</span>
                  <span>Speak clearly and at a moderate pace</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-400">•</span>
                  <span>Take a moment to think before answering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-400">•</span>
                  <span>Use specific examples when possible</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-900/20 backdrop-blur-xl mt-4 p-4 border border-red-700/30 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Results Modal */}
        {(scoring || scoringLoading) && (
          <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl p-8 border border-slate-700/50 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {scoringLoading ? (
                <div className="flex flex-col justify-center items-center py-12">
                  <div className="border-4 border-t-blue-500 border-blue-500/30 rounded-full w-16 h-16 animate-spin"></div>
                  <p className="mt-4 text-gray-400">Analyzing your interview performance...</p>
                </div>
              ) : scoring ? (
                <>
                  <div className="mb-8 text-center">
                    <div className="inline-flex justify-center items-center bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg mb-4 rounded-2xl w-16 h-16">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="mb-2 font-bold text-white text-3xl">Interview Complete!</h2>
                    <p className="text-gray-400">Here&apos;s your detailed performance report</p>
                  </div>

                  <div className="space-y-6">
                    {/* Overall Score */}
                    <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                      <p className="mb-3 text-gray-400 text-sm">Overall Performance</p>
                      <div className="flex items-center gap-4">
                        <span className="bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-bold text-transparent text-5xl">
                          {scoring.overallScore?.toFixed(1) || "0.0"}/10
                        </span>
                        <div className="flex-1">
                          <div className="bg-slate-700/50 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full h-full transition-all duration-1000"
                              style={{ width: `${((scoring.overallScore || 0) / 10) * 100}%` }}
                            />
                          </div>
                          <p className="mt-2 text-gray-400 text-xs">
                            Decision:
                            <span className={`ml-2 font-semibold ${scoring.decision === 'hire' ? 'text-green-400' :
                              scoring.decision === 'maybe' ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                              {scoring.decision === 'hire' ? 'RECOMMENDED FOR HIRE' :
                                scoring.decision === 'maybe' ? 'POTENTIAL CANDIDATE' :
                                  'NOT RECOMMENDED'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Category Scores */}
                    {scoring.categoryScores && (
                      <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                        <p className="mb-4 text-gray-400 text-sm">Performance by Category</p>
                        <div className="space-y-3">
                          {Object.entries(scoring.categoryScores).map(([category, score]) => (
                            <div key={category} className="flex items-center gap-3">
                              <span className="w-32 text-gray-300 text-sm capitalize">
                                {category.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <div className="flex-1 bg-slate-700/50 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${score >= 7 ? 'bg-green-500' :
                                    score >= 5
                                      ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                  style={{ width: `${(score / 10) * 100}%` }}
                                />
                              </div>
                              <span className="w-8 text-gray-300 text-sm text-right">{score.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    {scoring.summary && (
                      <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                        <p className="mb-3 text-gray-400 text-sm">Overall Summary</p>
                        <p className="text-gray-200 leading-relaxed">{scoring.summary}</p>
                      </div>
                    )}

                    {/* Recommendations */}
                    {scoring.recommendations && scoring.recommendations.length > 0 && (
                      <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                        <p className="mb-3 text-gray-400 text-sm">Recommendations for Improvement</p>
                        <ul className="space-y-2 pl-5 text-gray-200 leading-relaxed list-disc">
                          {scoring.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Question-by-Question Feedback */}
                    {scoring.questionScores && scoring.questionScores.length > 0 && (
                      <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                        <p className="mb-4 text-gray-400 text-sm">Question-by-Question Feedback</p>
                        <div className="space-y-6">
                          {scoring.questionScores.map((qs, index) => (
                            <div key={index} className="bg-slate-900/50 p-4 border border-slate-700/50 rounded-lg">
                              <p className="font-semibold text-gray-300">Question {index + 1}</p>
                              <p className="mt-2 text-gray-200">{qs.feedback}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-red-400 text-center">Failed to load scoring results.</p>
              )}
              <div className="flex justify-center mt-8">
                <button
                  onClick={closeScoreModal}
                  className="bg-slate-700/50 hover:bg-slate-700/70 px-6 py-3 border border-slate-600/50 rounded-xl font-semibold text-gray-300 transition-all duration-300"
                >
                  Close
                </button>

              </div>
            </div>
          </div>
        )
        }

      </div>
    </div>
  );
}