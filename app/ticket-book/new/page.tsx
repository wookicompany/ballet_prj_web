"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import AnimatedImage from "@/components/ui/animated-image";
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

  // 입력 중 여러 요청이 동시에 떠 있을 수 있다. 순번을 매겨 "마지막 요청의 응답"만
  // 반영한다 — 없으면 "백조"를 치는 도중 먼저 보낸 "백"의 결과가 늦게 도착해 덮어쓴다.
  const requestSeqRef = useRef(0);

  const runSearch = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    if (!trimmed) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
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

      if (seq !== requestSeqRef.current) return; // 더 최신 요청이 있다 — 이 응답은 버린다

      if (error) {
        toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setLoading(false);
        return;
      }
      setItems(data ?? []);
      setSearched(true);
      setLoading(false);
    } catch {
      if (seq !== requestSeqRef.current) return;
      toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  }, []);

  // 입력이 멈추면 자동 조회. 어드민 공지 검색과 같은 300ms를 쓴다.
  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(keyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, runSearch]);

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
        <PageHeader title="공연 선택" />

        <div className="px-4 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#17171c]/40" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="공연명을 검색해 보세요"
              className="h-12 pl-9 text-base placeholder:text-sm"
            />
          </div>
        </div>

        {/* 직접 입력 진입은 검색 전·결과 없음·결과 있음 모든 상태에서 보이도록
            조건부 블록 밖에 둔다. */}
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={goCustom}
            className="flex min-h-11 items-center text-sm text-[#17171c]/60 underline underline-offset-4"
          >
            찾는 공연이 없어요
          </button>
        </div>

        {/* 타이핑 중에는 이전 결과를 그대로 두고 스피너로 가리지 않는다 — 한 글자마다
            목록이 스피너로 바뀌면 화면이 심하게 깜빡인다. 보여줄 결과가 아직 없을 때만
            스피너를 띄운다. */}
        {loading && items.length === 0 ? (
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
            {searched && !loading && items.length === 0 && (
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
