"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ChevronRight, MapPin } from "lucide-react";

type LocationStat = { name: string; count: number };

function LocationListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`location-skeleton-${index}`}
          className="flex h-[52px] items-center rounded-xl border border-[#17171c]/5 bg-white px-4 py-4"
        >
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function ProfileLocationsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [locations, setLocations] = useState<LocationStat[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
      return;
    }

    const fetchLocations = async () => {
      setListLoading(true);
      const data = await fetchAllRows<{ location: string | null }>((from, to) =>
        supabase
          .from("records")
          .select("location")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .range(from, to)
      );

      const counts: Record<string, number> = {};
      data.forEach((row) => {
        if (!row.location) return;
        const name = row.location.includes(" | ")
          ? row.location.split(" | ")[0].trim()
          : row.location.trim();
        if (!name) return;
        counts[name] = (counts[name] ?? 0) + 1;
      });

      setLocations(
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
          .map(([name, count]) => ({ name, count }))
      );
      setListLoading(false);
    };

    fetchLocations();
  }, [user, loading, openLoginSheet]);

  return (
    <MobileContainer>
      <main className="px-4 pb-10">
        <PageHeader title="장소별 기록" className="mb-6" />

        {loading || listLoading ? (
          <LocationListSkeleton />
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-[#17171c]/60">아직 기록된 장소가 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <button
                key={loc.name}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-[#17171c]/5 bg-white px-4 py-4 text-left active:opacity-70"
                onClick={() => {
                  sendHapticToApp();
                  router.push(`/profile/records?location=${encodeURIComponent(loc.name)}`);
                }}
              >
                <MapPin className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                <span className="flex-1 text-sm font-medium text-[#17171c]">
                  {loc.name}
                </span>
                <span className="shrink-0 text-xs text-[#17171c]/50">{loc.count}회</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#17171c]/30" />
              </button>
            ))}
          </div>
        )}
      </main>
    </MobileContainer>
  );
}
