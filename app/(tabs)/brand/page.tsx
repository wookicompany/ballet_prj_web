"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrandHomeCache, setBrandHomeCache } from "@/lib/brandHomeCache";

type Brand = {
  id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
  sort_order: number;
};

type CachePayload = { brands: Brand[] };

export default function BrandPage() {
  const router = useRouter();
  const cached = getBrandHomeCache<CachePayload>();
  const [brands, setBrands] = useState<Brand[]>(() => cached?.brands ?? []);
  const [loading, setLoading] = useState(() => !cached);

  useEffect(() => {
    if (getBrandHomeCache<CachePayload>()) return;
    const fetchBrands = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/brands");
        if (!res.ok) return;
        const data = await res.json();
        const list: Brand[] = data.brands ?? [];
        setBrands(list);
        setBrandHomeCache<CachePayload>({ brands: list });
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col bg-white pb-[calc(56px+env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between bg-white px-4">
          <h1 className="text-xl font-semibold text-[#17171c]">브랜드</h1>
          <button
            type="button"
            onClick={() => router.push("/brand/search-input")}
            className="flex size-9 items-center justify-center rounded-full hover:bg-[#17171c]/5"
          >
            <Search className="size-5 text-[#17171c]" />
          </button>
        </header>

        <div className="flex-1">
          {loading ? (
            <div className="divide-y divide-[#17171c]/5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-16 rounded-xl shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : brands.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-24">
              <p className="text-sm text-[#17171c]/40">
                아직 등록된 브랜드가 없어요.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#17171c]/5">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/brand/${brand.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[#17171c]/[0.02] active:bg-[#17171c]/5"
                  >
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-[#17171c]/5 bg-[#f5f5f7]">
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
    </MobileContainer>
  );
}
