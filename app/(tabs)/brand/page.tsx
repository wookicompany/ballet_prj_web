"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <>
      <main className="px-4 pb-16">
        <header className="sticky top-0 z-20 bg-white -mx-4 px-4 h-12 mb-4 flex items-center justify-between">
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

        <div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="aspect-square w-full rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : brands.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-[#17171c]/40">
                아직 등록된 브랜드가 없어요.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {brands.map((brand) => (
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
                      <span className="text-sm font-medium text-[#17171c] truncate text-left">
                        {brand.name_ko}
                      </span>
                      {brand.name_en && (
                        <span className="text-xs text-[#17171c]/50 truncate text-left">
                          {brand.name_en}
                        </span>
                      )}
                    </div>
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
