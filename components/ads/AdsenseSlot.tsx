"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { AdPlacement } from "@/lib/ads";

type AdPayload = {
  id: string;
};

type Props = {
  placement: AdPlacement;
  slot: string | undefined;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdsenseSlot({ placement, slot, className }: Props) {
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<AdPayload | null>(null);
  const pushedRef = useRef(false);

  const normalizedSlot = useMemo(() => slot?.trim() ?? "", [slot]);
  const canRenderSlot = !!normalizedSlot;

  useEffect(() => {
    const controller = new AbortController();
    pushedRef.current = false;

    const fetchAd = async () => {
      if (!canRenderSlot) {
        setAd(null);
        setLoading(false);
        return;
      }

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
  }, [canRenderSlot, placement]);

  useEffect(() => {
    if (!ad || !canRenderSlot || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
  }, [ad, canRenderSlot]);

  if (loading || !ad || !canRenderSlot) return null;

  return (
    <div
      className={`overflow-hidden rounded-lg bg-[#17171c]/5 ${className ?? ""}`}
      style={{ width: "100%", height: 50 }}
    >
      <ins
        className="adsbygoogle block h-full w-full"
        style={{ width: "100%", height: "50px" }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
        data-ad-slot={normalizedSlot}
        data-ad-format="horizontal"
        data-full-width-responsive="false"
      />
    </div>
  );
}
