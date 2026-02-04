import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" aria-label="로딩">
      <Loader2
        className={cn("animate-spin text-[#17171c]/60", sizeClasses[size], className)}
      />
    </span>
  );
}
