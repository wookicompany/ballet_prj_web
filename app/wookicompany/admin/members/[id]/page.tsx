"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type RecentRecord = { id: string; record_date: string; content: string; created_at: string };
type RecentReview = { id: string; content: string; created_at: string };
type RecentComment = { id: string; content: string; created_at: string };
type RecentLikedBrand = { id: string; brand_id: string; created_at: string; ballet_brands: { id: string; name_ko: string } | null };

export default function AdminMemberDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [profile, setProfile] = useState<{ id: string; nickname: string | null; avatar_url: string | null; created_at: string; ballet_started_at: string | null; app_platform: string | null; [k: string]: unknown } | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [likeBrandCount, setLikeBrandCount] = useState(0);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [recentLikedBrands, setRecentLikedBrands] = useState<RecentLikedBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalActivity = recordCount + reviewCount + commentCount;

  const fetchDetail = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("회원 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setEmail(data.email ?? null);
      setRecordCount(data.record_count ?? 0);
      setReviewCount(data.review_count ?? 0);
      setCommentCount(data.comment_count ?? 0);
      setLikeBrandCount(data.like_brand_count ?? 0);
      setRecentRecords(data.recent_records ?? []);
      setRecentReviews(data.recent_reviews ?? []);
      setRecentComments(data.recent_comments ?? []);
      setRecentLikedBrands(data.recent_liked_brands ?? []);
    } catch {
      setError("회원 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="회원 상세" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="회원 상세" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              다시 시도
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wookicompany/admin/members">목록으로</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="회원 상세" />
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">회원을 찾을 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/wookicompany/admin/members">목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="회원 상세"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/members">
              <ArrowLeft className="mr-1.5 size-4" />
              목록으로
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>회원 전체 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
            <Avatar>
              <AvatarImage src={(profile.avatar_url as string) ?? undefined} />
              <AvatarFallback>
                {(profile.nickname as string) ?? (profile.id as string).slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{profile.nickname ?? "미입력"}</p>
              <p className="break-all text-sm text-muted-foreground">ID: {profile.id}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">이메일</p>
              <p className="mt-1 break-all font-medium">{email ?? "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">가입일</p>
              <p className="mt-1 font-medium">
                {formatAdminDateTime(profile.created_at as string)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">발레 시작일</p>
              <p className="mt-1 font-medium">
                {profile.ballet_started_at ?? "-"}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">플랫폼</p>
              <p className="mt-1 font-medium">
                {profile.app_platform ?? "-"}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">총 활동</p>
              <p className="mt-1 font-medium tabular-nums">{totalActivity}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">닉네임</p>
              <p className="mt-1 font-medium">{profile.nickname ?? "미입력"}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 캘린더 기록 */}
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-medium">캘린더 기록</p>
                <span className="text-xs text-muted-foreground tabular-nums">총 {recordCount}건</span>
              </div>
              {recentRecords.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">기록이 없습니다.</p>
              ) : (
                <ul className="divide-y">
                  {recentRecords.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/wookicompany/admin/records/${item.id}`}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.content || "(내용 없음)"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.record_date}</p>
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 공연 리뷰 */}
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-medium">공연 리뷰</p>
                <span className="text-xs text-muted-foreground tabular-nums">총 {reviewCount}건</span>
              </div>
              {recentReviews.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">리뷰가 없습니다.</p>
              ) : (
                <ul className="divide-y">
                  {recentReviews.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/wookicompany/admin/reviews/${item.id}`}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.content || "(내용 없음)"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatAdminDateTime(item.created_at)}</p>
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 공연 댓글 */}
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-medium">공연 댓글</p>
                <span className="text-xs text-muted-foreground tabular-nums">총 {commentCount}건</span>
              </div>
              {recentComments.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">댓글이 없습니다.</p>
              ) : (
                <ul className="divide-y">
                  {recentComments.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/wookicompany/admin/reviews/comments/${item.id}`}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.content || "(내용 없음)"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatAdminDateTime(item.created_at)}</p>
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 찜한 브랜드 */}
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-medium">찜한 브랜드</p>
                <span className="text-xs text-muted-foreground tabular-nums">총 {likeBrandCount}건</span>
              </div>
              {recentLikedBrands.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">찜한 브랜드가 없습니다.</p>
              ) : (
                <ul className="divide-y">
                  {recentLikedBrands.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/wookicompany/admin/brands/${item.brand_id}`}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.ballet_brands?.name_ko ?? "-"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatAdminDateTime(item.created_at)}</p>
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
