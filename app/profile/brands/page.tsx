"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, ChevronRight } from "lucide-react";

type LikedBrand = {
  brand_id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
};

const PAGE_SIZE = 12;

export default function ProfileBrandsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [brands, setBrands] = useState<LikedBrand[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
      return;
    }
    setPage(1);
  }, [user, loading, openLoginSheet]);

  useEffect(() => {
    if (!user || page === 0 || !hasMore) return;
    if (requestedPagesRef.current.has(page)) return;
    requestedPagesRef.current.add(page);

    const fetchPage = async () => {
      if (page === 1) setInitialLoading(true);
      else setLoadingMore(true);

      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data } = await supabase
          .from("brand_likes")
          .select("brand_id, ballet_brands(id, name_ko, name_en, logo_url)")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, to);

        const rows = (data ?? [])
          .filter((row) => row.ballet_brands !== null)
          .map((row) => ({
            brand_id: row.brand_id,
            name_ko: (row.ballet_brands as { name_ko: string; name_en: string | null; logo_url: string | null }).name_ko,
            name_en: (row.ballet_brands as { name_ko: string; name_en: string | null; logo_url: string | null }).name_en,
            logo_url: (row.ballet_brands as { name_ko: string; name_en: string | null; logo_url: string | null }).logo_url,
          }));

        setBrands((prev) => (page === 1 ? rows : [...prev, ...rows]));
        if (rows.length < PAGE_SIZE) setHasMore(false);
      } finally {
        if (page === 1) setInitialLoading(false);
        else setLoadingMore(false);
      }
    };

    fetchPage();
  }, [page, user, hasMore]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingMoreRef.current) {
        setPage((prev) => prev + 1);
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, initialLoading]);

  return (
    <MobileContainer>
      <main className="px-4 pb-10">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]"
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">찜한 브랜드</h1>
          <div className="w-10" />
        </header>

        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`brand-skeleton-${index}`}
                className="flex items-center gap-3 rounded-lg border border-[#17171c]/5 bg-white p-3"
              >
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-[#17171c]/60">
              첫번째 찜한 브랜드를 추가해보세요.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white px-4 shadow-sm">
            {brands.map((brand) => (
              <button
                key={brand.brand_id}
                type="button"
                className="flex w-full items-center gap-3 py-3 text-left"
                onClick={() => router.push(`/brand/${brand.brand_id}`)}
              >
                <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7]">
                  {brand.logo_url ? (
                    <AnimatedImage
                      src={brand.logo_url}
                      alt={brand.name_ko}
                      width={40}
                      height={40}
                      sizes="40px"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-[#17171c]">{brand.name_ko}</p>
                  {brand.name_en && (
                    <p className="truncate text-xs text-[#17171c]/50">{brand.name_en}</p>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-[#17171c]/30" />
              </button>
            ))}
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-6">
            <Spinner className="size-5 text-[#17171c]/30" />
          </div>
        )}

        <div ref={sentinelRef} />
      </main>
    </MobileContainer>
  );
}
