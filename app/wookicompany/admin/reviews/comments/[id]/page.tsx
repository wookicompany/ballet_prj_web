"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type ReportRow = {
  id: string;
  reason_code: string;
  reason_detail: string | null;
  reporter_user_id: string;
  created_at: string;
  reporter_nickname: string | null;
};

export default function AdminReviewCommentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [comment, setComment] = useState<{ id: string; review_id: string; prfnm: string | null; user_id: string; nickname: string | null; content: string; created_at: string; [k: string]: unknown } | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchDetail = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/review-comments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setComment(data.comment);
      setReports(data.reports ?? []);
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
      const res = await fetch(`/api/admin/review-comments/${id}/delete`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) router.replace("/wookicompany/admin/reviews");
    } finally {
      setDeleting(false);
    }
  }, [id, router]);

  const reasonLabel = (code: string) => REPORT_REASON_OPTIONS.find((o) => o.code === code)?.label ?? code;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!comment) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">댓글을 찾을 수 없습니다.</p>
        <Button variant="outline" asChild>
          <Link href="/wookicompany/admin/reviews">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/reviews">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">댓글 상세</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>댓글</CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="size-4 mr-1" /> 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>댓글 삭제</AlertDialogTitle>
                <AlertDialogDescription>이 댓글을 소프트 삭제합니다. 계속할까요?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">공연</dt>
              <dd className="font-medium">{comment.prfnm ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">작성자</dt>
              <dd>{comment.nickname ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">내용</dt>
              <dd className="whitespace-pre-wrap">{comment.content}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">작성일</dt>
              <dd>{new Date(comment.created_at).toLocaleString("ko-KR")}</dd>
            </div>
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
                    <span>{new Date(r.created_at).toLocaleString("ko-KR")}</span>
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
