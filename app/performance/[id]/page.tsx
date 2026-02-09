"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
              "mt20id,prfcast,prfcrew,prfruntime,prfage,entrpsnm,entrpsnmP,entrpsnmA,entrpsnmH,entrpsnmS,pcseguidance,sty,child,dtguidance,styurls,relates"
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
      <main className="px-4 pb-12 pt-6">
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
          <h1 className="text-base font-semibold">공연 상세</h1>
          <div className="w-9" />
        </header>

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
            <Card className="border-black/5">
              <CardContent className="space-y-4 p-4">
                <div className="flex gap-3">
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-black/5">
                    {detail.poster ? (
                      <img
                        src={detail.poster}
                        alt={`${detail.prfnm ?? "공연"} 포스터`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-[#17171c]">
                        {detail.prfnm || "공연명 미정"}
                      </h2>
                      {detail.prfstate ? (
                        <Badge variant="secondary" className="shrink-0">
                          {detail.prfstate}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#17171c]/60">
                      {formatDateRange(detail.prfpdfrom, detail.prfpdto)}
                    </p>
                    <p className="text-xs text-[#17171c]/60">
                      {detail.fcltynm || "공연장 정보 없음"}
                    </p>
                    <div className="flex flex-wrap gap-1 text-[11px] text-[#17171c]/60">
                      {detail.genrenm ? <span>{detail.genrenm}</span> : null}
                      {detail.area ? <span>· {detail.area}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm text-[#17171c]">
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
                  className="h-11 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
                  onClick={() =>
                    router.push(`/performance/${detail.mt20id}/reviews`)
                  }
                >
                  리뷰 보러가기
                </Button>
              </CardContent>
            </Card>

            <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4 text-sm text-[#17171c]">
              <h3 className="text-sm font-semibold">공연 정보</h3>
              <div className="space-y-2 text-[#17171c]/70">
                <p>출연진: {detail.prfcast || "정보 없음"}</p>
                <p>제작진: {detail.prfcrew || "정보 없음"}</p>
                <p>러닝타임: {detail.prfruntime || "정보 없음"}</p>
                <p>관람 연령: {detail.prfage || "정보 없음"}</p>
                <p>기획제작: {detail.entrpsnm || "정보 없음"}</p>
                <p>제작사: {detail.entrpsnmP || "정보 없음"}</p>
                <p>기획사: {detail.entrpsnmA || "정보 없음"}</p>
                <p>주최: {detail.entrpsnmH || "정보 없음"}</p>
                <p>주관: {detail.entrpsnmS || "정보 없음"}</p>
                <p>티켓가격: {detail.pcseguidance || "정보 없음"}</p>
                <p>공연시간: {detail.dtguidance || "정보 없음"}</p>
                <p>아동: {detail.child || "정보 없음"}</p>
              </div>
              <Separator className="bg-black/5" />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">줄거리</h4>
                <p className="whitespace-pre-line text-sm text-[#17171c]/70">
                  {detail.sty || "줄거리 정보가 없어요."}
                </p>
              </div>
            </section>

            {detail.styurls && detail.styurls.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[#17171c]">
                  소개 이미지
                </h3>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {detail.styurls.map((url, index) => (
                    <div
                      key={`${detail.mt20id}-sty-${index}`}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-black/5"
                    >
                      <img
                        src={url}
                        alt="소개 이미지"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

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
        )}
      </main>
    </MobileContainer>
  );
}
