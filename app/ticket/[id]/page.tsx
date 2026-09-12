"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Lock, Menu, NotebookPen, PenLine, Sofa, Star, Trash2 } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import BottomSheet from "@/components/sheets/BottomSheet";
import AnimatedImage from "@/components/ui/animated-image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/ui/image-viewer";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { parseDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { markTicketChanged } from "@/lib/ticketBookCache";
import { toast } from "sonner";

type TicketDetail = {
  id: string;
  performanceId: string | null;
  customTitle: string | null;
  customVenue: string | null;
  watchedOn: string;
  rating: number | null;
  seat: string | null;
  memo: string | null;
  reviewId: string | null;
};

type TicketReview = {
  id: string;
  rating: number;
  content: string | null;
  isPublic: boolean;
  createdAt: string;
};

type PerformanceInfo = {
  mt20id: string;
  prfnm: string | null;
  fcltynm: string | null;
  poster: string | null;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatWatchedOn(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, "0")}월 ${String(date.getDate()).padStart(2, "0")}일(${WEEKDAYS[date.getDay()]})`;
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const ticketId = params?.id;
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [performance, setPerformance] = useState<PerformanceInfo | null>(null);
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [review, setReview] = useState<TicketReview | null>(null);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticketId || !user) return;
    setFetching(true);
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setFetching(false);
      return;
    }
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 404 || res.status === 403) {
        setNotFound(true);
        setFetching(false);
        return;
      }
      if (!res.ok) {
        toast("티켓 정보를 불러오지 못했어요.");
        setFetching(false);
        return;
      }
      const json = await res.json();
      setTicket(json.ticket);
      setPerformance(json.performance);
      setImages(json.images ?? []);
      setReview(json.review ?? null);
    } catch {
      toast("티켓 정보를 불러오지 못했어요.");
    } finally {
      setFetching(false);
    }
  }, [ticketId, user, openLoginSheet]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setFetching(false);
      return;
    }
    void load();
  }, [loading, user, load]);

  // 상세·수정 화면은 자체 read 캐시를 두지 않는다(코드베이스의 상세 화면 관례).
  // 수정 후 돌아왔을 때만 다시 읽는다.
  useEffect(() => {
    const handleRefresh = () => {
      if (!user) return;
      void load();
    };
    window.addEventListener("pageshow", handleRefresh);
    return () => window.removeEventListener("pageshow", handleRefresh);
  }, [user, load]);

  const handleDelete = async () => {
    if (deleting || !ticketId) return;
    setDeleting(true);
    sendHapticToApp();
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setDeleting(false);
      return;
    }
    try {
      const res = await fetch(`/api/tickets/${ticketId}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setDeleting(false);
        toast("티켓을 삭제하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      markTicketChanged(ticketId);
      router.replace("/ticket-book");
    } catch {
      setDeleting(false);
      toast("티켓을 삭제하지 못했어요. 다시 시도해 주세요.");
    }
  };

  if (loading || fetching) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="px-4 pb-10">
          <PageHeader title="티켓 상세" className="mb-6" />
          <p className="mt-20 text-center text-sm text-[#17171c]/60">
            로그인하면 티켓을 볼 수 있어요
          </p>
          <Button className="mx-auto mt-4 flex h-12 w-full max-w-[240px]" onClick={() => openLoginSheet()}>
            로그인하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  if (notFound || !ticket) {
    return (
      <MobileContainer>
        <main className="px-4 pb-10">
          <PageHeader title="티켓 상세" className="mb-6" />
          <p className="mt-20 text-center text-sm text-[#17171c]/60">
            티켓 정보를 찾을 수 없어요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  const title = performance?.prfnm || ticket.customTitle || "제목 없음";
  const venue = performance?.fcltynm || ticket.customVenue;
  // poster는 빈 문자열로 들어있는 공연이 있어 truthy 체크가 필수다.
  const poster = performance?.poster ? performance.poster : null;
  const isCustom = !ticket.performanceId;

  return (
    <MobileContainer>
      {deleting ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12">
        <PageHeader
          title="티켓 상세"
          className="mb-6"
          right={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="text-[#17171c]/70"
              onClick={() => setMenuOpen(true)}
              aria-label="티켓 메뉴"
            >
              <Menu className="size-6" />
            </Button>
          }
        />

        <div className="space-y-4">
          {/* 카드 1: 포스터 + 공연 정보. 포스터 비율은 캘린더·검색과 같은 0.7로 통일한다. */}
          <div className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center">
              {poster ? (
                <AnimatedImage
                  src={poster}
                  alt=""
                  width={168}
                  height={240}
                  sizes="168px"
                  className="h-60 w-[168px] rounded-lg bg-[#17171c]/5 object-cover"
                />
              ) : (
                <div className="h-60 w-[168px] rounded-lg bg-[#17171c]/5" />
              )}
              <p className="mt-4 text-center text-base font-bold">{title}</p>
              {venue ? (
                <p className="mt-1 text-center text-sm text-[#17171c]/60">{venue}</p>
              ) : null}
            </div>
          </div>

          {/* 카드 2: 관람 정보. 값이 없는 행은 아예 렌더링하지 않는다(기록 상세와 동일 관례). */}
          <div className="space-y-4 rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
              <span className="text-sm text-[#17171c]">{formatWatchedOn(ticket.watchedOn)}</span>
            </div>
            {ticket.rating ? (
              <div className="flex items-start gap-3">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
                <span className="flex items-center gap-1 text-sm text-[#17171c]">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className="h-4 w-4 text-brand"
                      fill={(ticket.rating ?? 0) >= (index + 1) * 2 ? "currentColor" : "none"}
                    />
                  ))}
                </span>
              </div>
            ) : null}
            {ticket.seat ? (
              <div className="flex items-start gap-3">
                <Sofa className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
                <span className="text-sm text-[#17171c]">{ticket.seat}</span>
              </div>
            ) : null}
            {ticket.memo ? (
              <div className="flex items-start gap-3">
                <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
                <span className="whitespace-pre-line text-sm text-[#17171c]">{ticket.memo}</span>
              </div>
            ) : null}
          </div>

          {/* 카드 3: 첨부 사진. 0장이면 영역 자체를 숨긴다. */}
          {images.length > 0 ? (
            <div className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setViewerUrl(image.url)}
                    className="relative aspect-square w-20 shrink-0"
                    aria-label="사진 크게 보기"
                  >
                    <AnimatedImage
                      src={image.url}
                      alt=""
                      width={80}
                      height={80}
                      sizes="80px"
                      className="h-full w-full rounded-md bg-[#17171c]/5 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* 내가 쓴 리뷰 — 버튼으로 감추지 않고 내용을 바로 보여준다.
              탭하면 리뷰 상세로 이동해 좋아요·댓글을 볼 수 있다. */}
          {review ? (
            <button
              type="button"
              onClick={() => {
                sendHapticToApp();
                router.push(`/performance/${ticket.performanceId}/reviews/${review.id}`);
              }}
              className="w-full rounded-2xl border border-[#17171c]/5 bg-white p-5 text-left shadow-sm active:bg-[#17171c]/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#17171c]">내가 쓴 리뷰</p>
                  {!review.isPublic ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-[#17171c]/5 px-2 py-0.5 text-xs text-[#17171c]/60">
                      <Lock className="size-3" />
                      비공개
                    </span>
                  ) : null}
                </div>
                <ChevronRight className="size-4 shrink-0 text-[#17171c]/30" />
              </div>
              <div className="mt-3 flex items-center gap-1">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    className="h-4 w-4 text-brand"
                    fill={review.rating >= (index + 1) * 2 ? "currentColor" : "none"}
                  />
                ))}
              </div>
              {review.content ? (
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-[#17171c]/80">
                  {review.content}
                </p>
              ) : null}
            </button>
          ) : isCustom ? (
            <p className="px-1 text-center text-xs text-[#17171c]/50">
              직접 입력한 공연은 개인 기록으로만 남길 수 있어요
            </p>
          ) : (
            <Button
              className="h-12 w-full"
              onClick={() => {
                sendHapticToApp();
                router.push(`/ticket/${ticket.id}/review`);
              }}
            >
              리뷰 쓰기
            </Button>
          )}
        </div>
      </main>



      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="h-12 w-full justify-start gap-3"
            onClick={() => {
              setMenuOpen(false);
              router.push(`/ticket/${ticket.id}/edit`);
            }}
          >
            <PenLine className="size-5" />
            수정하기
          </Button>
          <Button
            variant="ghost"
            className="h-12 w-full justify-start gap-3 text-[#FF154A]"
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-5" />
            삭제하기
          </Button>
        </div>
      </BottomSheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 티켓을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 되돌릴 수 없어요. 이미 작성한 리뷰는 그대로 남아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewer
        isOpen={Boolean(viewerUrl)}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </MobileContainer>
  );
}
