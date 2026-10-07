"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = "resetwatch_anon_id";

function anonymousId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName: "page_view",
        anonymousId: anonymousId(),
        path: pathname,
        referrer: document.referrer || null
      })
    }).catch(() => {});
  }, [pathname]);

  return null;
}
