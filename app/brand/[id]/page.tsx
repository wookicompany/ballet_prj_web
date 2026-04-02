"use client";

import Image from "next/image";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Facebook,
  Globe,
  Instagram,
  Link,
  Twitter,
  Youtube,
} from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { openUrlInApp } from "@/lib/reactNativeWebView";

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
    icon: <Instagram className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "facebook_url",
    label: "페이스북",
    linkType: "facebook",
    icon: <Facebook className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "threads_url",
    label: "스레드",
    linkType: "threads",
    icon: <Link className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "youtube_url",
    label: "유튜브",
    linkType: "youtube",
    icon: <Youtube className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "x_url",
    label: "X (트위터)",
    linkType: "x",
    icon: <Twitter className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "naver_blog_url",
    label: "네이버 블로그",
    linkType: "naver_blog",
    icon: <Link className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "tiktok_url",
    label: "틱톡",
    linkType: "tiktok",
    icon: <Link className="size-5 text-[#17171c]/60" />,
  },
];

export default function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrand = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/brands/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setBrand(data.brand ?? null);
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
  }, [id]);

  const handleLinkClick = (url: string, linkType: string) => {
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
      <main className="flex min-h-screen flex-col bg-white px-4 pb-10">
        <header className="sticky top-0 z-20 -mx-4 flex h-12 items-center justify-between bg-white px-2">
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
          <div className="w-9" />
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
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 border-b border-[#17171c]/5 last:border-0"
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
                  <div className="size-24 overflow-hidden rounded-2xl border border-[#17171c]/5 bg-[#f5f5f7]">
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
                            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[#17171c]/[0.02] active:bg-[#17171c]/5"
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
