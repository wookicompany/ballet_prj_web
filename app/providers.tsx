"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import GoogleAnalyticsPageView from "@/components/analytics/GoogleAnalyticsPageView";
import { ConsentSheetProvider } from "@/components/auth/ConsentSheetProvider";
import { LoginSheetProvider } from "@/components/auth/LoginSheetProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LoginSheetProvider>
        <ConsentSheetProvider>
          <TooltipProvider>
            <GoogleAnalyticsPageView />
            {children}
          </TooltipProvider>
          <Toaster position="top-center" />
        </ConsentSheetProvider>
      </LoginSheetProvider>
    </AuthProvider>
  );
}
