"use client";

import { useEffect, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";

import { AdPlacement } from "@/lib/ads";

type AdPayload = {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
};

type Props = {
  placement: AdPlacement;
  width?: number;
  height: number;
  className?: string;
};

export default function AdSlot({ placement, width, height, className }: Props) {
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<AdPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchAd = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ads?placement=${placement}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          setAd(null);
          return;
        }
        const data = await res.json();
        setAd((data.ad as AdPayload | null) ?? null);
      } catch (error) {
        // 화면 전환/언마운트로 인한 취소는 정상 플로우로 간주한다.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAd(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    void fetchAd();
    return () => {
      controller.abort();
    };
  }, [placement]);

  if (loading) return null;

  if (!ad) return null;

  return (
    <button
      type="button"
      className={`relative block overflow-hidden rounded-lg bg-[#17171c]/5 ${className ?? ""}`}
      style={{ width: width ?? "100%", height }}
      onClick={() => {
        void fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => undefined);
        window.location.href = ad.target_url;
      }}
      aria-label={`${ad.title} 광고`}
    >
      <AnimatedImage
        src={ad.image_url}
        alt={ad.title}
        width={1600}
        height={900}
        unoptimized
        draggable={false}
        className="h-full w-full object-cover"
      />
    </button>
  );
}
