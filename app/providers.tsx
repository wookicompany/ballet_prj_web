"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { ConsentSheetProvider } from "@/components/auth/ConsentSheetProvider";
import { LoginSheetProvider } from "@/components/auth/LoginSheetProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginSheetProvider>
        <ConsentSheetProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ConsentSheetProvider>
      </LoginSheetProvider>
    </AuthProvider>
  );
}
