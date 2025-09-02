"use client";

import { useEffect, useRef, useState } from "react";
// Daily types are ESM; import type via typeof to avoid value/type confusion
import type * as DailyNS from "@daily-co/daily-js";

type Props = { roomUrl: string; onReady?: (api: { startRecording: () => Promise<void>; stopRecording: () => Promise<void> }) => void };

export default function VideoCall({ roomUrl, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [joined, setJoined] = useState(false);
  const callRef = useRef<DailyNS.DailyCall | null>(null);

  useEffect(() => {
    let call: DailyNS.DailyCall | null = null;
    let isCancelled = false;

    async function join() {
      const daily = (await import("@daily-co/daily-js")).default;
      if (isCancelled) return;
      call = daily.createFrame(containerRef.current!, {
        showLeaveButton: true,
        iframeStyle: {
          width: "100%",
          height: "70vh",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
        },
      });
      await call.join({ url: roomUrl });
      if (!isCancelled) setJoined(true);
      if (!isCancelled) {
        callRef.current = call;
        const startRecording = async () => {
          try {
            // @ts-ignore - startRecording exists at runtime
            await callRef.current?.startRecording?.({});
          } catch {}
        };
        const stopRecording = async () => {
          try {
            // @ts-ignore - stopRecording exists at runtime
            await callRef.current?.stopRecording?.();
          } catch {}
        };
        onReady?.({ startRecording, stopRecording });
      }
    }

    join();
    return () => {
      isCancelled = true;
      if (call) call.destroy();
      callRef.current = null;
    };
  }, [roomUrl]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} />
      <div className="text-sm text-gray-600">{joined ? "Connected" : "Connecting…"}</div>
    </div>
  );
}


