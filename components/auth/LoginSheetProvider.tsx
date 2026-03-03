"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import Image from "next/image";

import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

type LoginSheetContextValue = {
  openLoginSheet: () => void;
  closeLoginSheet: () => void;
};

const LoginSheetContext = createContext<LoginSheetContextValue | undefined>(
  undefined
);

const SHOW_KAKAO_LOGIN = true;
const SHOW_APPLE_LOGIN = true;
const SHOW_GOOGLE_LOGIN = false;
const SOCIAL_BUTTON_BASE_CLASS = "h-12 w-full justify-center gap-2";
const SOCIAL_ICON_BOX_CLASS = "inline-flex h-5 w-5 items-center justify-center";

export function LoginSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signInWithProvider, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const openLoginSheet = useCallback(() => setOpen(true), []);
  const closeLoginSheet = useCallback(() => setOpen(false), []);
  const handleSocialLogin = useCallback(
    async (provider: "kakao" | "apple" | "google") => {
      try {
        await signInWithProvider(provider);
      } catch {
        toast("로그인 연결에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    },
    [signInWithProvider]
  );

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
              className={`${SOCIAL_BUTTON_BASE_CLASS} bg-[#FEE500] text-black hover:bg-[#FEE500]/90`}
              disabled={loading}
              onClick={() => void handleSocialLogin("kakao")}
            >
              <span className={SOCIAL_ICON_BOX_CLASS}>
                <Image
                  src="/icons/kakao-logo.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain"
                  aria-hidden="true"
                />
              </span>
              카카오로 시작하기
            </Button>
          ) : null}
          {SHOW_APPLE_LOGIN ? (
            <Button
              className={`${SOCIAL_BUTTON_BASE_CLASS} rounded-[6px] border border-[#1a1a1a] !bg-black text-white hover:!bg-[#1a1a1a] focus-visible:ring-2 focus-visible:ring-white/30`}
              style={{ backgroundColor: "#000000" }}
              disabled={loading}
              onClick={() => void handleSocialLogin("apple")}
              aria-label="Sign in with Apple"
            >
              <span className={SOCIAL_ICON_BOX_CLASS}>
                <Image
                  src="/icons/apple-logo.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain"
                  aria-hidden="true"
                />
              </span>
              Apple로 시작하기
            </Button>
          ) : null}
          {SHOW_GOOGLE_LOGIN ? (
            <Button
              variant="outline"
              className={`${SOCIAL_BUTTON_BASE_CLASS} bg-white text-[#17171c] hover:bg-black/5`}
              disabled={loading}
              onClick={() => void handleSocialLogin("google")}
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
          ) : null}
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
