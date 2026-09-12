"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import AnimatedImage from "@/components/ui/animated-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { isValidDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const PAGE_SIZE = 20;

type PerformanceItem = {
  mt20id: string;
  prfnm: string | null;
  prfpdfrom: string | null;
  prfpdto: string | null;
  fcltynm: string | null;
  poster: string | null;
};

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return null;
  const short = (value: string | null) => (value ? value.replaceAll("-", ".").slice(2) : "");
  if (from && to) return `${short(from)} ~ ${short(to)}`;
  return short(from ?? to);
}

function TicketSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 빈 날 탭으로 들어온 경우 관람 날짜가 이미 정해져 있다. S4까지 그대로 전달한다.
  const presetDate = searchParams.get("date");
  const dateParam = presetDate && isValidDateKey(presetDate) ? presetDate : null;

  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<PerformanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const dateQuery = useMemo(() => (dateParam ? `&date=${dateParam}` : ""), [dateParam]);

  const runSearch = useCallback(async () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    sendHapticToApp();
    setLoading(true);
    setSearched(true);
    try {
      // 원격 KOPIS API가 아니라 kopis_performances 테이블 직접 조회다
      // (search-input/page.tsx와 동일) — 레이트리밋·API 키를 고려할 필요가 없다.
      const { data, error } = await supabase
        .from("kopis_performances")
        .select("mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster")
        .is("deleted_at", null)
        .eq("is_active", true)
        .ilike("prfnm", `%${trimmed}%`)
        .order("prfpdfrom", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) {
        toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setItems(data ?? []);
    } catch {
      toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  // 검색 결과 객체를 통째로 들고 가지 않고 id만 넘긴다 — S4가 마운트될 때 다시 조회하므로
  // 새로고침·뒤로가기 후 재진입·WebView 재활성화 어느 경로로 들어와도 상태가 복원된다.
  const selectPerformance = (mt20id: string) => {
    sendHapticToApp();
    router.push(`/ticket-book/new/detail?performanceId=${encodeURIComponent(mt20id)}${dateQuery}`);
  };

  const goCustom = () => {
    sendHapticToApp();
    router.push(`/ticket-book/new/detail?custom=1${dateQuery}`);
  };

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col pb-24">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-1 bg-background px-1">
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <p className="text-lg font-bold">공연 선택</p>
        </header>

        <div className="flex items-center gap-2 px-4 pt-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#17171c]/40" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runSearch();
              }}
              placeholder="공연명을 검색해 보세요"
              className="h-12 pl-9 text-base placeholder:text-sm"
            />
          </div>
          <Button className="h-12 shrink-0 px-4" onClick={() => void runSearch()}>
            검색
          </Button>
        </div>

        {/* 직접 입력 진입은 검색 전·결과 없음·결과 있음 모든 상태에서 보이도록
            조건부 블록 밖에 둔다. */}
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={goCustom}
            className="text-sm text-[#17171c]/60 underline underline-offset-4"
          >
            찾는 공연이 없어요
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <ul className="mt-3 space-y-2 px-4">
            {items.map((item) => (
              <li key={item.mt20id}>
                <button
                  type="button"
                  onClick={() => selectPerformance(item.mt20id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#17171c]/5 bg-white p-3 text-left shadow-sm active:bg-[#17171c]/5"
                >
                  {/* poster는 NULL이 아니라 빈 문자열로 들어있는 공연이 있어 truthy 체크가 필수다 */}
                  {item.poster ? (
                    <AnimatedImage
                      src={item.poster}
                      alt=""
                      width={45}
                      height={64}
                      sizes="45px"
                      loading="lazy"
                      className="h-16 w-[45px] shrink-0 rounded-md bg-[#17171c]/5 object-cover"
                    />
                  ) : (
                    <div className="h-16 w-[45px] shrink-0 rounded-md bg-[#17171c]/5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.prfnm ?? "제목 없음"}</p>
                    {item.fcltynm && (
                      <p className="truncate text-xs text-[#17171c]/60">{item.fcltynm}</p>
                    )}
                    {formatPeriod(item.prfpdfrom, item.prfpdto) && (
                      <p className="mt-0.5 text-xs text-[#17171c]/40">
                        {formatPeriod(item.prfpdfrom, item.prfpdto)}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {searched && items.length === 0 && (
              <li className="py-10 text-center text-sm text-[#17171c]/50">
                조회된 공연이 없어요.
              </li>
            )}
          </ul>
        )}
      </main>
    </MobileContainer>
  );
}

export default function TicketNewPage() {
  return (
    <Suspense
      fallback={
        <MobileContainer>
          <main className="flex min-h-screen items-center justify-center">
            <Spinner size="lg" />
          </main>
        </MobileContainer>
      }
    >
      <TicketSearchContent />
    </Suspense>
  );
}
