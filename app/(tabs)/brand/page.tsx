"use client";

import AnimatedImage from "@/components/ui/animated-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AdBanner from "@/components/ads/AdBanner";
import { getBrandHomeCache, setBrandHomeCache } from "@/lib/brandHomeCache";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";

type Brand = {
  id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
  sort_order: number;
};

type CachePayload = {
  brands: Brand[];
  popularBrands: Brand[];
  page: number;
  hasMore: boolean;
};

const PAGE_SIZE = 12;

export default function BrandPage() {
  const router = useRouter();
  const cached = getBrandHomeCache<CachePayload>();

  const [brands, setBrands] = useState<Brand[]>(() => cached?.brands ?? []);
  const [popularBrands, setPopularBrands] = useState<Brand[]>(
    () => cached?.popularBrands ?? []
  );
  const [loading, setLoading] = useState(() => !cached);
  const [page, setPage] = useState(() => cached?.page ?? 0);
  const [hasMore, setHasMore] = useState(() => cached?.hasMore ?? true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef(
    new Set<number>(
      cached
        ? Array.from({ length: (cached.page ?? 0) + 1 }, (_, i) => i)
        : []
    )
  );
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(async (pageToFetch: number) => {
    if (pageToFetch === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const rangeStart = pageToFetch * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;
    const baseSelect = "id, name_ko, name_en, logo_url, sort_order";

    try {
      if (pageToFetch === 0) {
        const [brandsRes, engagementRes] = await Promise.all([
          supabase
            .from("ballet_brands")
            .select(baseSelect)
            .eq("is_active", true)
            .order("name_ko", { ascending: true })
            .range(rangeStart, rangeEnd),
          supabase
            .from("brand_engagement_summaries")
            .select("brand_id, view_count")
            .gt("view_count", 0)
            .order("view_count", { ascending: false })
            .limit(8),
        ]);

        const fetched = (brandsRes.data ?? []) as Brand[];
        const popularIds = (engagementRes.data ?? [])
          .map((r) => r.brand_id)
          .filter(Boolean) as string[];

        let popularList: Brand[] = [];
        if (popularIds.length > 0) {
          const res = await supabase
            .from("ballet_brands")
            .select(baseSelect)
            .in("id", popularIds)
            .eq("is_active", true);
          const popularMap = new Map(
            ((res.data ?? []) as Brand[]).map((b) => [b.id, b])
          );
          popularList = popularIds
            .map((id) => popularMap.get(id))
            .filter(Boolean) as Brand[];
        }

        setBrands(fetched);
        setPopularBrands(popularList);
        setHasMore(fetched.length === PAGE_SIZE);
        setLoading(false);
      } else {
        const { data, error } = await supabase
          .from("ballet_brands")
          .select(baseSelect)
          .eq("is_active", true)
          .order("name_ko", { ascending: true })
          .range(rangeStart, rangeEnd);

        if (error) {
          setLoadingMore(false);
          return;
        }

        const fetched = (data ?? []) as Brand[];
        setBrands((prev) => {
          const seen = new Set(prev.map((b) => b.id));
          const merged = [...prev];
          fetched.forEach((b) => {
            if (!seen.has(b.id)) merged.push(b);
          });
          return merged;
        });
        setHasMore(fetched.length === PAGE_SIZE);
        setLoadingMore(false);
      }
    } catch {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (cached) return;
    fetchPage(0);
  }, [cached, fetchPage]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    if (loading || loadingMore) return;
    setBrandHomeCache<CachePayload>({ brands, popularBrands, page, hasMore });
  }, [brands, popularBrands, page, hasMore, loading, loadingMore]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    if (requestedPagesRef.current.has(nextPage)) return;
    requestedPagesRef.current.add(nextPage);
    setPage(nextPage);
    fetchPage(nextPage);
  }, [fetchPage, hasMore, loadingMore, page]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          !loadingRef.current &&
          !loadingMoreRef.current
        ) {
          loadMore();
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading]);

  const popularCards = useMemo(
    () =>
      popularBrands.map((brand) => (
        <button
          key={brand.id}
          type="button"
          onClick={() => {
            sendHapticToApp();
            router.push(`/brand/${brand.id}`);
          }}
          className="flex w-[72px] shrink-0 snap-start flex-col items-center gap-2 transition-opacity duration-200 active:opacity-70"
        >
          <div className="size-[64px] overflow-hidden rounded-2xl bg-[#f5f5f7] ring-1 ring-[#17171c]/10">
            {brand.logo_url ? (
              <AnimatedImage
                src={brand.logo_url}
                alt={brand.name_ko}
                width={64}
                height={64}
                sizes="64px"
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full" />
            )}
          </div>
          <span className="w-full truncate text-center text-xs font-medium text-[#17171c]">
            {brand.name_ko}
          </span>
        </button>
      )),
    [popularBrands, router]
  );

  const allBrandCards = useMemo(
    () =>
      brands.map((brand) => (
        <li key={brand.id}>
          <button
            type="button"
            onClick={() => {
              sendHapticToApp();
              router.push(`/brand/${brand.id}`);
            }}
            className="flex w-full flex-col gap-2 transition-opacity duration-200 active:opacity-70"
          >
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#f5f5f7] ring-1 ring-[#17171c]/10">
              {brand.logo_url ? (
              <AnimatedImage
                src={brand.logo_url}
                alt={brand.name_ko}
                width={200}
                height={200}
                sizes="(max-width: 430px) calc(50vw - 28px), 180px"
                className="size-full object-cover"
              />
              ) : (
                <div className="size-full" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 overflow-hidden px-1">
              <span className="truncate text-left text-sm font-medium text-[#17171c]">
                {brand.name_ko}
              </span>
              {brand.name_en && (
                <span className="truncate text-left text-xs text-[#17171c]/50">
                  {brand.name_en}
                </span>
              )}
            </div>
          </button>
        </li>
      )),
    [brands, router]
  );

  return (
    <>
      <main className="px-4 pb-16">
        <header className="sticky top-0 z-20 bg-white -mx-4 px-4 h-12 mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">브랜드</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => {
              sendHapticToApp();
              router.push("/brand/search-input");
            }}
            aria-label="검색"
          >
            <Search className="size-6" />
          </Button>
        </header>

        <section className="mb-4">
          <AdBanner placement="brand_home" />
        </section>

        {loading ? (
          <div className="space-y-8">
            <section className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex w-[72px] shrink-0 flex-col items-center gap-2"
                  >
                    <Skeleton className="size-[64px] rounded-2xl" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </section>
            <section className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-square w-full rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : brands.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-[#17171c]/40">
              아직 등록된 브랜드가 없어요.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {popularCards.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold">
                  지금 주목받는 브랜드를 모아봤어요
                </h2>
                <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                  {popularCards}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-base font-semibold">모든 브랜드를 만나보세요</h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-8">
                {allBrandCards}
              </ul>
              {loadingMore && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-8 mt-0">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="aspect-square w-full rounded-2xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              )}
              {hasMore && <div ref={sentinelRef} className="h-1" />}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
