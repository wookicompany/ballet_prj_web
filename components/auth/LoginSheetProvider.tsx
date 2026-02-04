"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";

type LoginSheetContextValue = {
  openLoginSheet: () => void;
  closeLoginSheet: () => void;
};

const LoginSheetContext = createContext<LoginSheetContextValue | undefined>(
  undefined
);

export function LoginSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signInWithProvider, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const openLoginSheet = useCallback(() => setOpen(true), []);
  const closeLoginSheet = useCallback(() => setOpen(false), []);

  return (
    <LoginSheetContext.Provider value={{ openLoginSheet, closeLoginSheet }}>
      {children}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="로그인이 필요해요"
        description="소셜 계정으로 간편하게 시작할 수 있어요."
      >
        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => signInWithProvider("google")}
          >
            구글로 시작하기
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => signInWithProvider("kakao")}
          >
            카카오로 시작하기
          </Button>
        </div>
      </BottomSheet>
    </LoginSheetContext.Provider>
  );
}

export function useLoginSheet() {
  const context = useContext(LoginSheetContext);
  if (!context) {
    throw new Error("useLoginSheet must be used within LoginSheetProvider");
  }
  return context;
}
