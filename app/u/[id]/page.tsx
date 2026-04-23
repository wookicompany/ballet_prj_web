import type { Metadata } from "next";
import Image from "next/image";
import { User } from "lucide-react";

import { formatCareerDuration } from "@/lib/kstDateTime";

type ProfileSummary = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  ballet_started_at: string | null;
  record_count: number;
  record_day_count: number;
  total_record_minutes: number;
  review_count: number;
};

type Params = { params: Promise<{ id: string }> };

const fetchSummary = async (id: string): Promise<ProfileSummary | null> => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    const res = await fetch(`${baseUrl}/api/public-profiles/${id}/summary`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.item ?? null;
  } catch {
    return null;
  }
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchSummary(id);

  if (!profile) {
    return { title: "마이발레" };
  }

  const nickname = profile.nickname?.trim() || id.slice(0, 8);
  const hours = Math.floor(profile.total_record_minutes / 60);
  const minutes = profile.total_record_minutes % 60;
  const timeText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  const description = `총 ${profile.record_day_count}일 · ${profile.record_count}회 · ${timeText} 발레 기록`;

  return {
    title: `${nickname}님의 발레 기록 | 마이발레`,
    description,
    openGraph: {
      title: `${nickname}님의 발레 기록`,
      description,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
  };
}

export default async function PublicProfilePage({ params }: Params) {
  const { id } = await params;
  const profile = await fetchSummary(id);

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-[#17171c]/60">존재하지 않는 프로필이에요.</p>
      </main>
    );
  }

  const nickname = profile.nickname?.trim() || id.slice(0, 8);
  const hours = Math.floor(profile.total_record_minutes / 60);
  const minutes = profile.total_record_minutes % 60;
  const careerDuration = profile.ballet_started_at
    ? formatCareerDuration(profile.ballet_started_at)
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8f8f8] px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        {/* 프로필 카드 */}
        <div className="rounded-2xl border border-[#17171c]/5 bg-white p-6 shadow-sm">
          {/* 아바타 + 닉네임 */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-[#17171c]/10 bg-[#17171c]/5">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={`${nickname} 프로필 이미지`}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#17171c]/40">
                  <User className="size-8" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[#17171c]">{nickname}</p>
              {careerDuration ? (
                <p className="mt-0.5 text-sm text-[#17171c]/60">
                  발레 경력{" "}
                  <span className="font-semibold text-[#17171c]">
                    {careerDuration}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          {/* 통계 */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-[#17171c]/10 rounded-xl border border-[#17171c]/5 py-3">
            <div className="flex flex-col items-center justify-center px-2">
              <p className="text-sm font-semibold leading-none text-[#17171c]">
                {profile.record_day_count}일
              </p>
              <p className="mt-2 text-xs text-[#17171c]/60">기록 일 수</p>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <p className="text-sm font-semibold leading-none text-[#17171c]">
                {profile.record_count}회
              </p>
              <p className="mt-2 text-xs text-[#17171c]/60">기록 횟수</p>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <p className="text-sm font-semibold leading-none text-[#17171c]">
                {hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`}
              </p>
              <p className="mt-2 text-xs text-[#17171c]/60">기록 시간</p>
            </div>
          </div>
        </div>

        {/* 앱 다운로드 CTA */}
        <div className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm text-center space-y-3">
          <p className="text-sm font-semibold text-[#17171c]">
            나의 발레를 기록해보세요
          </p>
          <p className="text-xs text-[#17171c]/60 leading-relaxed">
            마이발레에서 수업 기록, 공연 리뷰, 발레 브랜드를{" "}
            <br />
            한곳에서 관리할 수 있어요.
          </p>
          <a
            href="https://apps.apple.com/app/id6744847822"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-[#17171c] py-3 text-sm font-semibold text-white active:opacity-80"
          >
            앱 다운받기
          </a>
        </div>
      </div>
    </main>
  );
}
