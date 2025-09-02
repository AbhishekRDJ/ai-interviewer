"use client";

type Props = {
  phase: "idle" | "speaking" | "listening" | "evaluating" | "transition";
  secondsRemaining?: number;
  questionIndex: number;
  totalQuestions: number;
};

export default function StatusBar({ phase, secondsRemaining, questionIndex, totalQuestions }: Props) {
  const phaseLabel = {
    idle: "Ready",
    speaking: "Interviewer speaking…",
    listening: "Listening…",
    evaluating: "Evaluating…",
    transition: "Next question…",
  }[phase];

  return (
    <div className="flex items-center justify-between border rounded p-2 text-sm bg-white/60 dark:bg-black/20">
      <div className="font-medium">{phaseLabel}</div>
      <div className="flex items-center gap-4">
        {typeof secondsRemaining === "number" && (
          <div className="tabular-nums">Time left: {Math.max(0, secondsRemaining)}s</div>
        )}
        <div>Q{questionIndex + 1}/{totalQuestions}</div>
      </div>
    </div>
  );
}


