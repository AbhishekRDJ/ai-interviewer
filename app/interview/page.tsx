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
    <div className="gap-4 grid mx-auto p-4 max-w-4xl">
      <VideoCall
        roomUrl={roomUrl}
        onReady={(api) => (recordingApiRef.current = api)}
      />

      <div className="gap-3 grid">
        <StatusBar
          phase={phase}
          secondsRemaining={secondsRemaining}
          questionIndex={currentIndex}
          totalQuestions={totalQuestions}
        />

        <div className="bg-blue-50 dark:bg-blue-950 p-3 border rounded">
          <div className="mb-2 font-medium text-blue-800 dark:text-blue-200 text-sm">
            Question {currentIndex + 1} of {totalQuestions}:
          </div>
          <div className="text-blue-900 dark:text-blue-100">
            {currentQuestion?.question}
          </div>
        </div>

        <TranscriptBox text={liveTranscript} listening={listening} />

        {scoring && (
          <div className="bg-green-50 dark:bg-green-950 p-4 border rounded">
            <div className="mb-3 font-semibold text-green-800 dark:text-green-200">
              Interview Results
            </div>
            <div className="space-y-2 text-sm">
              {scoring.overallScore && (
                <div>
                  <span className="font-medium">Overall Score:</span> {scoring.overallScore}/10
                </div>
              )}
              {scoring.summary && (
                <div>
                  <span className="font-medium">Summary:</span> {scoring.summary}
                </div>
              )}
              {scoring.recommendations && (
                <div>
                  <span className="font-medium">Recommendations:</span> {scoring.recommendations}
                </div>
              )}
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}