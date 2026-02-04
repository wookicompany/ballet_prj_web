"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { LoginSheetProvider } from "@/components/auth/LoginSheetProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginSheetProvider>{children}</LoginSheetProvider>
    </AuthProvider>
  );
}
