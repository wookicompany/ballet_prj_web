import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoadingOverlayProps = {
  className?: string;
};

export function LoadingOverlay({ className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-white/80",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" />
    </div>
  );
}
