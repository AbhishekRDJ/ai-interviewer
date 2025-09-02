"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import TranscriptBox from "@/components/TranscriptBox";
import StatusBar from "@/components/StatusBar";
import InterviewControls from "@/components/InterviewControls";
import { useInterviewState } from "@/lib/hooks/useInterviewState";

const VideoCall = dynamic(() => import("@/components/VideoCall"), { ssr: false });

type Phase = "idle" | "speaking" | "listening" | "evaluating" | "wrap_up";

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
  } = useInterviewState();

  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const transcriptRef = useRef<string>("");
  const recognitionRef = useRef<any>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsRemaining, setSecondsRemaining] = useState<number | undefined>();

  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  // resolves when transcript submitted
  const transcriptResolverRef = useRef<(val: string) => void>();

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

  /** ---- TTS ---- */
  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1;
        utter.pitch = 1;
        synth.cancel();
        synth.speak(utter);
        utter.onend = () => resolve();
        utter.onerror = () => reject(new Error("TTS error"));
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
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else setLiveTranscript(result[0].transcript);
      }
      if (finalText) {
        setLiveTranscript((prev) => (prev ? prev + " " : "") + finalText);
        transcriptRef.current =
          (transcriptRef.current ? transcriptRef.current + " " : "") + finalText;
      }
    };

    recognition.onerror = (e: any) => {
      setError(`Speech recognition error: ${e.error || "unknown"}`);
      setListening(false);
    };

    recognition.onend = () => {
      if (phase === "listening" && isRunningRef.current && !isPausedRef.current) {
        recognition.start(); // auto-restart if still listening
      } else {
        setListening(false);
      }
    };

    recognition.start();
    setListening(true);
    recognitionRef.current = recognition;
    return recognition;
  }, [phase]);

  const stopRecognition = useCallback(() => {
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch { }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  /** ---- Wait for transcript ---- */
  const waitForTranscript = useCallback(() => {
    return new Promise<string>((resolve) => {
      transcriptResolverRef.current = resolve;
    });
  }, []);

  const submitTranscript = useCallback(
    (text: string) => {
      if (transcriptResolverRef.current) {
        transcriptResolverRef.current(text);
        transcriptResolverRef.current = undefined;
      }
    },
    []
  );

  /** ---- Ask Gemini ---- */
  const askGemini = useCallback(
    async (transcript: string) => {
      const payload = {
        transcript,
        state: {
          currentQuestion: currentQuestion?.question || "",
          timeElapsedSec,
          questionsRemaining: Math.max(0, totalQuestions - currentIndex - 1),
        },
      };
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        responseQuality: string;
        action: "follow_up" | "next" | "wrap_up";
        message: string;
      };
    },
    [currentQuestion?.question, timeElapsedSec, totalQuestions, currentIndex]
  );

  /** ---- Main loop ---- */
  const runLoop = useCallback(async () => {
    if (!currentQuestion) return;
    isRunningRef.current = true;
    transcriptRef.current = "";
    setLiveTranscript("");

    setPhase("speaking");
    await speak(currentQuestion.question).catch(() => { });

    setPhase("listening");
    startRecognition();
    const transcript = await waitForTranscript();
    stopRecognition();
    if (transcript) recordResponse(transcript);

    try {
      setPhase("evaluating");
      const decision = await askGemini(transcript);

      if (decision.action === "follow_up") {
        setPhase("speaking");
        await speak(decision.message).catch(() => { });
        setPhase("listening");
        transcriptRef.current = "";
        setLiveTranscript("");
        startRecognition();
        const followUp = await waitForTranscript();
        stopRecognition();
        if (followUp) recordResponse(followUp);
        nextQuestion();
      } else if (decision.action === "next") {
        await speak(decision.message).catch(() => { });
        nextQuestion();
      } else {
        await speak(decision.message).catch(() => { });
        setPhase("wrap_up");
        isRunningRef.current = false;
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "LLM error");
    }

    if (isRunningRef.current) {
      setTimeout(() => runLoop(), 500);
    }
  }, [askGemini, currentQuestion, nextQuestion, recordResponse, speak, startRecognition, stopRecognition, waitForTranscript]);

  /** ---- Controls ---- */
  const handleStart = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    runLoop();
  }, [runLoop]);

  const handleStop = useCallback(() => {
    isRunningRef.current = false;
    stopRecognition();
    window.speechSynthesis.cancel();
    setPhase("idle");
  }, [stopRecognition]);

  const handlePauseResume = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    if (isPausedRef.current) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  const handleRepeat = useCallback(() => {
    if (!currentQuestion) return;
    window.speechSynthesis.cancel();
    speak(currentQuestion.question);
  }, [currentQuestion, speak]);

  const handleNext = useCallback(() => {
    nextQuestion();
  }, [nextQuestion]);

  const handleAnswer = useCallback(() => {
    setLiveTranscript("");
    transcriptRef.current = "";
    startRecognition();

    const maxSec = currentQuestion?.maxResponseTime ?? 90;
    setSecondsRemaining(maxSec);
  }, [currentQuestion?.maxResponseTime, startRecognition]);

  const handleSubmit = useCallback(() => {
    stopRecognition();
    const finalText = transcriptRef.current || liveTranscript || "";
    submitTranscript(finalText);
    setSecondsRemaining(undefined);
  }, [liveTranscript, stopRecognition, submitTranscript]);

  /** ---- Countdown timer ---- */
  useEffect(() => {
    if (!secondsRemaining) return;
    const id = setInterval(() => {
      setSecondsRemaining((s) => {
        if (!s) return s;
        if (s <= 1) {
          clearInterval(id);
          handleSubmit();
          return undefined;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsRemaining, handleSubmit]);

  /** ---- Render ---- */
  if (loading) return <div className="p-6">Creating room…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!roomUrl) return <div className="p-6">No room URL returned.</div>;

  return (
    <div className="gap-4 grid p-4">
      <VideoCall roomUrl={roomUrl} />

      <div className="gap-3 grid">
        <StatusBar
          phase={phase}
          secondsRemaining={secondsRemaining}
          questionIndex={currentIndex}
          totalQuestions={totalQuestions}
        />
        <div className="text-sm">
          <span className="font-medium">
            Question {currentIndex + 1} of {totalQuestions}:
          </span>{" "}
          {currentQuestion?.question}
        </div>
        <TranscriptBox text={liveTranscript} />
        <InterviewControls
          onStart={handleStart}
          onStop={handleStop}
          onPauseResume={handlePauseResume}
          onRepeat={handleRepeat}
          onNext={handleNext}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          disabled={listening}
          isPaused={isPausedRef.current}
          isListening={listening}
        />
      </div>
    </div>
  );
}
