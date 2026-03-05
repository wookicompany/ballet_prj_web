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
  const resolvedDescription =
    description ?? "선택 항목을 확인해 주세요.";
  const shouldShowHeader = showHeader && (title || description);
  const accessibilityTitle = title ?? "바텀 시트";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
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
        <div className="px-4 pt-6 pb-8">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
