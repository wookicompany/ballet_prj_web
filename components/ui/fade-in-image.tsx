 "use client";
 
 import { useEffect, useState } from "react";
 
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
 
   useEffect(() => {
     setLoaded(false);
   }, [src]);
 
   return (
     <img
       src={src}
       alt={alt}
       loading={loading}
       aria-label={ariaLabel}
       onClick={onClick}
       className={`${className ?? ""} transition-opacity duration-500 ${
         loaded ? "opacity-100" : "opacity-0"
       }`}
       onLoad={() => setLoaded(true)}
       onError={() => setLoaded(true)}
     />
   );
 }
