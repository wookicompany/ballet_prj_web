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
  // iOS WebView에서 바텀시트 내 input 포커스 시 키보드가 페이지를 강제 스크롤하는 문제 방지
  React.useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      window.scrollTo(0, scrollY);
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
        <div className="overflow-y-auto px-4 pt-6 pb-12">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
