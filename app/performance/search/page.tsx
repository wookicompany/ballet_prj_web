"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Search } from "lucide-react";
import { toast } from "sonner";

type PerformanceItem = {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string | null;
  prfpdto: string | null;
  fcltynm: string | null;
  poster: string | null;
  genrenm: string | null;
  prfstate: string | null;
  area: string | null;
};

const SECTION_CONFIG = {
  popular: {
    title: "인기 공연",
    copy: "지금 가장 반응이 많은 공연이에요.",
  },
  scheduled: {
    title: "공연예정",
    copy: "곧 만날 수 있는 공연을 모았어요.",
    prfstate: "공연예정",
  },
  ongoing: {
    title: "공연중",
    copy: "지금 바로 관람할 수 있어요.",
    prfstate: "공연중",
  },
  completed: {
    title: "공연 완료",
    copy: "막을 내린 공연을 모아봤어요.",
    prfstate: "공연완료",
  },
  visit: {
    title: "내한공연",
    copy: "해외 팀이 방문하는 공연만 모았어요.",
    detailFlag: "visit",
  },
  child: {
    title: "아동극",
    copy: "아이와 함께 보기 좋은 공연이에요.",
    detailFlag: "child",
  },
} as const;

const formatDateRange = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "공연 기간 정보 없음";
  const start = from ? from.replace(/-/g, ".") : "미정";
  const end = to ? to.replace(/-/g, ".") : "미정";
  return `${start} ~ ${end}`;
};

export default function PerformanceSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionKey = searchParams.get("section") ?? "";
  const sectionConfig =
    (SECTION_CONFIG as Record<string, (typeof SECTION_CONFIG)[keyof typeof SECTION_CONFIG]>)[
      sectionKey
    ] ?? null;
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(
    () => today.toISOString().slice(0, 10),
    [today]
  );
  const defaultEnd = useMemo(() => {
    const next = new Date(today);
    next.setMonth(next.getMonth() + 3);
    return next.toISOString().slice(0, 10);
  }, [today]);

  const [filters, setFilters] = useState(() => ({
    keyword: "",
    startDate: sectionConfig ? "" : defaultStart,
    endDate: sectionConfig ? "" : defaultEnd,
  }));
  const [draft, setDraft] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PerformanceItem[]>([]);

  useEffect(() => {
    const nextFilters = {
      keyword: "",
      startDate: sectionConfig ? "" : defaultStart,
      endDate: sectionConfig ? "" : defaultEnd,
    };
    setFilters(nextFilters);
    setDraft(nextFilters);
  }, [defaultEnd, defaultStart, sectionConfig]);

  const fetchPerformances = useCallback(async () => {
    setLoading(true);
    let ids: string[] | null = null;
    let orderedIds: string[] | null = null;
    const baseSelect =
      "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,prfstate,area";

    if (filters.keyword) {
      const keywordLike = `%${filters.keyword}%`;
      const [{ data: nameMatches }, { data: castMatches }] = await Promise.all([
        supabase
          .from("kopis_performances")
          .select("mt20id")
          .ilike("prfnm", keywordLike),
        supabase
          .from("kopis_performance_details")
          .select("mt20id")
          .ilike("prfcast", keywordLike),
      ]);
      const idSet = new Set<string>();
      (nameMatches ?? []).forEach((row) => {
        if (row.mt20id) idSet.add(row.mt20id);
      });
      (castMatches ?? []).forEach((row) => {
        if (row.mt20id) idSet.add(row.mt20id);
      });
      ids = Array.from(idSet);
      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
    }

    if (sectionConfig?.detailFlag) {
      const { data: detailRows, error: detailError } = await supabase
        .from("kopis_performance_details")
        .select("mt20id")
        .is("deleted_at", null)
        .eq("is_active", true)
        .eq(sectionConfig.detailFlag, "Y")
        .order("updatedate", { ascending: false })
        .limit(300);

      if (detailError) {
        toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setItems([]);
        setLoading(false);
        return;
      }

      const detailIds = (detailRows ?? [])
        .map((row) => row.mt20id)
        .filter(Boolean);
      orderedIds = detailIds;
      ids = ids ? ids.filter((id) => detailIds.includes(id)) : detailIds;
      if (!ids.length) {
        setItems([]);
        setLoading(false);
        return;
      }
    }

    if (sectionKey === "popular") {
      const { data: reviewRows, error: reviewError } = await supabase
        .from("performance_reviews")
        .select("performance_id,rating")
        .is("deleted_at", null);

      if (reviewError) {
        toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setItems([]);
        setLoading(false);
        return;
      }

      const ratingSummary: Record<string, { count: number; avg: number }> = {};
      (reviewRows ?? []).forEach((row) => {
        if (!row.performance_id) return;
        const current = ratingSummary[row.performance_id] ?? {
          count: 0,
          avg: 0,
        };
        const nextCount = current.count + 1;
        const nextAvg = (current.avg * current.count + row.rating) / nextCount;
        ratingSummary[row.performance_id] = { count: nextCount, avg: nextAvg };
      });

      const popularIds = Object.entries(ratingSummary)
        .sort(
          (a, b) =>
            b[1].count - a[1].count || b[1].avg - a[1].avg
        )
        .map(([id]) => id);

      orderedIds = popularIds;
      ids = ids ? ids.filter((id) => popularIds.includes(id)) : popularIds;
      if (!ids.length && filters.keyword) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (!ids.length && !filters.keyword) {
        ids = null;
        orderedIds = null;
      }
    }

    let query = supabase
      .from("kopis_performances")
      .select(baseSelect)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("prfpdfrom", { ascending: true });

    if (sectionConfig?.prfstate) {
      query = query.eq("prfstate", sectionConfig.prfstate);
    }

    if (filters.startDate) {
      query = query.gte("prfpdto", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("prfpdfrom", filters.endDate);
    }
    if (ids && ids.length) {
      query = query.in("mt20id", ids);
    }

    const { data, error } = await query;
    if (error) {
      toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setItems([]);
      setLoading(false);
      return;
    }

    const fetched = (data as PerformanceItem[]) ?? [];
    const ordered =
      orderedIds && orderedIds.length
        ? fetched.sort(
            (a, b) => orderedIds.indexOf(a.mt20id) - orderedIds.indexOf(b.mt20id)
          )
        : fetched;
    setItems(ordered);
    setLoading(false);
  }, [filters, sectionConfig, sectionKey]);

  useEffect(() => {
    fetchPerformances();
  }, [fetchPerformances]);

  return (
    <MobileContainer>
      <main className="px-4 pb-16 pt-6">
        <header className="mb-6 flex items-center justify-between">
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
          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold">
              {sectionConfig?.title ?? "공연 검색"}
            </h1>
            {sectionConfig?.copy ? (
              <p className="text-xs text-[#17171c]/60">{sectionConfig.copy}</p>
            ) : null}
          </div>
          <div className="w-9" />
        </header>

        <section className="space-y-3 rounded-xl border border-black/5 bg-white p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[#17171c]/40" />
            <Input
              value={draft.keyword}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, keyword: event.target.value }))
              }
              placeholder="공연명, 출연진으로 검색"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={draft.startDate}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, startDate: event.target.value }))
              }
              className="h-10"
            />
            <Input
              type="date"
              value={draft.endDate}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, endDate: event.target.value }))
              }
              className="h-10"
            />
          </div>
          <Button
            type="button"
            className="h-11 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={() => setFilters({ ...draft, keyword: draft.keyword.trim() })}
          >
            조회하기
          </Button>
        </section>

        <section className="mt-6 space-y-3">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-[#17171c]/60">
              조회된 공연이 없어요.
            </div>
          ) : (
            items.map((item) => (
              <Card key={item.mt20id} className="border-black/5">
                <CardContent className="flex gap-3 p-4">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={`${item.prfnm} 포스터`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-sm font-semibold text-[#17171c]">
                        {item.prfnm}
                      </h2>
                      {item.prfstate ? (
                        <Badge variant="secondary" className="shrink-0">
                          {item.prfstate}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#17171c]/60">
                      {formatDateRange(item.prfpdfrom, item.prfpdto)}
                    </p>
                    <p className="text-xs text-[#17171c]/60">
                      {item.fcltynm || "공연장 정보 없음"}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1 text-[11px] text-[#17171c]/60">
                      {item.genrenm ? <span>{item.genrenm}</span> : null}
                      {item.area ? <span>· {item.area}</span> : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8"
                      onClick={() => router.push(`/performance/${item.mt20id}`)}
                    >
                      상세 보기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </main>
    </MobileContainer>
  );
}
