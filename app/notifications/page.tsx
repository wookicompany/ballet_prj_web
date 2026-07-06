"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/authSession";
import { getNotificationsCache, setNotificationsCache } from "@/lib/notificationsCache";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationsCachePayload = {
  items: NotificationItem[];
};

const formatRelativeTime = (value: string): string => {
  const now = new Date();
  const date = new Date(value);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${diffDay}일 전`;
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const cached = getNotificationsCache<NotificationsCachePayload>();

  const [items, setItems] = useState<NotificationItem[]>(() => cached?.items ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const initialized = useRef(false);

  const renderSkeleton = () => (
    <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`notification-skeleton-${index}`} className="px-4 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </section>
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      openLoginSheet();
      setLoading(false);
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const load = async () => {
      if (getNotificationsCache<NotificationsCachePayload>()) {
        setLoading(false);

        const accessToken = await getAccessToken(openLoginSheet);
        if (accessToken) {
          void fetch("/api/notifications/read-all", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            keepalive: true,
          }).catch(() => {
            // 실패해도 다음 진입 때 다시 읽음 처리되므로 무시
          });
        }
        return;
      }

      try {
        setLoading(true);
        const accessToken = await getAccessToken(openLoginSheet);
        if (!accessToken) {
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${accessToken}` };

        const [listRes] = await Promise.all([
          fetch("/api/notifications", { headers, cache: "no-store" }),
          fetch("/api/notifications/read-all", { method: "POST", headers }),
        ]);

        if (!listRes.ok) throw new Error("Failed");

        const payload = (await listRes.json()) as { items?: NotificationItem[] };
        const nextItems = Array.isArray(payload.items) ? payload.items : [];

        setItems(nextItems);
        setNotificationsCache<NotificationsCachePayload>({ items: nextItems });
      } catch {
        // 에러 시 빈 상태 유지
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user, authLoading, openLoginSheet]);

  return (
    <MobileContainer>
      <main className="px-4 pb-12">
        <PageHeader title="알림" className="mb-6" />

        {loading ? renderSkeleton() : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-5 text-sm text-[#17171c]/60">
            받은 알림이 없어요.
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
            {items.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-4 py-3 text-left"
                onClick={() => item.link && router.push(item.link)}
              >
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="inline-flex items-center gap-2 text-sm text-[#17171c]">
                    {!item.is_read ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF154A]" />
                    ) : null}
                    <span className="break-words">{item.title}</span>
                  </span>
                  {item.body ? (
                    <span className="text-xs text-[#17171c]/60 break-words">{item.body}</span>
                  ) : null}
                  <span className="text-xs text-[#17171c]/40">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </span>
              </Button>
            ))}
          </section>
        ) : null}
      </main>
    </MobileContainer>
  );
}
