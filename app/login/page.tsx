"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const { signInWithProvider, loading } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-[#17171c]">
      <h1 className="text-xl font-semibold">로그인</h1>
      <p className="text-sm text-[#17171c]/70">
        소셜 계정으로 간편하게 시작하세요.
      </p>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button
          className="w-full"
          disabled={loading}
          onClick={() => signInWithProvider("kakao")}
        >
          카카오로 시작하기
        </Button>
        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={() => signInWithProvider("google")}
        >
          구글로 시작하기
        </Button>
      </div>
    </main>
  );
}
