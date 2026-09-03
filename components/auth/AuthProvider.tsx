"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { getOAuthProvider, type OAuthProvider } from "@/lib/oauthProvider";
import { setHapticEnabled } from "@/lib/reactNativeWebView";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  provider: OAuthProvider;
  loading: boolean;
  signInWithProvider: (provider: "google" | "kakao" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * 진동 전역 게이트에 서버(profiles.haptic_enabled) 값을 주입.
 * 렌더를 막지 않는 fire-and-forget 호출 — 조회 실패/로그인 안 됨은 안전측 ON 유지.
 */
function syncHapticEnabled(user: User | null) {
  if (!user) {
    setHapticEnabled(true);
    return;
  }
  void (async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("haptic_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (error) return;
      setHapticEnabled(data?.haptic_enabled !== false);
    } catch {
      // profiles 조회 실패는 앱 동작에 영향 주지 않음 — 안전측 ON 유지
    }
  })();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
      syncHapticEnabled(data.session?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // getSession()이 INITIAL_SESSION을 이미 처리하므로 중복 렌더 방지
        if (event === "INITIAL_SESSION") return;
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        setLoading(false);
        syncHapticEnabled(nextSession?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithProvider = useCallback(
    async (provider: "google" | "kakao" | "apple") => {
      const redirectTo = `${window.location.origin}/auth/callback`;
      setOauthLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        setOauthLoading(false);
        throw error;
      }
      if (!data?.url) {
        setOauthLoading(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      provider: getOAuthProvider(user),
      loading: loading || oauthLoading,
      signInWithProvider,
      signOut,
    }),
    [user, session, loading, oauthLoading, signInWithProvider, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
