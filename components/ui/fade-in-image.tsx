"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { sendHapticToApp } from "@/lib/reactNativeWebView";

const revealedSrcCache = new Set<string>();

const getCanonicalSrc = (src: string) => {
  const [base] = src.split("?");
  return base || src;
};

type FadeInImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  // none: immediate render, soft: immediate render (reserved), strong: load-gated fade
  animation?: "none" | "soft" | "strong";
  onClick?: () => void;
  ariaLabel?: string;
};

export default function FadeInImage({
   src,
   alt,
   className,
   loading = "lazy",
  animation = "soft",
   onClick,
   ariaLabel,
 }: FadeInImageProps) {
  const canonicalSrc = getCanonicalSrc(src);
  const isStrong = animation === "strong";
  const isSoft = animation === "soft";
  const [isLoaded, setIsLoaded] = useState(() =>
    isStrong ? revealedSrcCache.has(canonicalSrc) : true
  );

  useEffect(() => {
    if (!isStrong) {
      setIsLoaded(true);
      return;
    }
    setIsLoaded(revealedSrcCache.has(canonicalSrc));
  }, [canonicalSrc, isStrong]);

  const reveal = useCallback(() => {
    if (!isStrong) return;
    revealedSrcCache.add(canonicalSrc);
    setIsLoaded(true);
  }, [canonicalSrc, isStrong]);

  const revealWithNextFrame = useCallback(() => {
    if (!isStrong) return;
    window.requestAnimationFrame(() => {
      revealedSrcCache.add(canonicalSrc);
      setIsLoaded(true);
    });
  }, [canonicalSrc, isStrong]);

  const handleRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!isStrong) return;
      if (!node) return;
      if (!node.complete) return;
      revealWithNextFrame();
    },
    [isStrong, revealWithNextFrame]
  );

  return (
    <Image
      ref={isStrong ? handleRef : undefined}
      src={src}
      alt={alt}
      width={1600}
      height={1600}
      unoptimized
      loading={loading}
      draggable={false}
      aria-label={ariaLabel}
      onClick={() => {
        sendHapticToApp();
        onClick?.();
      }}
      className={`${className ?? ""} ${
        isStrong || isSoft
          ? `transition-opacity duration-300 ease-out motion-reduce:transition-none ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`
          : "opacity-100"
      }`}
      onLoadingComplete={() => {
        if (isStrong) reveal();
      }}
      onError={() => {
        if (isStrong) reveal();
      }}
    />
  );
}
