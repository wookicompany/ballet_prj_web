"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

export default function AnimatedImage({
  className,
  onLoad,
  onError,
  ...props
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [props.src]);

  return (
    <Image
      ref={imgRef}
      {...props}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        // Vercel Image Optimization 한도 초과(402) 시 원본 URL로 fallback
        const img = event.currentTarget;
        const originalSrc = typeof props.src === "string" ? props.src : null;
        if (originalSrc && img.src !== originalSrc) {
          img.srcset = "";
          img.src = originalSrc;
        }
        onError?.(event);
      }}
      className={cn(
        "transition-opacity duration-500 ease-out motion-reduce:transition-none",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}
