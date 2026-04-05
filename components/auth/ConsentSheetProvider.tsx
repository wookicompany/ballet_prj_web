"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/policy";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

type ConsentSheetContextValue = {
  openConsentSheet: () => void;
  ensureConsent: () => Promise<boolean>;
};

const ConsentSheetContext = createContext<ConsentSheetContextValue | undefined>(
  undefined
);

export function ConsentSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const consentCacheRef = useRef<boolean | null>(null);

  const openConsentSheet = () => setOpen(true);

  const fetchConsentStatus = useCallback(async () => {
    if (!user) return false;
    const { data } = await supabase
      .from("user_consents")
      .select("terms_version,privacy_version")
      .eq("user_id", user.id)
      .maybeSingle();

    return (
      data?.terms_version === TERMS_VERSION &&
      data?.privacy_version === PRIVACY_VERSION
    );
  }, [user]);

  const ensureConsent = async () => {
    if (loading || !user) return false;
    if (consentCacheRef.current === true) return true;
    const ok = await fetchConsentStatus();
    consentCacheRef.current = ok;
    if (!ok) setOpen(true);
    return ok;
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setOpen(false);
      return;
    }

    const ignoredPaths = new Set([
      "/auth/callback",
      "/login",
      "/policy/terms",
      "/policy/privacy",
    ]);
    if (ignoredPaths.has(pathname)) {
      setOpen(false);
      return;
    }

    let isActive = true;
    const checkConsent = async () => {
      const ok = await fetchConsentStatus();
      if (!isActive) return;
      consentCacheRef.current = ok;
      setOpen(!ok);
    };

    checkConsent();
    return () => {
      isActive = false;
    };
  }, [fetchConsentStatus, user, loading, pathname]);

  const handleSubmit = async () => {
    if (loading) return;
    if (!user) return;
    if (!termsChecked || !privacyChecked) {
      toast("필수 약관에 모두 동의해 주세요.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_consents").upsert(
      {
        user_id: user.id,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        agreed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) {
      toast("동의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    consentCacheRef.current = true;
    setOpen(false);
    router.replace("/calendar");
  };

  return (
    <ConsentSheetContext.Provider value={{ openConsentSheet, ensureConsent }}>
      {children}
      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setOpen(true);
            return;
          }
          if (open) {
            setOpen(true);
          }
        }}
        title="필수 약관 동의"
        description="서비스 이용을 위해 필수 약관에 동의해 주세요."
      >
        <div className="space-y-6">
          <section className="space-y-3 rounded-xl border border-[#17171c]/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="consent-terms"
                  checked={termsChecked}
                  onCheckedChange={(checked) => setTermsChecked(!!checked)}
                />
                <Label htmlFor="consent-terms" className="text-sm text-[#17171c]">
                  서비스 이용약관 (필수)
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-[#17171c]/60"
                onClick={() => router.push("/policy/terms")}
              >
                보기
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="consent-privacy"
                  checked={privacyChecked}
                  onCheckedChange={(checked) => setPrivacyChecked(!!checked)}
                />
                <Label
                  htmlFor="consent-privacy"
                  className="text-sm text-[#17171c]"
                >
                  개인정보 처리방침 (필수)
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-[#17171c]/60"
                onClick={() => router.push("/policy/privacy")}
              >
                보기
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white"
            disabled={saving || !termsChecked || !privacyChecked}
            onClick={handleSubmit}
          >
            시작하기
          </Button>
        </div>
      </BottomSheet>
    </ConsentSheetContext.Provider>
  );
}

export function useConsentSheet() {
  const context = useContext(ConsentSheetContext);
  if (!context) {
    throw new Error("useConsentSheet must be used within ConsentSheetProvider");
  }
  return context;
}
