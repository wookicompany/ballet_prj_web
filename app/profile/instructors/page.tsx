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
import { ChevronRight, UserRound } from "lucide-react";

type InstructorStat = { name: string; count: number };

function InstructorListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`instructor-skeleton-${index}`}
          className="flex h-[52px] items-center rounded-xl border border-[#17171c]/5 bg-white px-4 py-4"
        >
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function ProfileInstructorsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [instructors, setInstructors] = useState<InstructorStat[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
      return;
    }

    const fetchInstructors = async () => {
      setListLoading(true);
      const data = await fetchAllRows<{ instructor: string | null }>((from, to) =>
        supabase
          .from("records")
          .select("instructor")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .range(from, to)
      );

      const counts: Record<string, number> = {};
      data.forEach((row) => {
        if (!row.instructor) return;
        const name = row.instructor.trim();
        if (!name) return;
        counts[name] = (counts[name] ?? 0) + 1;
      });

      setInstructors(
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
          .map(([name, count]) => ({ name, count }))
      );
      setListLoading(false);
    };

    fetchInstructors();
  }, [user, loading, openLoginSheet]);

  return (
    <MobileContainer>
      <main className="px-4 pb-10">
        <PageHeader title="선생님별 기록" className="mb-6" />

        {loading || listLoading ? (
          <InstructorListSkeleton />
        ) : instructors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-[#17171c]/60">아직 기록된 선생님이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {instructors.map((ins) => (
              <button
                key={ins.name}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-[#17171c]/5 bg-white px-4 py-4 text-left active:opacity-70"
                onClick={() => {
                  sendHapticToApp();
                  router.push(`/profile/records?instructor=${encodeURIComponent(ins.name)}`);
                }}
              >
                <UserRound className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                <span className="flex-1 text-sm font-medium text-[#17171c]">
                  {ins.name}
                </span>
                <span className="shrink-0 text-xs text-[#17171c]/50">{ins.count}회</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#17171c]/30" />
              </button>
            ))}
          </div>
        )}
      </main>
    </MobileContainer>
  );
}
