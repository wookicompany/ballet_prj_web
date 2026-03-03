"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function AdminMemberDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [profile, setProfile] = useState<{ id: string; nickname: string | null; avatar_url: string | null; created_at: string; [k: string]: unknown } | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setRecordCount(data.record_count ?? 0);
      setReviewCount(data.review_count ?? 0);
      setCommentCount(data.comment_count ?? 0);
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">회원을 찾을 수 없습니다.</p>
        <Button variant="outline" asChild>
          <Link href="/wookicompany/admin/members">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/members">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">회원 상세</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={(profile.avatar_url as string) ?? undefined} />
              <AvatarFallback>{(profile.nickname as string) ?? (profile.id as string).slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile.nickname ?? "-"}</p>
              <p className="text-sm text-muted-foreground">ID: {profile.id}</p>
            </div>
          </div>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">가입일</dt>
              <dd>{new Date(profile.created_at as string).toLocaleString("ko-KR")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>활동 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            <li>캘린더 기록: {recordCount}건</li>
            <li>공연 리뷰: {reviewCount}건</li>
            <li>공연 댓글: {commentCount}건</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
