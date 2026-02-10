"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ImageViewer from "@/components/ui/image-viewer";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Star } from "lucide-react";
import { toast } from "sonner";

type PerformanceDetail = {
  mt20id: string;
  prfnm: string | null;
  prfpdfrom: string | null;
  prfpdto: string | null;
  fcltynm: string | null;
  poster: string | null;
  genrenm: string | null;
  prfstate: string | null;
  area: string | null;
  prfcast: string | null;
  prfcrew: string | null;
  prfruntime: string | null;
  prfage: string | null;
  entrpsnm: string | null;
  entrpsnmP: string | null;
  entrpsnmA: string | null;
  entrpsnmH: string | null;
  entrpsnmS: string | null;
  pcseguidance: string | null;
  sty: string | null;
  child: string | null;
  dtguidance: string | null;
  styurls: string[] | null;
  relates: string[] | null;
};

const formatOptionalText = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const formatOrFallback = (value: string | null | undefined, fallback: string) =>
  formatOptionalText(value) ?? fallback;

const formatDateRange = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "공연 기간 정보 없음";
  const start = from ? from.replace(/-/g, ".") : "미정";
  const end = to ? to.replace(/-/g, ".") : "미정";
  return `${start} ~ ${end}`;
};

export default function PerformanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const performanceId = params.id;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewAverage, setReviewAverage] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      const [{ data: listData, error: listError }, { data: detailData }] =
        await Promise.all([
          supabase
            .from("kopis_performances")
            .select(
              "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,prfstate,area"
            )
            .eq("mt20id", performanceId)
            .maybeSingle(),
          supabase
            .from("kopis_performance_details")
            .select(
              "mt20id,prfcast,prfcrew,prfruntime,prfage,entrpsnm,entrpsnm_p,entrpsnm_a,entrpsnm_h,entrpsnm_s,pcseguidance,sty,child,dtguidance,styurls,relates"
            )
            .eq("mt20id", performanceId)
            .maybeSingle(),
        ]);

      if (listError || !listData) {
        toast("공연 정보를 불러오지 못했어요.");
        setDetail(null);
        setLoading(false);
        return;
      }

    const merged: PerformanceDetail = {
      ...(listData as PerformanceDetail),
      ...(detailData as Partial<PerformanceDetail>),
      entrpsnmP: detailData?.entrpsnm_p ?? null,
      entrpsnmA: detailData?.entrpsnm_a ?? null,
      entrpsnmH: detailData?.entrpsnm_h ?? null,
      entrpsnmS: detailData?.entrpsnm_s ?? null,
    };
      setDetail(merged);

      const { data: reviews } = await supabase
        .from("performance_reviews")
        .select("rating")
        .eq("performance_id", performanceId)
        .is("deleted_at", null);

      if (reviews && reviews.length > 0) {
        const total = reviews.reduce((sum, row) => sum + row.rating, 0);
        setReviewCount(reviews.length);
        setReviewAverage(Math.round((total / reviews.length) * 10) / 10);
      } else {
        setReviewCount(0);
        setReviewAverage(null);
      }
      setLoading(false);
    };

    fetchDetail();
  }, [performanceId]);

  return (
    <MobileContainer>
      <main className="pb-12">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : !detail ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[#17171c]/60">
            공연 정보를 찾을 수 없어요.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="relative h-[360px] w-full overflow-hidden bg-black/5">
              {detail.poster ? (
                <>
                  <img
                    src={detail.poster}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-2xl"
                  />
                  <div className="absolute inset-0 bg-black/10" />
                  <img
                    src={detail.poster}
                    alt={`${detail.prfnm ?? "공연"} 포스터`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#17171c]/50">
                  포스터 이미지 없음
                </div>
              )}
              <header className="relative z-10 flex items-center justify-between px-4 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="text-white/80"
                  onClick={() => router.back()}
                  aria-label="뒤로"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <div className="w-9" />
              </header>
            </section>

            <div className="space-y-4 px-4">
              <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#17171c]/60">
                  {detail.prfstate ? (
                    <Badge variant="secondary">{detail.prfstate}</Badge>
                  ) : null}
                  {detail.genrenm ? <span>{detail.genrenm}</span> : null}
                  {detail.area ? <span>· {detail.area}</span> : null}
                </div>
                <h1 className="mt-2 text-base font-semibold text-[#17171c]">
                  {detail.prfnm || "공연명 미정"}
                </h1>
                <p className="mt-1 text-xs text-[#17171c]/70">
                  {formatDateRange(detail.prfpdfrom, detail.prfpdto)}
                </p>
                <p className="text-xs text-[#17171c]/70">
                  {formatOrFallback(detail.fcltynm, "공연장 정보 없음")}
                </p>
              </section>
              <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4 text-xs text-[#17171c]">
                <h3 className="text-xs font-semibold">공연 정보</h3>
                <div className="space-y-2 text-[#17171c]/70">
                  {[
                    { label: "출연진", value: detail.prfcast },
                    { label: "제작진", value: detail.prfcrew },
                    { label: "러닝타임", value: detail.prfruntime },
                    { label: "관람 연령", value: detail.prfage },
                    { label: "기획제작", value: detail.entrpsnm },
                    { label: "제작사", value: detail.entrpsnmP },
                    { label: "기획사", value: detail.entrpsnmA },
                    { label: "주최", value: detail.entrpsnmH },
                    { label: "주관", value: detail.entrpsnmS },
                    { label: "티켓가격", value: detail.pcseguidance },
                    { label: "공연시간", value: detail.dtguidance },
                  ]
                    .map((item) => ({
                      label: item.label,
                      value: formatOptionalText(item.value),
                    }))
                    .filter((item) => item.value)
                    .map((item) => (
                      <p key={item.label}>
                        {item.label}: {item.value}
                      </p>
                    ))}
                  {![
                    detail.prfcast,
                    detail.prfcrew,
                    detail.prfruntime,
                    detail.prfage,
                    detail.entrpsnm,
                    detail.entrpsnmP,
                    detail.entrpsnmA,
                    detail.entrpsnmH,
                    detail.entrpsnmS,
                    detail.pcseguidance,
                    detail.dtguidance,
                  ]
                    .map(formatOptionalText)
                    .some(Boolean) ? <p>정보 없음</p> : null}
                </div>
                {formatOptionalText(detail.sty) ? (
                  <>
                    <Separator className="bg-black/5" />
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold">줄거리</h4>
                      <p className="whitespace-pre-line text-xs text-[#17171c]/70">
                        {formatOptionalText(detail.sty)}
                      </p>
                    </div>
                  </>
                ) : null}
              </section>

            {detail.styurls && detail.styurls.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#17171c]">
                    소개 이미지
                  </h3>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {detail.styurls.map((url, index) => (
                    <button
                        key={`${detail.mt20id}-sty-${index}`}
                      type="button"
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-black/5"
                      onClick={() => {
                        setViewerUrl(url);
                        setViewerOpen(true);
                      }}
                      aria-label="소개 이미지 크게 보기"
                      >
                        <img
                          src={url}
                          alt="소개 이미지"
                          className="h-full w-full object-cover"
                        />
                    </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-[#17171c]">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-[#ff273d]" />
                  {reviewAverage !== null ? (
                    <span>
                      평균 {reviewAverage}점 · 리뷰 {reviewCount}개
                    </span>
                  ) : (
                    <span>아직 리뷰가 없어요.</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-[#17171c] text-white hover:bg-[#17171c]/90"
                  onClick={() =>
                    router.push(`/performance/${detail.mt20id}/reviews`)
                  }
                >
                  리뷰 보기
                </Button>
              </div>

              {detail.relates && detail.relates.length > 0 ? (
                <section className="space-y-2 rounded-xl border border-black/5 bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#17171c]">
                    예매처
                  </h3>
                  <div className="space-y-1 text-sm text-[#17171c]/70">
                    {detail.relates.map((relate, index) => (
                      <p key={`${detail.mt20id}-relate-${index}`}>{relate}</p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </main>
      <ImageViewer
        isOpen={viewerOpen}
        imageUrl={viewerUrl}
        alt="소개 이미지 크게 보기"
        onClose={() => setViewerOpen(false)}
      />
    </MobileContainer>
  );
}
