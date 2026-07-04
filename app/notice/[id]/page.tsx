"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/authSession";
import { markNoticeReadInCache } from "@/lib/noticeReadStatusCache";

type NoticeDetail = {
  id: string;
  title: string;
  content: string;
  published_at: string | null;
};

type NoticeDetailPageProps = {
  params: Promise<{ id: string }>;
};

const formatPublishedDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};


export default function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { user, loading: authLoading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [noticeId, setNoticeId] = useState<string>("");
  const [item, setItem] = useState<NoticeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void params.then((resolved) => {
      if (!isMounted) return;
      setNoticeId(resolved.id ?? "");
    });
    return () => {
      isMounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!noticeId) return;

    const controller = new AbortController();
    const loadNotice = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/notices/${noticeId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 404) {
          setError("공지사항을 찾을 수 없어요.");
          setItem(null);
          return;
        }
        if (!response.ok) {
          throw new Error("공지사항을 불러오지 못했어요.");
        }

        const payload = (await response.json()) as { item?: NoticeDetail };

        if (!payload.item) {
          setError("공지사항을 찾을 수 없어요.");
          setItem(null);
          return;
        }
        setItem(payload.item);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("공지사항을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        setLoading(false);
      }
    };

    void loadNotice();
    return () => {
      controller.abort();
    };
  }, [noticeId]);

  useEffect(() => {
    const markNoticeAsRead = async () => {
      if (authLoading) return;
      if (!user || !item?.id) return;

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) return;

      const response = await fetch(`/api/notices/${item.id}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        // 서버 기록 성공 시 세션 캐시도 즉시 갱신 — 목록/프로필로 돌아가면 원이 바로 꺼짐
        markNoticeReadInCache(user.id, item.id);
      }
    };

    void markNoticeAsRead();
  }, [user, authLoading, item?.id, openLoginSheet]);

  return (
    <MobileContainer>
      <main className="px-4 pb-12">
        <PageHeader title="공지사항" className="mb-6" />

        {loading ? (
          <div className="space-y-4 rounded-xl border border-[#17171c]/5 bg-white p-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-5 text-sm text-[#17171c]/60">
            {error}
          </div>
        ) : null}

        {!loading && !error && item ? (
          <article className="space-y-4 rounded-xl border border-[#17171c]/5 bg-white p-4">
            <header className="space-y-2">
              <h2 className="text-base font-semibold text-[#17171c]">{item.title}</h2>
              <p className="text-xs text-[#17171c]/50">
                {formatPublishedDate(item.published_at)}
              </p>
            </header>
            <div>
              <p className="whitespace-pre-wrap text-sm text-[#17171c]/80">
                {item.content}
              </p>
            </div>
          </article>
        ) : null}
      </main>
    </MobileContainer>
  );
}
