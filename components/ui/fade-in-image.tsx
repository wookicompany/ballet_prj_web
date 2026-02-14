"use client";

import { useEffect, useRef, useState } from "react";

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
   const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
 
   useEffect(() => {
     setLoaded(false);
   }, [src]);
 
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete) {
      setLoaded(true);
    }
  }, [src]);

   return (
     <img
      ref={imageRef}
       src={src}
       alt={alt}
       loading={loading}
      draggable={false}
       aria-label={ariaLabel}
       onClick={() => {
         sendHapticToApp()
         onClick?.()
       }}
       className={`${className ?? ""} transition-opacity duration-500 ${
         loaded ? "opacity-100" : "opacity-0"
       }`}
       onLoad={() => setLoaded(true)}
       onError={() => setLoaded(true)}
     />
   );
 }
