"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  RN_PLATFORM_INFO_EVENT,
  resolvePlatformInfoFromBridgeMessage,
  type AppPlatform,
} from "@/lib/reactNativeWebView";

export function PlatformDetector() {
  const { session } = useAuth();
  const savedRef = useRef<AppPlatform | null>(null);

  useEffect(() => {
    const handlePlatformEvent = async (event: Event) => {
      const result = resolvePlatformInfoFromBridgeMessage(
        (event as CustomEvent).detail
      );
      if (!result) return;
      if (savedRef.current === result.platform) return;
      if (!session) return;

      const res = await fetch("/api/profile/platform", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_platform: result.platform }),
      });

      if (res.ok) {
        savedRef.current = result.platform;
      }
    };

    window.addEventListener(
      RN_PLATFORM_INFO_EVENT,
      handlePlatformEvent as EventListener
    );
    return () => {
      window.removeEventListener(
        RN_PLATFORM_INFO_EVENT,
        handlePlatformEvent as EventListener
      );
    };
  }, [session]);

  return null;
}
