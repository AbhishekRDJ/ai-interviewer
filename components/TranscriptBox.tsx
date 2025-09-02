"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Copy, Volume2, VolumeX } from "lucide-react";

type Props = {
  text: string;
  listening?: boolean;
  speaker?: "user" | "interviewer";
  onCopy?: () => void;
  showSpeaker?: boolean;
};

export default function TranscriptBox({
  text,
  listening = false,
  speaker = "user",
  onCopy,
  showSpeaker = false
}: Props) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Auto-scroll to bottom when text updates
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;

      // Check if content is overflowing
      const element = textRef.current;
      setIsOverflowing(element.scrollHeight > element.clientHeight);
    }
  }, [text]);

  const handleCopy = async () => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const isEmpty = !text;
  const displayText = text || (listening ? "" : "");

  return (
    <div className="group relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {showSpeaker && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${speaker === "user"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }
            `}>
              {speaker === "user" ? (
                <Mic className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
              {speaker === "user" ? "You" : "Interviewer"}
            </div>
          )}

          {listening && (
            <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full text-green-700 dark:text-green-300 text-xs">
              <div className="bg-green-500 rounded-full w-2 h-2 animate-pulse" />
              Listening...
            </div>
          )}
        </div>

        {/* Action buttons */}
        {text && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-md transition-colors"
              title="Copy transcript"
            >
              <Copy className={`w-3 h-3 ${copied ? 'text-green-600' : 'text-gray-500'}`} />
            </button>
          </div>
        )}
      </div>

      {/* Transcript content */}
      <div className={`
        relative w-full border border-gray-200 dark:border-gray-700 rounded-lg
        ${isEmpty
          ? 'bg-gray-50/50 dark:bg-gray-800/20'
          : 'bg-white dark:bg-gray-900/50'
        }
        transition-all duration-200
        ${listening ? 'border-green-300 dark:border-green-600 shadow-sm' : ''}
      `}>
        <div
          ref={textRef}
          className={`
            p-4 min-h-24 max-h-48 overflow-y-auto text-sm leading-relaxed
            ${isEmpty ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}
            ${listening ? 'animate-pulse' : ''}
          `}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(156 163 175) transparent'
          }}
        >
          {isEmpty ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                {listening ? (
                  <>
                    <Mic className="mx-auto mb-2 w-6 h-6 text-green-500 animate-pulse" />
                    <p>Listening for your response...</p>
                  </>
                ) : (
                  <>
                    <VolumeX className="mx-auto mb-2 w-6 h-6 text-gray-400" />
                    <p>Transcript will appear here...</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="break-words whitespace-pre-wrap">
              {displayText}
            </div>
          )}
        </div>

        {/* Overflow indicator */}
        {isOverflowing && (
          <div className="right-2 bottom-2 absolute bg-white dark:bg-gray-900 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-full text-gray-400 text-xs">
            ↓ Scroll
          </div>
        )}

        {/* Visual feedback overlay */}
        {listening && (
          <div className="absolute inset-0 opacity-50 border-2 border-green-300 dark:border-green-600 rounded-lg animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Copy feedback */}
      {copied && (
        <div className="top-0 right-0 absolute bg-green-600 -mt-8 mr-2 px-2 py-1 rounded-md text-white text-xs">
          Copied!
        </div>
      )}
    </div>
  );
}