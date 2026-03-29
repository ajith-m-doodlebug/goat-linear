"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setupApi } from "@/lib/api";

/** After docker stop/start the API/DB can be briefly unavailable; retry before deciding setup state. */
const STATUS_ATTEMPTS = 15;
const STATUS_DELAY_MS = 400;

export function SetupGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(pathname === "/setup");

  useEffect(() => {
    if (pathname === "/setup") {
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      for (let i = 0; i < STATUS_ATTEMPTS; i++) {
        try {
          const data = await setupApi.getStatus();
          if (cancelled) return;
          if (!data.setup_completed) {
            router.replace("/setup");
            return;
          }
          setReady(true);
          return;
        } catch {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, STATUS_DELAY_MS));
        }
      }
      if (cancelled) return;
      // Do not send users to /setup on persistent errors — that would look like "setup reset".
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Connecting to API…
      </div>
    );
  }

  return <>{children}</>;
}
