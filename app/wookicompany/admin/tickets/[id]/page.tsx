"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, RefreshCw, Star } from "lucide-react";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AnimatedImage from "@/components/ui/animated-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";

type TicketDetail = {
  id: string;
  userId: string;
  nickname: string | null;
  performanceId: string | null;
  isCustom: boolean;
  title: string;
  venue: string | null;
  poster: string | null;
  watchedOn: string;
  rating: number | null;
  seat: string | null;
  createdAt: string;
  updatedAt: string;
};

type TicketReview = {
  id: string;
  rating: number;
  content: string | null;
  isPublic: boolean;
  createdAt: string;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b py-3 last:border-b-0">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-sm">{value}</div>
    </div>
  );
}

export default function AdminTicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const ticketId = params?.id;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [review, setReview] = useState<TicketReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        setError("티켓을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("티켓 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTicket(data.ticket);
      setImages(data.images ?? []);
      setReview(data.review ?? null);
    } catch {
      setError("티켓 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void fetchTicket();
  }, [fetchTicket]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="티켓 상세" />
        <Card>
          <CardContent className="space-y-2 pt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="티켓 상세" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error ?? "티켓을 찾을 수 없습니다."}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchTicket()}>
                다시 시도
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                목록으로
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="티켓 상세"
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchTicket()}>
            <RefreshCw className="mr-1.5 size-4" />
            새로고침
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>티켓 정보</CardTitle>
          {ticket.isCustom ? <Badge variant="secondary">직접 입력</Badge> : null}
        </CardHeader>
        <CardContent>
          <div className="flex gap-5">
            {ticket.poster ? (
              <AnimatedImage
                src={ticket.poster}
                alt=""
                width={112}
                height={160}
                sizes="112px"
                className="h-40 w-28 shrink-0 rounded-md bg-muted object-cover"
              />
            ) : (
              <div className="h-40 w-28 shrink-0 rounded-md bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <Row label="공연명" value={ticket.title} />
              <Row label="장소" value={ticket.venue ?? "-"} />
              <Row label="관람일" value={ticket.watchedOn} />
              <Row
                label="별점"
                value={
                  ticket.rating ? (
                    <span className="flex items-center gap-1">
                      <Star className="size-4 fill-current text-amber-500" />
                      {ticket.rating / 2}
                    </span>
                  ) : (
                    "-"
                  )
                }
              />
              <Row label="좌석" value={ticket.seat ?? "-"} />
              <Row
                label="작성자"
                value={
                  <Link
                    href={`/wookicompany/admin/members/${ticket.userId}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {ticket.nickname ?? ticket.userId}
                  </Link>
                }
              />
              <Row label="등록일" value={formatAdminDateTime(ticket.createdAt)} />
              <Row label="수정일" value={formatAdminDateTime(ticket.updatedAt)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>첨부 사진 ({images.length}장)</CardTitle>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">첨부된 사진이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {images.map((image) => (
                <a
                  key={image.id}
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block size-28 overflow-hidden rounded-md bg-muted"
                >
                  <AnimatedImage
                    src={image.url}
                    alt=""
                    width={112}
                    height={112}
                    sizes="112px"
                    className="size-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>연결된 리뷰</CardTitle>
          {/* 어드민은 공개 여부와 무관하게 리뷰를 보지만, 비공개인지는 알아야 한다. */}
          {review && !review.isPublic ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="size-3" />
              비공개
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {!review ? (
            <p className="text-sm text-muted-foreground">작성된 리뷰가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Star className="size-4 fill-current text-amber-500" />
                {review.rating / 2}
                <span className="text-muted-foreground">
                  {formatAdminDateTime(review.createdAt)}
                </span>
              </div>
              {review.content ? (
                <p className="whitespace-pre-line text-sm">{review.content}</p>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/wookicompany/admin/reviews/${review.id}`}>리뷰 관리에서 보기</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
