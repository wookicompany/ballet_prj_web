"use client";

import * as React from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  showHeader?: boolean;
  contentClassName?: string;
  children: React.ReactNode;
};

export default function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  showHeader = true,
  contentClassName,
  children,
}: BottomSheetProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      if (!contentRef.current) return;
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      contentRef.current.style.paddingBottom =
        keyboardHeight > 0 ? `${keyboardHeight + 48}px` : "";
    };

    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open]);

  const resolvedDescription =
    description ?? "선택 항목을 확인해 주세요.";
  const shouldShowHeader = showHeader && (title || description);
  const accessibilityTitle = title ?? "바텀 시트";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className={contentClassName}>
        {shouldShowHeader ? (
          <DrawerHeader>
            {title ? (
              <DrawerTitle>{title}</DrawerTitle>
            ) : (
              <DrawerTitle className="sr-only">
                {accessibilityTitle}
              </DrawerTitle>
            )}
            <DrawerDescription className={description ? undefined : "sr-only"}>
              {resolvedDescription}
            </DrawerDescription>
          </DrawerHeader>
        ) : (
          <DrawerHeader className="sr-only">
            <DrawerTitle>{accessibilityTitle}</DrawerTitle>
            {description ? (
              <DrawerDescription>{resolvedDescription}</DrawerDescription>
            ) : null}
          </DrawerHeader>
        )}
        <div ref={contentRef} className="overflow-y-auto px-4 pt-6 pb-12">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
