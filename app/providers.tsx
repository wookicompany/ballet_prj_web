"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { ConsentSheetProvider } from "@/components/auth/ConsentSheetProvider";
import { LoginSheetProvider } from "@/components/auth/LoginSheetProvider";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginSheetProvider>
        <ConsentSheetProvider>
          {children}
          <Toaster position="top-center" />
        </ConsentSheetProvider>
      </LoginSheetProvider>
    </AuthProvider>
  );
}
