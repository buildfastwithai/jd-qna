"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function IframeMessageListener() {
  const params = useParams();
  const recordId = params.id as string;

  useEffect(() => {
    console.log("IframeMessageListener");
    const handleMessage = async (event: MessageEvent<unknown>) => {
      console.log("handleMessage", event);
      const data = (event && (event as MessageEvent).data) as unknown;
      console.log("data", data);
      if (!data || !recordId) return;

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
      console.log("message", message);
      if (message === "Delete from DB") {
        // TODO: Trigger any cleanup needed (e.g., API call) before closing
        // For now, just log as requested
        // eslint-disable-next-line no-console
        console.log("Iframe was closed, deleting record from DB");
        const response = await fetch(`/api/records/sync-req-details`, {
          method: "POST",
          body: JSON.stringify({
            recordId: recordId,
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN || ""}`,
          },
        });
      }
    };

    window.addEventListener("message", handleMessage);
    // return () => {
    //   window.removeEventListener("message", handleMessage);
    // };
  }, [recordId]);
  console.log("IframeMessageListener rendered");
  return <></>;
}
