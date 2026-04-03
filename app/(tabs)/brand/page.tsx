"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

type CachePayload = { brands: Brand[]; popularBrands: Brand[] };

let brandHomeInFlight: Promise<CachePayload> | null = null;

export default function BrandPage() {
  const router = useRouter();
  const cached = getBrandHomeCache<CachePayload>();
  const [brands, setBrands] = useState<Brand[]>(() => cached?.brands ?? []);
  const [popularBrands, setPopularBrands] = useState<Brand[]>(
    () => cached?.popularBrands ?? []
  );
  const [loading, setLoading] = useState(() => !cached);

  const fetchData = useCallback(async () => {
    const cachedNow = getBrandHomeCache<CachePayload>();
    if (cachedNow) {
      setBrands(cachedNow.brands);
      setPopularBrands(cachedNow.popularBrands);
      setLoading(false);
      return;
    }

    if (!brandHomeInFlight) {
      brandHomeInFlight = (async () => {
        const baseSelect = "id, name_ko, name_en, logo_url, sort_order";

        const [brandsRes, engagementRes] = await Promise.all([
          supabase
            .from("ballet_brands")
            .select(baseSelect)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("brand_engagement_summaries")
            .select("brand_id, view_count")
            .gt("view_count", 0)
            .order("view_count", { ascending: false })
            .limit(8),
        ]);

        const allBrands = (brandsRes.data ?? []) as Brand[];
        const popularIds = (engagementRes.data ?? [])
          .map((r) => r.brand_id)
          .filter(Boolean) as string[];

        let popularList: Brand[] = [];
        if (popularIds.length > 0) {
          const brandMap = new Map(allBrands.map((b) => [b.id, b]));
          popularList = popularIds
            .map((id) => brandMap.get(id))
            .filter(Boolean) as Brand[];
        }

        return { brands: allBrands, popularBrands: popularList };
      })();
    }

    setLoading(true);
    try {
      const result = await brandHomeInFlight;
      setBrandHomeCache<CachePayload>(result);
      setBrands(result.brands);
      setPopularBrands(result.popularBrands);
      setLoading(false);
    } catch {
      setLoading(false);
    } finally {
      brandHomeInFlight = null;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
              <Image
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
            onClick={() => router.push(`/brand/${brand.id}`)}
            className="flex w-full flex-col gap-2 transition-opacity duration-200 active:opacity-70"
          >
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-[#f5f5f7] ring-1 ring-[#17171c]/10">
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name_ko}
                  width={200}
                  height={200}
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
        <header className="sticky top-0 z-20 -mx-4 mb-4 flex h-12 items-center justify-between bg-white px-4">
          <h1 className="text-xl font-semibold">브랜드</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.push("/brand/search-input")}
            aria-label="검색"
          >
            <Search className="size-6" />
          </Button>
        </header>

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
            </section>
          </div>
        )}
      </main>
    </>
  );
}
