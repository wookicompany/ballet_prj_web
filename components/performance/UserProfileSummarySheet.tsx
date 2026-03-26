"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import BottomSheet from "@/components/sheets/BottomSheet";
import { Spinner } from "@/components/ui/spinner";
import { formatCareerDuration } from "@/lib/kstDateTime";
import { User } from "lucide-react";

type UserSummary = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  ballet_started_at: string | null;
  record_count: number;
  total_record_minutes: number;
  review_count: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
};

const getDisplayNickname = (nickname: string | null | undefined, userId: string) => {
  const trimmed = nickname?.trim();
  if (trimmed) return trimmed;
  return userId.slice(0, 8);
};

export default function UserProfileSummarySheet({
  open,
  onOpenChange,
  userId,
}: Props) {
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, UserSummary>>({});

  useEffect(() => {
    if (!open || !userId) return;

    const cached = cacheRef.current[userId];
    if (cached) {
      setSummary(cached);
      setError(null);
      return;
    }

    let active = true;
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public-profiles/${userId}/summary`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("failed");
        }
        const payload = (await response.json()) as { item?: UserSummary };
        if (!payload.item) {
          throw new Error("empty");
        }
        if (!active) return;
        cacheRef.current[userId] = payload.item;
        setSummary(payload.item);
      } catch {
        if (!active) return;
        setSummary(null);
        setError("사용자 정보를 불러오지 못했어요.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void fetchSummary();
    return () => {
      active = false;
    };
  }, [open, userId]);

  const displayNickname = useMemo(() => {
    if (!summary) return "";
    return getDisplayNickname(summary.nickname, summary.id);
  }, [summary]);

  const careerDuration = useMemo(() => {
    if (!summary?.ballet_started_at) return null;
    return formatCareerDuration(summary.ballet_started_at);
  }, [summary]);

  const totalMinutes = summary?.total_record_minutes ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      showHeader={false}
    >
      {loading ? (
        <div className="flex h-36 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#17171c]/5 bg-[#17171c]/[0.02] p-4 text-sm text-[#17171c]/70">
          {error}
        </div>
      ) : summary ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-[#17171c]/10 bg-[#17171c]/5">
              {summary.avatar_url ? (
                <AnimatedImage
                  src={summary.avatar_url}
                  alt="프로필 이미지"
                  width={1600}
                  height={1600}
                  unoptimized
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#17171c]/60">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-[#17171c]">{displayNickname}</p>
              {careerDuration ? (
                <p className="mt-1 text-sm text-[#17171c]/70">
                  발레 경력{" "}
                  <span className="font-semibold text-[#17171c]">{careerDuration}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[#17171c]/10 rounded-xl border border-[#17171c]/5 bg-white py-3">
            <div className="flex flex-col items-center justify-center px-2">
              <p className="text-sm font-semibold leading-none text-[#17171c]">
                {summary.record_count}
              </p>
              <p className="mt-2 text-xs text-[#17171c]/60">발레 기록 수</p>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <p className="text-sm font-semibold leading-none text-[#17171c]">
                {hours}시간 {minutes}분
              </p>
              <p className="mt-2 text-xs text-[#17171c]/60">발레 기록 시간</p>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <p className="text-sm font-semibold leading-none text-[#17171c]">
                {summary.review_count}
              </p>
              <p className="mt-2 text-xs text-[#17171c]/60">리뷰 작성 수</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#17171c]/5 bg-[#17171c]/[0.02] p-4 text-sm text-[#17171c]/70">
          사용자 정보를 찾을 수 없어요.
        </div>
      )}
    </BottomSheet>
  );
}
