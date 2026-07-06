"use client";

import AnimatedImage from "@/components/ui/animated-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFirstAvailableLink,
  openBrandLink,
  type BrandLinkFields,
} from "@/lib/brandLinks";
import { supabase } from "@/lib/supabaseClient";

type Brand = BrandLinkFields & {
  id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
  sort_order: number;
};

const PAGE_SIZE = 12;

export default function BrandSearchInputPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const fetchBrands = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("ballet_brands")
          .select(
            "id, name_ko, name_en, logo_url, sort_order, website_url, instagram_url, facebook_url, threads_url, youtube_url, x_url, naver_blog_url, tiktok_url"
          )
          .eq("is_active", true)
          .order("name_ko", { ascending: true });
        setAllBrands((data ?? []) as Brand[]);
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allBrands;
    return allBrands.filter(
      (b) =>
        b.name_ko.toLowerCase().includes(q) ||
        (b.name_en?.toLowerCase().includes(q) ?? false)
    );
  }, [query, allBrands]);

  const visibleBrands = useMemo(
    () => filtered.slice(0, displayCount),
    [filtered, displayCount]
  );

  const hasMore = displayCount < filtered.length;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDisplayCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <>
      <main className="px-4 pb-16 pt-2">
        <header className="flex items-center gap-2 pt-2">
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
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#17171c]/40" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="브랜드명으로 검색해요"
              className="h-12 rounded-2xl border border-[#17171c]/5 bg-white pl-9 text-base placeholder:text-sm shadow-sm"
            />
          </div>
        </header>
        <div className="mt-4 h-px bg-[#17171c]/5" />

        <div>
          {loading ? (
            <div className="divide-y divide-[#17171c]/5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-16 rounded-xl shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-[#17171c]/40">
                {query.trim()
                  ? "검색 결과가 없어요."
                  : "아직 등록된 브랜드가 없어요."}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[#17171c]/5">
                {visibleBrands.map((brand) => (
                  <li key={brand.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const first = getFirstAvailableLink(brand);
                        if (!first) return;
                        openBrandLink(brand.id, brand.name_ko, first.url, first.item.linkType);
                      }}
                      className="flex w-full items-center gap-3 py-3 transition-opacity duration-200 active:opacity-70"
                    >
                      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7] ring-1 ring-[#17171c]/10">
                        {brand.logo_url ? (
                          <AnimatedImage
                            src={brand.logo_url}
                            alt={brand.name_ko}
                            width={64}
                            height={64}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="size-full" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col items-start gap-0.5 overflow-hidden">
                        <span className="text-sm font-medium text-[#17171c] truncate w-full text-left">
                          {brand.name_ko}
                        </span>
                        {brand.name_en && (
                          <span className="text-xs text-[#17171c]/50 truncate w-full text-left">
                            {brand.name_en}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[#17171c]/30" />
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && <div ref={sentinelRef} className="h-1" />}
            </>
          )}
        </div>
      </main>
    </>
  );
}
