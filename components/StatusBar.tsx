"use client";

import { Clock, Mic, Volume2, Brain, ArrowRight, CheckCircle, Circle } from "lucide-react";
import { useMemo } from "react";

type Props = {
  phase: "idle" | "speaking" | "listening" | "evaluating" | "transition" | "wrap_up" | "completed";
  secondsRemaining?: number;
  questionIndex: number;
  totalQuestions: number;
};

export default function StatusBar({
  phase,
  secondsRemaining,
  questionIndex,
  totalQuestions
}: Props) {
  const phaseConfig = useMemo(() => ({
    idle: {
      label: "Ready to begin",
      icon: Circle,
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-800/50"
    },
    speaking: {
      label: "Interviewer speaking",
      icon: Volume2,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/30"
    },
    listening: {
      label: "Your turn to speak",
      icon: Mic,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/30"
    },
    evaluating: {
      label: "Processing response",
      icon: Brain,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/30"
    },
    transition: {
      label: "Preparing next question",
      icon: ArrowRight,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/30"
    },
    wrap_up: {
      label: "Finalizing interview",
      icon: CheckCircle,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/30"
    },
    completed: {
      label: "Interview completed",
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/30"
    },
  }), []);

  const config = phaseConfig[phase];
  const IconComponent = config.icon;
  const progress = ((questionIndex) / totalQuestions) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const isUrgent = typeof secondsRemaining === 'number' && secondsRemaining <= 30;

  return (
    <div className={`
      relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 
      ${config.bgColor} transition-all duration-300 shadow-sm
    `}>
      {/* Progress bar */}
      <div className="top-0 left-0 absolute bg-gray-200 dark:bg-gray-700 w-full h-1">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between items-center p-3 pt-4">
        <div className="flex items-center gap-2">
          <IconComponent
            className={`w-4 h-4 ${config.color} ${phase === 'listening' || phase === 'speaking' ? 'animate-pulse' : ''
              }`}
          />
          <span className={`font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {typeof secondsRemaining === 'number' && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono
              ${isUrgent
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 animate-pulse'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }
            `}>
              <Clock className="w-3 h-3" />
              {formatTime(Math.max(0, secondsRemaining))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-xs">Question</span>
            <span className="bg-white dark:bg-gray-800 px-2 py-1 border rounded-full font-semibold text-sm">
              {questionIndex + 1} / {totalQuestions}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}