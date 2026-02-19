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
  // none: immediate render, soft: immediate + tiny transform, strong: load-gated fade
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
  const isStrongAnimation = animation === "strong";
  const [isLoaded, setIsLoaded] = useState(() =>
    isStrongAnimation ? revealedSrcCache.has(src) : true
  );
  const [isSoftEntered, setIsSoftEntered] = useState(false);

  useEffect(() => {
    const seen = revealedSrcCache.has(src);
    setIsLoaded(isStrongAnimation ? seen : true);
    setIsSoftEntered(false);
    window.requestAnimationFrame(() => {
      setIsSoftEntered(true);
    });
  }, [isStrongAnimation, src]);

  const reveal = useCallback(() => {
    if (!isStrongAnimation) return;
    revealedSrcCache.add(src);
    setIsLoaded(true);
    setIsSoftEntered(false);
    window.requestAnimationFrame(() => {
      setIsSoftEntered(true);
    });
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
        animation === "none"
          ? "opacity-100"
          : animation === "strong"
          // Strong mode is only for large hero visuals that can tolerate fade-in.
          ? `transition-[opacity,transform] duration-300 ease-out will-change-[opacity,transform] ${
              isLoaded ? "opacity-100" : "opacity-0"
            } ${isSoftEntered ? "scale-100" : "scale-[1.01]"}`
          // Soft mode keeps immediate visibility to avoid list flicker.
          : `opacity-100 transition-transform duration-180 ease-out will-change-transform ${
              isSoftEntered ? "scale-100" : "scale-[0.996]"
            }`
      }`}
      onLoad={isStrongAnimation ? handleLoaded : undefined}
      onError={isStrongAnimation ? handleLoaded : undefined}
    />
  );
}
