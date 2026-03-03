"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2 } from "lucide-react";
import { REPORT_REASON_OPTIONS } from "@/lib/reports";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type ReportRow = {
  id: string;
  reason_code: string;
  reason_detail: string | null;
  reporter_user_id: string;
  created_at: string;
  reporter_nickname: string | null;
};

export default function AdminReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [review, setReview] = useState<{ id: string; performance_id: string; prfnm: string; user_id: string; nickname: string | null; rating: number; content: string | null; created_at: string; [k: string]: unknown } | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const fetchDetail = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        setError("리뷰 상세 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setReview(data.review);
      setReports(data.reports ?? []);
    } catch {
      setError("리뷰 상세 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDelete = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reviews/${id}/delete`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) router.replace("/wookicompany/admin/reviews");
    } finally {
      setDeleting(false);
    }
  }, [id, router]);

  const reasonLabel = (code: string) => REPORT_REASON_OPTIONS.find((o) => o.code === code)?.label ?? code;

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="리뷰 상세" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="리뷰 상세" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              다시 시도
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wookicompany/admin/reviews">목록으로</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="리뷰 상세" />
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">리뷰를 찾을 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/wookicompany/admin/reviews">목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="리뷰 상세"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/reviews">
              <ArrowLeft className="mr-1.5 size-4" />
              목록으로
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-md border p-3 md:col-span-2">
              <p className="text-xs text-muted-foreground">공연명</p>
              <p className="mt-1 font-medium">{review.prfnm || "미입력"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">작성자</p>
              <p className="mt-1 font-medium">{review.nickname || "미입력"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">평점</p>
              <p className="mt-1">
                <Badge variant="default">{review.rating}점</Badge>
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">신고</p>
              <p className="mt-1">
                <Badge variant={reports.length > 0 ? "destructive" : "secondary"}>
                  {reports.length}건
                </Badge>
              </p>
            </div>
            <div className="rounded-md border p-3 md:col-span-2">
              <p className="text-xs text-muted-foreground">작성일</p>
              <p className="mt-1 font-medium">{formatDateTime(review.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>리뷰</CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="size-4 mr-1" /> 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>리뷰 삭제</AlertDialogTitle>
                <AlertDialogDescription>이 리뷰를 소프트 삭제합니다. 계속할까요?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm md:grid-cols-[120px_1fr]">
            <dt className="text-muted-foreground">내용</dt>
            <dd className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
              {review.content || "미입력"}
            </dd>
            <dt className="text-muted-foreground">작성자 ID</dt>
            <dd>{review.user_id}</dd>
          </dl>
        </CardContent>
      </Card>

      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>신고 목록 ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{r.reporter_nickname ?? r.reporter_user_id}</span>
                    <span>{formatDateTime(r.created_at)}</span>
                  </div>
                  <p className="font-medium mt-1">{reasonLabel(r.reason_code)}</p>
                  {r.reason_detail ? <p className="mt-1 text-muted-foreground">{r.reason_detail}</p> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
