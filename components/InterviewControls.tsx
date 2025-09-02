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
  isRunning?: boolean;
  phase?: "idle" | "speaking" | "listening" | "evaluating" | "wrap_up" | "completed";
};

export default function InterviewControls({
  onStart,
  onStop,
  onPauseResume,
  onRepeat,
  onNext,
  onAnswer,
  onSubmit,
  disabled,
  isPaused,
  isListening,
  isRunning,
  phase
}: Props) {
  const mainButtons = [
    {
      action: onStart,
      label: "Start Interview",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      condition: !isRunning && phase === "idle",
      primary: true
    },
    {
      action: onAnswer,
      label: isListening ? "Recording..." : "Answer Question",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
      condition: isRunning && phase === "listening",
      primary: true,
      pulse: isListening
    },
    {
      action: onStop,
      label: "End Interview",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      ),
      condition: isRunning && phase !== "completed",
      danger: true
    },
    {
      action: onSubmit,
      label: "Submit Answer",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      condition: isRunning && phase === "listening" && !isListening,
      primary: true
    }
  ];

  const secondaryButtons = [
    {
      action: onPauseResume,
      label: isPaused ? "Resume" : "Pause",
      icon: isPaused ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      condition: isRunning && phase !== "completed"
    },
    {
      action: onRepeat,
      label: "Repeat",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      condition: isRunning && phase === "listening"
    },
    {
      action: onNext,
      label: "Next",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      ),
      condition: isRunning && phase === "listening"
    }
  ];

  const visibleMainButtons = mainButtons.filter(btn => btn.condition);
  const visibleSecondaryButtons = secondaryButtons.filter(btn => btn.condition);

  return (
    <div className="space-y-4 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl p-6 border border-slate-700/50 rounded-2xl">
      {/* Main action buttons */}
      <div className="space-y-3">
        {visibleMainButtons.map((btn, idx) => (
          <button
            key={idx}
            onClick={btn.action}
            disabled={disabled}
            className={`
              w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold
              transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              ${btn.primary ?
                'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:from-blue-500 hover:to-cyan-500' :
                btn.danger ?
                  'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' :
                  'bg-slate-700/50 text-gray-300 border border-slate-600/50 hover:bg-slate-700/70'
              }
              ${btn.pulse ? 'animate-pulse' : ''}
            `}
          >
            {btn.icon}
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Secondary action buttons */}
      {visibleSecondaryButtons.length > 0 && (
        <div className="flex gap-2 pt-2 border-slate-700/50 border-t">
          {visibleSecondaryButtons.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              disabled={disabled}
              className="flex flex-1 justify-center items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 px-4 py-2.5 border border-slate-700/30 rounded-lg font-medium text-gray-400 hover:text-gray-300 text-sm transition-all duration-300 disabled:cursor-not-allowed"
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Voice indicator */}
      {isListening && (
        <div className="flex justify-center items-center gap-2 pt-3">
          <div className="flex gap-1">
            <span className="bg-red-500 rounded-full w-1 h-4 animate-pulse"></span>
            <span className="bg-red-500 rounded-full w-1 h-6 animate-pulse delay-75"></span>
            <span className="bg-red-500 rounded-full w-1 h-3 animate-pulse delay-150"></span>
            <span className="bg-red-500 rounded-full w-1 h-5 animate-pulse delay-200"></span>
          </div>
          <span className="font-medium text-red-400 text-xs">Recording Active</span>
        </div>
      )}
    </div>
  );
}