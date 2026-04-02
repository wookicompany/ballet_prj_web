"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrandHomeCache } from "@/lib/brandHomeCache";

type Brand = {
  id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
  sort_order: number;
};

type CachePayload = { brands: Brand[] };

export default function BrandSearchInputPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [allBrands, setAllBrands] = useState<Brand[]>(() => {
    const cached = getBrandHomeCache<CachePayload>();
    return cached?.brands ?? [];
  });
  const [loading, setLoading] = useState(() => !getBrandHomeCache<CachePayload>());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (getBrandHomeCache<CachePayload>()) return;
    const fetchBrands = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/brands");
        if (!res.ok) return;
        const data = await res.json();
        setAllBrands(data.brands ?? []);
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allBrands;
    return allBrands.filter(
      (b) =>
        b.name_ko.toLowerCase().includes(q) ||
        (b.name_en?.toLowerCase().includes(q) ?? false)
    );
  }, [query, allBrands]);

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
            <ul className="divide-y divide-[#17171c]/5">
              {filtered.map((brand) => (
                <li key={brand.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/brand/${brand.id}`)}
                    className="flex w-full items-center gap-3 py-3 transition-opacity duration-200 active:opacity-70"
                  >
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7] ring-1 ring-[#17171c]/10">
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
          )}
        </div>
      </main>
    </>
  );
}
