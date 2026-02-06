"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { LoginSheetProvider } from "@/components/auth/LoginSheetProvider";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginSheetProvider>
        {children}
        <Toaster position="top-center" />
      </LoginSheetProvider>
    </AuthProvider>
  );
}
