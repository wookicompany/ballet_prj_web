"use client";

import AnimatedImage from "@/components/ui/animated-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Search } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AdBanner from "@/components/ads/AdBanner";
import { getAccessToken } from "@/lib/authSession";
import { getBrandHomeCache, setBrandHomeCache } from "@/lib/brandHomeCache";
import {
  BRAND_LINK_ITEMS,
  getFirstAvailableLink,
  openBrandLink,
  type BrandLinkFields,
} from "@/lib/brandLinks";
import { invalidateProfileCache } from "@/lib/profileCache";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";

type Brand = BrandLinkFields & {
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
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const cached = getBrandHomeCache<CachePayload>();

  const [brands, setBrands] = useState<Brand[]>(() => cached?.brands ?? []);
  const [popularBrands, setPopularBrands] = useState<Brand[]>(
    () => cached?.popularBrands ?? []
  );
  const [loading, setLoading] = useState(() => !cached);
  const [page, setPage] = useState(() => cached?.page ?? 0);
  const [hasMore, setHasMore] = useState(() => cached?.hasMore ?? true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

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
    const baseSelect =
      "id, name_ko, name_en, logo_url, sort_order, website_url, instagram_url, facebook_url, threads_url, youtube_url, x_url, naver_blog_url, tiktok_url";

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
            .select("brand_id, score")
            .gt("score", 0)
            .order("score", { ascending: false })
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

  // 찜 상태는 유저별 데이터라 brandHomeCache에 넣지 않고 마운트마다 조회
  useEffect(() => {
    if (!user) {
      setLikedIds(new Set());
      return;
    }
    let isActive = true;
    supabase
      .from("brand_likes")
      .select("brand_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .then(({ data }) => {
        if (!isActive) return;
        setLikedIds(new Set((data ?? []).map((r) => r.brand_id).filter(Boolean) as string[]));
      });
    return () => {
      isActive = false;
    };
  }, [user]);

  const handleLike = useCallback(
    async (brandId: string) => {
      if (!user) {
        openLoginSheet();
        return;
      }
      const wasLiked = likedIds.has(brandId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(brandId);
        else next.add(brandId);
        return next;
      });
      sendHapticToApp();
      const revert = () =>
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(brandId);
          else next.delete(brandId);
          return next;
        });
      try {
        const token = await getAccessToken(openLoginSheet);
        if (!token) {
          revert();
          return;
        }
        const res = await fetch(`/api/brands/${brandId}/like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          revert();
        } else {
          invalidateProfileCache(user.id);
        }
      } catch {
        revert();
      }
    },
    [user, likedIds, openLoginSheet]
  );

  const openBrandHomepage = useCallback((brand: Brand) => {
    const first = getFirstAvailableLink(brand);
    if (!first) return;
    openBrandLink(brand.id, brand.name_ko, first.url, first.item.linkType);
  }, []);

  const popularCards = useMemo(
    () =>
      popularBrands.map((brand) => (
        <button
          key={brand.id}
          type="button"
          onClick={() => openBrandHomepage(brand)}
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
    [popularBrands, openBrandHomepage]
  );

  const allBrandCards = useMemo(
    () =>
      brands.map((brand) => {
        const liked = likedIds.has(brand.id);
        const activeLinks = BRAND_LINK_ITEMS.filter((item) => brand[item.key]);
        return (
          <li key={brand.id} className="flex flex-col gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => openBrandHomepage(brand)}
                className="block w-full transition-opacity duration-200 active:opacity-70"
                aria-label={`${brand.name_ko} 홈페이지 열기`}
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
              </button>
              <button
                type="button"
                onClick={() => handleLike(brand.id)}
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur-sm transition-transform active:scale-90 after:absolute after:-inset-2 after:content-['']"
                aria-label={liked ? "찜 해제" : "찜"}
              >
                <Heart
                  className="size-4"
                  color="#FF154A"
                  fill={liked ? "#FF154A" : "none"}
                />
              </button>
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
            {activeLinks.length > 0 && (
              // 한 줄에 최대 4개 (4×32px + 간격 12px + 좌우 패딩 8px = 148px), 5개째부터 줄바꿈
              <div className="flex max-w-[148px] flex-wrap items-center gap-1 px-1">
                {activeLinks.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      openBrandLink(
                        brand.id,
                        brand.name_ko,
                        brand[item.key] as string,
                        item.linkType
                      )
                    }
                    className="relative flex size-8 items-center justify-center rounded-lg bg-[#f5f5f7] transition-opacity active:opacity-70 after:absolute after:-inset-1 after:content-['']"
                    aria-label={`${brand.name_ko} ${item.label}`}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      }),
    [brands, likedIds, handleLike, openBrandHomepage]
  );

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

  return (
    <>
      <main className="px-4 pb-16">
        <header className="sticky top-0 z-20 bg-background -mx-4 px-4 h-12 mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">브랜드</h1>
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
                    <Skeleton className="h-8 w-2/3 rounded-lg" />
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
                      <Skeleton className="h-8 w-2/3 rounded-lg" />
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
