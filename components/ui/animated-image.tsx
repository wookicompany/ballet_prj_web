"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

export default function AnimatedImage({
  className,
  onLoad,
  ...props
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      {...props}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      className={cn(
        "transition-all duration-500 ease-out motion-reduce:transition-none",
        loaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.02]",
        className
      )}
    />
  );
}
