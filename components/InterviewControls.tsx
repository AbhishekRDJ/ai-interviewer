"use client";

type Props = {
  onStart?: () => void;
  onStop?: () => void;
  onPauseResume?: () => void;
  onRepeat?: () => void;
  onNext?: () => void;
  onAnswer?: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
  isPaused?: boolean;
  isListening?: boolean;
};

export default function InterviewControls({ onStart, onStop, onPauseResume, onRepeat, onNext, onAnswer, onSubmit, disabled, isPaused, isListening }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onStart}
        disabled={disabled}
        className="bg-black dark:bg-white disabled:opacity-50 px-4 py-2 rounded text-white dark:text-black"
      >
        Start
      </button>
      <button
        onClick={onStop}
        className="px-4 py-2 border rounded"
      >
        Stop
      </button>
      <button
        onClick={onAnswer}
        className="px-4 py-2 border rounded"
        disabled={isListening}
      >
        Answer
      </button>
      <button
        onClick={onSubmit}
        className="px-4 py-2 border rounded"
        disabled={!isListening}
      >
        Submit
      </button>
      <button
        onClick={onPauseResume}
        className="px-4 py-2 border rounded"
      >
        {isPaused ? "Resume" : "Pause"}
      </button>
      <button
        onClick={onRepeat}
        className="px-4 py-2 border rounded"
      >
        Repeat
      </button>
      <button
        onClick={onNext}
        className="px-4 py-2 border rounded"
      >
        Next
      </button>
    </div>
  );
}


