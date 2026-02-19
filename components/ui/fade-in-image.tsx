"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { sendHapticToApp } from "@/lib/reactNativeWebView";

const revealedSrcCache = new Set<string>();

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
  animation = "none",
   onClick,
   ariaLabel,
 }: FadeInImageProps) {
  const isStrongAnimation = animation === "strong";
  const [isLoaded, setIsLoaded] = useState(() =>
    isStrongAnimation ? revealedSrcCache.has(src) : true
  );

  useEffect(() => {
    const seen = revealedSrcCache.has(src);
    if (isStrongAnimation) {
      setIsLoaded(seen);
      return;
    }
    setIsLoaded(true);
  }, [isStrongAnimation, src]);

  const reveal = useCallback(() => {
    if (!isStrongAnimation) return;
    revealedSrcCache.add(src);
    setIsLoaded(true);
  }, [isStrongAnimation, src]);

  const handleLoaded = () => {
    reveal();
  };

  const handleRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!isStrongAnimation) return;
      if (!node) return;
      if (!node.complete) return;
      reveal();
    },
    [isStrongAnimation, reveal]
  );

  return (
    <Image
      ref={isStrongAnimation ? handleRef : undefined}
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
        animation === "strong"
          ? `transition-opacity duration-200 ease-out will-change-[opacity] ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`
          : "opacity-100"
      }`}
      onLoad={isStrongAnimation ? handleLoaded : undefined}
      onError={isStrongAnimation ? handleLoaded : undefined}
    />
  );
}
