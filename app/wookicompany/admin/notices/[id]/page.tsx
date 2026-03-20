"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ArrowLeft, Trash2, Pencil } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const TITLE_MAX_LENGTH = 120;
const CONTENT_MAX_LENGTH = 5000;

type NoticeDetail = {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminNoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editIsPublished, setEditIsPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !!editTitle.trim() && !!editContent.trim() && !submitting;

  const fetchDetail = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("공지 상세 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const n = data.notice;
      if (n) {
        setNotice(n);
        setEditTitle(n.title);
        setEditContent(n.content);
        setEditIsPublished(n.is_published);
      }
    } catch {
      setError("공지 상세 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSave = useCallback(async () => {
    const token = await getAdminToken();
    if (!token || !notice) return;
    if (!editTitle.trim() || !editContent.trim()) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          is_published: editIsPublished,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notice) {
          setNotice(data.notice);
          setEditTitle(data.notice.title);
          setEditContent(data.notice.content);
          setEditIsPublished(data.notice.is_published);
        }
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "공지 저장에 실패했습니다.");
      }
    } catch {
      setError("공지 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [id, notice, editTitle, editContent, editIsPublished]);

  const handleDelete = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.replace("/wookicompany/admin/notices");
      }
    } finally {
      setDeleting(false);
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="공지 상세" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error && !notice) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="공지 상세" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              다시 시도
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wookicompany/admin/notices">목록으로</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="공지 상세" />
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">공지를 찾을 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/wookicompany/admin/notices">목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="공지 상세"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/notices">
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>공지 전체 정보</CardTitle>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-4 mr-1" />
                  수정
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="size-4 mr-1" />
                      삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>공지 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 공지를 삭제합니다. 복구할 수 없습니다. 계속할까요?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={!canSave}>
                  {submitting ? "저장 중…" : "저장"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setEditTitle(notice.title);
                    setEditContent(notice.content);
                    setEditIsPublished(notice.is_published);
                    setError(null);
                  }}
                  disabled={submitting}
                >
                  취소
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3 lg:col-span-2">
              <p className="text-xs text-muted-foreground">제목</p>
              <p className="mt-1 font-medium">{notice.title || "미입력"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">게시 상태</p>
              <p className="mt-1">
                <Badge variant={notice.is_published ? "default" : "secondary"}>
                  {notice.is_published ? "게시됨" : "미게시"}
                </Badge>
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">게시일</p>
              <p className="mt-1 font-medium">{formatAdminDateTime(notice.published_at)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">생성일</p>
              <p className="mt-1 font-medium">{formatAdminDateTime(notice.created_at)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">수정일</p>
              <p className="mt-1 font-medium">{formatAdminDateTime(notice.updated_at)}</p>
            </div>
          </div>

          {editing ? (
            <div className="max-w-3xl space-y-4 rounded-md border p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="edit-title">제목 *</Label>
                  <span className="text-xs text-muted-foreground">
                    {editTitle.length.toLocaleString("ko-KR")} /{" "}
                    {TITLE_MAX_LENGTH.toLocaleString("ko-KR")}
                  </span>
                </div>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={TITLE_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="edit-content">내용 *</Label>
                  <span className="text-xs text-muted-foreground">
                    {editContent.length.toLocaleString("ko-KR")} /{" "}
                    {CONTENT_MAX_LENGTH.toLocaleString("ko-KR")}
                  </span>
                </div>
                <Textarea
                  id="edit-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  maxLength={CONTENT_MAX_LENGTH}
                  className="min-h-[260px]"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-is_published"
                  checked={editIsPublished}
                  onCheckedChange={(checked) => setEditIsPublished(checked === true)}
                />
                <Label htmlFor="edit-is_published" className="cursor-pointer">
                  게시함 (체크 시 공개 상태)
                </Label>
              </div>
            </div>
          ) : (
            <dl className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-[120px_1fr]">
              <dt className="text-muted-foreground">내용</dt>
              <dd className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
                {notice.content || "미입력"}
              </dd>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
