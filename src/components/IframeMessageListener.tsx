"use client";

import { useEffect } from "react";

export default function IframeMessageListener() {
  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const data = (event && (event as MessageEvent).data) as unknown;
      if (!data) return;

      // Support both plain object and string payloads
      let message: string | undefined;
      if (typeof data === "string") {
        message = data;
      } else if (typeof data === "object" && data !== null) {
        const maybeRecord = data as Record<string, unknown>;
        if (typeof maybeRecord.message === "string") {
          message = maybeRecord.message;
        } else if (typeof maybeRecord.type === "string") {
          message = maybeRecord.type;
        }
      }

      if (message === "Delete from DB") {
        // TODO: Trigger any cleanup needed (e.g., API call) before closing
        // For now, just log as requested
        // eslint-disable-next-line no-console
        console.log("Iframe was closed, deleting record from DB");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
