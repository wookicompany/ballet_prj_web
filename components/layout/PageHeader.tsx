"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, onBack, right, className }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-background h-12 flex items-center justify-between",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="text-[#17171c]/70"
        onClick={onBack ?? (() => router.back())}
        aria-label="뒤로"
      >
        <ChevronLeft className="size-6" />
      </Button>
      {title && <h1 className="text-base font-semibold">{title}</h1>}
      {right ?? <div className="w-10" />}
    </header>
  );
}
