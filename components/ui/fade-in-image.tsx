"use client";

import Image from "next/image";
import { useState } from "react";

import { sendHapticToApp } from "@/lib/reactNativeWebView";

type FadeInImageProps = {
   src: string;
   alt: string;
   className?: string;
   loading?: "eager" | "lazy";
   onClick?: () => void;
   ariaLabel?: string;
 };
 
 export default function FadeInImage({
   src,
   alt,
   className,
   loading = "lazy",
   onClick,
   ariaLabel,
 }: FadeInImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;

  return (
    <Image
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
      className={`${className ?? ""} transition-opacity duration-500 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
      onLoad={() => setLoadedSrc(src)}
      onError={() => setLoadedSrc(src)}
    />
  );
}
