"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import TranscriptBox from "@/components/TranscriptBox";
import StatusBar from "@/components/StatusBar";
import InterviewControls from "@/components/InterviewControls";
import { useInterviewState } from "@/lib/hooks/useInterviewState";

const VideoCall = dynamic(() => import("@/components/VideoCall"), { ssr: false });

type Phase = "idle" | "speaking" | "listening" | "evaluating" | "wrap_up" | "completed";

export default function InterviewPage() {
  const [roomUrl, setRoomUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

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
  const [scoring, setScoring] = useState<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  /** ---- Improved TTS with better error handling ---- */
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!window.speechSynthesis) {
          reject(new Error("Speech synthesis not supported"));
          return;
        }

        const synth = window.speechSynthesis;

        // Cancel any ongoing speech
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1;
        utterance.volume = 1;

        // Guard against double resolve/reject
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
        // Store resolver for external timeout cleanup
        ttsResolverRef.current = resolveOnce;

        utterance.onend = () => {
          resolveOnce();
        };

        utterance.onerror = (event) => {
          const errName = String((event as any)?.error || "unknown");
          // Treat user/cancel interruptions as non-fatal and continue
          if (errName === "interrupted" || errName === "canceled" || errName === "service-not-allowed") {
            resolveOnce();
            return;
          }
          rejectOnce(new Error(`TTS error: ${errName}`));
        };

        // Ensure voices are loaded
        if (synth.getVoices().length === 0) {
          synth.onvoiceschanged = () => {
            synth.speak(utterance);
          };
        } else {
          synth.speak(utterance);
        }

        // Timeout fallback to avoid stuck TTS
        setTimeout(() => {
          if (!settled && ttsResolverRef.current) {
            resolveOnce();
          }
        }, Math.min(12000, Math.max(2000, text.length * 60))); // bounded estimate

      } catch (err) {
        reject(err);
      }
    });
  }, []);

  /** ---- Improved Speech Recognition ---- */
  const startRecognition = useCallback(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Web Speech API not supported in this browser.");
      return null;
    }

    // Stop any existing recognition
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

      // Update live transcript with final + interim
      setLiveTranscript(finalTranscript + interimTranscript);

      // Reset silence timer on any speech activity
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Start new silence timer
      silenceTimerRef.current = setTimeout(() => {
        if (phase === "listening" && isRunningRef.current && !isPausedRef.current) {
          submitTranscript(transcriptRef.current.trim());
        }
      }, 3000); // 3 seconds of silence
    };

    recognition.onerror = (event: any) => {
      const errName = String(event?.error || "");
      console.warn("Speech recognition error:", errName);
      // Ignore benign programmatic stops and no-speech blips
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

  /** ---- Transcript handling ---- */
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
    if (runGuardRef.current) return; // prevent re-entrancy
    runGuardRef.current = true;

    try {
      // Reset transcript for new question
      transcriptRef.current = "";
      setLiveTranscript("");

      // Add question to full transcript
      fullTranscriptRef.current += `\n\nQ${currentIndex + 1}: ${currentQuestion.question}\n`;

      // AI speaks the question
      setPhase("speaking");
      await speak(currentQuestion.question);

      if (!isRunningRef.current) return; // Check if stopped during speaking

      // Listen for candidate response
      setPhase("listening");
      // Ensure any previous recognition is fully stopped before starting
      stopRecognition();
      const recognition = startRecognition();
      if (!recognition) return;

      // Wait for transcript or timeout
      const maxResponseTime = (currentQuestion.maxResponseTime || 120) * 1000;
      const transcriptPromise = waitForTranscript();
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve(transcriptRef.current.trim()), maxResponseTime);
      });

      const transcript = await Promise.race([transcriptPromise, timeoutPromise]);

      if (!transcript.trim()) {
        // Gracefully move on without speaking again to avoid TTS overlap
        nextQuestion();
        return;
      }

      // Record the response
      recordResponse(transcript);
      fullTranscriptRef.current += `A: ${transcript}\n`;

      if (!isRunningRef.current) return;

      // Evaluate response with LLM
      setPhase("evaluating");
      const decision = await askLLM(transcript);

      if (!isRunningRef.current) return;

      if (decision.action === "follow_up") {
        // Ask follow-up question
        setPhase("speaking");
        await speak(decision.message);

        if (!isRunningRef.current) return;

        // Listen for follow-up response
        setPhase("listening");
        transcriptRef.current = "";
        setLiveTranscript("");

        // Ensure previous recognition is stopped
        stopRecognition();
        const followUpRecognition = startRecognition();
        if (!followUpRecognition) return;

        const followUpTranscript = await waitForTranscript();

        if (followUpTranscript.trim()) {
          recordResponse(followUpTranscript);
          fullTranscriptRef.current += `Follow-up: ${decision.message}\nA: ${followUpTranscript}\n`;
        }

        // Evaluate follow-up and move on
        const followUpDecision = await askLLM(followUpTranscript);
        await speak(followUpDecision.message);

      } else {
        // Acknowledge response
        await speak(decision.message);
      }

      if (!isRunningRef.current) return;

      // Move to next question or wrap up
      if (decision.action === "wrap_up" || isLastQuestion) {
        setPhase("wrap_up");
        await speak("Thank you for your time. The interview is now complete.");
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

  /** ---- Effect to run interview loop when question changes ---- */
  useEffect(() => {
    if (isRunningRef.current && currentQuestion && phase !== "wrap_up" && phase !== "completed") {
      // Small delay to ensure state is settled
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

      // Start recording
      if (recordingApiRef.current) {
        await recordingApiRef.current.startRecording();
      }

      // Initialize full transcript
      fullTranscriptRef.current = "AI INTERVIEW TRANSCRIPT\n" +
        `Started at: ${new Date().toISOString()}\n` +
        "==================================================";

      // Start the interview loop
      await runInterviewLoop();

    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to start interview");
      isRunningRef.current = false;
    }
  }, [runInterviewLoop]);

  const handleStop = useCallback(async () => {
    isRunningRef.current = false;
    stopRecognition();

    // Cancel any ongoing TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Stop recording
    if (recordingApiRef.current) {
      try {
        await recordingApiRef.current.stopRecording();
      } catch { }
    }

    setPhase("idle");
    setLiveTranscript("");
    transcriptRef.current = "";
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
      // Submit current transcript and move to next question
      const currentTranscript = transcriptRef.current || liveTranscript || "";
      if (currentTranscript.trim()) {
        recordResponse(currentTranscript);
        fullTranscriptRef.current += `A: ${currentTranscript}\n`;
      }
      nextQuestion();
    }
  }, [liveTranscript, nextQuestion, recordResponse]);

  const handleManualSubmit = useCallback(() => {
    const finalText = transcriptRef.current || liveTranscript || "";
    if (finalText.trim()) {
      submitTranscript(finalText.trim());
    }
  }, [liveTranscript, submitTranscript]);

  /** ---- End interview ---- */
  const endInterview = useCallback(async () => {
    try {
      setPhase("completed");
      isRunningRef.current = false;

      // Stop recording
      if (recordingApiRef.current) {
        await recordingApiRef.current.stopRecording();
      }

      // Add completion timestamp
      fullTranscriptRef.current += `\n\nInterview completed at: ${new Date().toISOString()}`;

      // Get scoring
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: fullTranscriptRef.current,
          responses: responses
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScoring(data);
      } else {
        console.error("Scoring failed:", await res.text());
      }

    } catch (error) {
      console.error("End interview error:", error);
    }
  }, [responses]);

  /** ---- Cleanup on unmount ---- */
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
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!roomUrl) return <div className="p-6">Failed to create room.</div>;

  return (
    <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 min-h-screen">
      {/* Background decoration */}
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
          {/* Main content area */}
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

                {/* Progress indicator */}
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
                  {currentQuestion?.question}
                </h2>
                <p className="mt-4 text-gray-400 text-sm">
                  Take your time to provide a thoughtful response
                </p>
              </div>
            </div>

            {/* Transcript Box */}
            <TranscriptBox text={liveTranscript} listening={listening} />
          </div>

          {/* Sidebar */}
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

              {/* Audio visualization placeholder */}
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

        {/* Results Modal */}
        {scoring && (
          <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl p-8 border border-slate-700/50 rounded-3xl w-full max-w-2xl">
              <div className="mb-8 text-center">
                <div className="inline-flex justify-center items-center bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg mb-4 rounded-2xl w-16 h-16">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="mb-2 font-bold text-white text-3xl">Interview Complete!</h2>
                <p className="text-gray-400">Here are your results</p>
              </div>

              <div className="space-y-6">
                {scoring.overallScore && (
                  <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                    <p className="mb-2 text-gray-400 text-sm">Overall Score</p>
                    <div className="flex items-center gap-4">
                      <span className="bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-bold text-transparent text-4xl">
                        {scoring.overallScore}/10
                      </span>
                      <div className="flex-1 bg-slate-700/50 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full h-full transition-all duration-1000"
                          style={{ width: `${(scoring.overallScore / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {scoring.summary && (
                  <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                    <p className="mb-3 text-gray-400 text-sm">Summary</p>
                    <p className="text-gray-200 leading-relaxed">{scoring.summary}</p>
                  </div>
                )}

                {scoring.recommendations && (
                  <div className="bg-slate-800/50 p-6 border border-slate-700/30 rounded-xl">
                    <p className="mb-3 text-gray-400 text-sm">Recommendations</p>
                    <p className="text-gray-200 leading-relaxed">{scoring.recommendations}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-8">
                <button className="flex-1 bg-gradient-to-r from-blue-600 hover:from-blue-500 to-cyan-600 hover:to-cyan-500 shadow-lg px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300">
                  View Detailed Report
                </button>
                <button className="bg-slate-700/50 hover:bg-slate-700/70 px-6 py-3 border border-slate-600/50 rounded-xl font-semibold text-gray-300 transition-all duration-300">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}