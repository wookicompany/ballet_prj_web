"use client";

import Image from "next/image";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Globe,
  Heart,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/authSession";
import { invalidateProfileCache } from "@/lib/profileCache";
import { openUrlInApp, sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";

type Brand = {
  id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  threads_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  naver_blog_url: string | null;
  tiktok_url: string | null;
};

type LinkItem = {
  key: keyof Omit<
    Brand,
    "id" | "name_ko" | "name_en" | "logo_url" | "sort_order"
  >;
  label: string;
  linkType: string;
  icon: React.ReactNode;
};

const LINK_ITEMS: LinkItem[] = [
  {
    key: "website_url",
    label: "홈페이지",
    linkType: "website",
    icon: <Globe className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "instagram_url",
    label: "인스타그램",
    linkType: "instagram",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    key: "facebook_url",
    label: "페이스북",
    linkType: "facebook",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    key: "threads_url",
    label: "스레드",
    linkType: "threads",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 192 192" fill="currentColor">
        <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0282C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.972C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.575 108.995 128.946 98.4405 129.507Z"/>
      </svg>
    ),
  },
  {
    key: "youtube_url",
    label: "유튜브",
    linkType: "youtube",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    key: "x_url",
    label: "X (트위터)",
    linkType: "x",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    key: "naver_blog_url",
    label: "네이버 블로그",
    linkType: "naver_blog",
    icon: (
      <svg className="size-4 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
      </svg>
    ),
  },
  {
    key: "tiktok_url",
    label: "틱톡",
    linkType: "tiktok",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.76a4.85 4.85 0 01-1.02-.07z"/>
      </svg>
    ),
  },
];

export default function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const viewTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (viewTrackedRef.current === id) return;
    viewTrackedRef.current = id;
    fetch(`/api/brands/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("brand_likes")
      .select("deleted_at")
      .eq("user_id", user.id)
      .eq("brand_id", id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data && data.deleted_at === null));
  }, [user, id]);

  const handleLike = async () => {
    if (!user) { openLoginSheet(); return; }
    const prev = liked;
    setLiked(!prev);
    sendHapticToApp();
    try {
      const token = await getAccessToken(openLoginSheet);
      if (!token) { setLiked(prev); return; }
      const res = await fetch(`/api/brands/${id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLiked(prev);
      } else {
        invalidateProfileCache(user.id);
      }
    } catch {
      setLiked(prev);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchBrand = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/brands/${id}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setBrand(data.brand ?? null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
    return () => controller.abort();
  }, [id]);

  const handleLinkClick = (url: string, linkType: string) => {
    sendHapticToApp();
    fetch(`/api/brands/${id}/link-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_type: linkType }),
    }).catch(() => {});
    const opened = openUrlInApp(url, brand?.name_ko);
    if (!opened) window.open(url, "_blank", "noopener,noreferrer");
  };

  const activeLinks = brand
    ? LINK_ITEMS.filter((item) => brand[item.key as keyof Brand])
    : [];

  return (
    <MobileContainer>
      <main className="px-4 pb-10">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <Button type="button" variant="ghost" size="icon-lg" onClick={handleLike}>
            <Heart
              className="size-6"
              style={{ color: "#FF154A" }}
              fill={liked ? "#FF154A" : "none"}
              strokeWidth={liked ? 0 : 1.5}
            />
          </Button>
        </header>

        <div className="mt-2 flex flex-col gap-3">
          {loading ? (
            <>
              <section className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="size-24 rounded-2xl" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </section>
              <section className="rounded-2xl border border-[#17171c]/5 bg-white shadow-sm">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-4 border-b border-[#17171c]/5 last:border-0"
                  >
                    <Skeleton className="size-5 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </section>
            </>
          ) : !brand ? (
            <div className="flex flex-1 items-center justify-center py-24">
              <p className="text-sm text-[#17171c]/40">브랜드 정보를 불러올 수 없어요.</p>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
                <div className="flex flex-col items-center gap-2">
                  <div className="size-24 overflow-hidden rounded-2xl bg-[#f5f5f7]">
                    {brand.logo_url ? (
                      <Image
                        src={brand.logo_url}
                        alt={brand.name_ko}
                        width={96}
                        height={96}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full" />
                    )}
                  </div>
                  <p className="text-lg font-semibold text-[#17171c] text-center">
                    {brand.name_ko}
                  </p>
                  {brand.name_en && (
                    <p className="text-sm text-[#17171c]/60 text-center">
                      {brand.name_en}
                    </p>
                  )}
                </div>
              </section>

              {activeLinks.length > 0 && (
                <section className="rounded-2xl border border-[#17171c]/5 bg-white shadow-sm">
                  <ul className="divide-y divide-[#17171c]/5">
                    {activeLinks.map((item) => {
                      const url = brand[item.key as keyof Brand] as string;
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => handleLinkClick(url, item.linkType)}
                            className="flex w-full items-center gap-3 px-4 py-4 active:opacity-70"
                          >
                            {item.icon}
                            <span className="flex-1 text-left text-sm text-[#17171c]">
                              {item.label}
                            </span>
                            <ChevronLeft className="size-4 rotate-180 text-[#17171c]/30" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </MobileContainer>
  );
}
