"use client";

import { useEffect, useRef, useState } from "react";
import type DailyIframe from "@daily-co/daily-js";

type Props = { roomUrl: string };

export default function VideoCall({ roomUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let call: DailyIframe | null = null;
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
    }

    join();
    return () => {
      isCancelled = true;
      if (call) call.destroy();
    };
  }, [roomUrl]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} />
      <div className="text-sm text-gray-600">{joined ? "Connected" : "Connecting…"}</div>
    </div>
  );
}


