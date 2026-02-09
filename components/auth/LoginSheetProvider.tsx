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

const SHOW_KAKAO_LOGIN = true;

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
          {SHOW_KAKAO_LOGIN ? (
            <Button
              className="h-12 w-full justify-center gap-2 bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
              disabled={loading}
              onClick={() => signInWithProvider("kakao")}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3.5c-5.2 0-9.5 3.3-9.5 7.4 0 2.7 1.7 5 4.5 6.3l-1 3.5c-.1.3.2.6.5.4l4-2.6c.3 0 .9.1 1.5.1 5.2 0 9.5-3.3 9.5-7.4S17.2 3.5 12 3.5z"
                  />
                </svg>
              </span>
              카카오로 시작하기
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-12 w-full justify-center gap-2 bg-white text-[#17171c] hover:bg-black/5"
            disabled={loading}
            onClick={() => signInWithProvider("google")}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.48a5.54 5.54 0 0 1-2.4 3.63v3.01h3.88c2.27-2.1 3.53-5.19 3.53-8.75z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A11.99 11.99 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.11z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.96 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.27 6.6l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"
                />
              </svg>
            </span>
            구글로 시작하기
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
