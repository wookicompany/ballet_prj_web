"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/authSession";
import { getNoticeCache, setNoticeCache } from "@/lib/noticeCache";
import { ChevronLeft, ChevronRight } from "lucide-react";

type NoticeListItem = {
  id: string;
  title: string;
  published_at: string | null;
};

type NoticeCachePayload = {
  items: NoticeListItem[];
  readNoticeIds: string[];
  isReadStatusReady: boolean;
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

export default function NoticePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const cached = getNoticeCache<NoticeCachePayload>();

  const [items, setItems] = useState<NoticeListItem[]>(() => cached?.items ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => cached?.readNoticeIds ?? []);
  const [isReadStatusReady, setIsReadStatusReady] = useState(() => cached?.isReadStatusReady ?? false);

  const renderNoticeSkeleton = () => (
    <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`notice-skeleton-${index}`} className="px-4 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </section>
  );

  useEffect(() => {
    if (getNoticeCache<NoticeCachePayload>()) return;
    let isMounted = true;

    const loadNotices = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/notices", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("공지사항을 불러오지 못했어요.");
        }

        const payload = (await response.json()) as { items?: NoticeListItem[] };
        if (!isMounted) return;
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        setItems(nextItems);
        setNoticeCache<NoticeCachePayload>({
          items: nextItems,
          readNoticeIds: [],
          isReadStatusReady: false,
        });
      } catch {
        if (!isMounted) return;
        setError("공지사항을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadNotices();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchReadStatus = async () => {
      if (authLoading) return;
      if (!user) {
        setReadNoticeIds([]);
        setIsReadStatusReady(true);
        return;
      }

      setIsReadStatusReady(false);
      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setReadNoticeIds([]);
        setIsReadStatusReady(true);
        return;
      }

      const response = await fetch("/api/notices/read-status", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        setReadNoticeIds([]);
        setIsReadStatusReady(true);
        return;
      }
      const payload = (await response.json()) as { read_notice_ids?: string[] };
      const nextIds = Array.isArray(payload.read_notice_ids) ? payload.read_notice_ids : [];
      setReadNoticeIds(nextIds);
      setIsReadStatusReady(true);

      const existing = getNoticeCache<NoticeCachePayload>();
      if (existing) {
        setNoticeCache<NoticeCachePayload>({
          ...existing,
          readNoticeIds: nextIds,
          isReadStatusReady: true,
        });
      }
    };

    void fetchReadStatus();
  }, [user, authLoading, openLoginSheet]);

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
          renderNoticeSkeleton()
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-5 text-sm text-[#17171c]/60">
            {error}
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-5 text-sm text-[#17171c]/60">
            등록된 공지사항이 아직 없어요.
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
            {items.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between px-4 py-3 text-left"
                onClick={() => router.push(`/notice/${item.id}`)}
              >
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1 pr-3">
                  <span className="inline-flex items-center gap-2 truncate text-sm text-[#17171c]">
                    {isReadStatusReady && !readNoticeIds.includes(item.id) ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF154A]" />
                    ) : null}
                    <span className="truncate">{item.title}</span>
                  </span>
                  <span className="text-xs text-[#17171c]/50">
                    {formatPublishedDate(item.published_at)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#17171c]/40" />
              </Button>
            ))}
          </section>
        ) : null}
      </main>
    </MobileContainer>
  );
}
