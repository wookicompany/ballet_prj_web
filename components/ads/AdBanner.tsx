"use client";

import { useEffect, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";

import type { AdPlacement } from "@/lib/ads";
import { openUrlInApp } from "@/lib/reactNativeWebView";

type AdPayload = {
  id: string;
  image_url: string | null;
  link_url: string | null;
  height: number;
};

type Props = {
  placement: AdPlacement;
};

export default function AdBanner({ placement }: Props) {
  const [ad, setAd] = useState<AdPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAd = async () => {
      try {
        const res = await fetch(`/api/ads?placement=${placement}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const fetched = (data.ad as AdPayload | null) ?? null;
        setAd(fetched);
        if (fetched) {
          void fetch(`/api/ads/${fetched.id}/impression`, { method: "POST" });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    };

    void fetchAd();

    return () => {
      controller.abort();
    };
  }, [placement]);

  if (!ad || !ad.image_url) return null;

  const handleClick = async () => {
    if (!ad.link_url) return;
    try {
      await fetch(`/api/ads/${ad.id}/click`, { method: "POST" });
    } catch {
      // 클릭 추적 실패는 무시
    }
    const opened = openUrlInApp(ad.link_url);
    if (!opened) window.open(ad.link_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{ height: ad.height }}
    >
      <button
        type="button"
        className="block h-full w-full"
        onClick={() => void handleClick()}
        aria-label="광고 배너"
      >
        <AnimatedImage
          src={ad.image_url}
          alt="광고"
          width={430}
          height={ad.height}
          className="h-full w-full object-cover"
          unoptimized
        />
      </button>
    </div>
  );
}
