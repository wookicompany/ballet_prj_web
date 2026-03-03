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
  width: number;
  height: number;
  className?: string;
};

export default function AdSlot({ placement, width, height, className }: Props) {
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<AdPayload | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchAd = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ads?placement=${placement}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (mounted) setAd(null);
          return;
        }
        const data = await res.json();
        if (mounted) setAd((data.ad as AdPayload | null) ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void fetchAd();
    return () => {
      mounted = false;
    };
  }, [placement]);

  if (loading) return null;

  if (!ad) return null;

  return (
    <button
      type="button"
      className={`relative block overflow-hidden rounded-lg bg-[#17171c]/5 ${className ?? ""}`}
      style={{ width, height }}
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
      <span className="absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[10px] text-white">
        광고
      </span>
    </button>
  );
}
