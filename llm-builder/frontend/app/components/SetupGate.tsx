"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setupApi } from "@/lib/api";

export function SetupGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/setup") return;
    setupApi
      .getStatus()
      .then((data) => {
        if (!data.setup_completed) {
          router.replace("/setup");
        }
      })
      .catch(() => {
        router.replace("/setup");
      });
  }, [pathname, router]);

  return <>{children}</>;
}
