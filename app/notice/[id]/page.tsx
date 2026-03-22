"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { ChevronLeft } from "lucide-react";

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
  const router = useRouter();
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

    let isMounted = true;
    const loadNotice = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/notices/${noticeId}`, {
          cache: "no-store",
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
        if (!isMounted) return;

        if (!payload.item) {
          setError("공지사항을 찾을 수 없어요.");
          setItem(null);
          return;
        }
        setItem(payload.item);
      } catch {
        if (!isMounted) return;
        setError("공지사항을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadNotice();
    return () => {
      isMounted = false;
    };
  }, [noticeId]);

  useEffect(() => {
    const markNoticeAsRead = async () => {
      if (authLoading) return;
      if (!user || !item?.id) return;

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) return;

      await fetch(`/api/notices/${item.id}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    };

    void markNoticeAsRead();
  }, [user, authLoading, item?.id, openLoginSheet]);

  return (
    <MobileContainer>
      <main className="px-4 pb-12">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
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
          <h1 className="text-base font-semibold">공지사항</h1>
          <div className="w-9" />
        </header>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-black/5 bg-white px-4 py-5 text-sm text-[#17171c]/60">
            {error}
          </div>
        ) : null}

        {!loading && !error && item ? (
          <article className="space-y-4 rounded-xl border border-black/5 bg-white p-4">
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
