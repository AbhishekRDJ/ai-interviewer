"use client";

type Props = { text: string };

export default function TranscriptBox({ text }: Props) {
  return (
    <div className="w-full p-3 border rounded bg-white/50 dark:bg-black/20 min-h-24 text-sm">
      {text || "Transcript will appear here…"}
    </div>
  );
}


