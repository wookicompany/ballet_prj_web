"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const fetchDetail = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
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
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSave = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token || !notice) return;
    if (!editTitle.trim() || !editContent.trim()) return;
    setSubmitting(true);
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
      }
    } finally {
      setSubmitting(false);
    }
  }, [id, notice, editTitle, editContent, editIsPublished]);

  const handleDelete = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">공지를 찾을 수 없습니다.</p>
        <Button variant="outline" asChild>
          <Link href="/wookicompany/admin/notices">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/notices">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">공지 상세</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>기본 정보</CardTitle>
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
                <Button size="sm" onClick={handleSave} disabled={submitting}>
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
                  }}
                  disabled={submitting}
                >
                  취소
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-4 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="edit-title">제목</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">내용</Label>
                <textarea
                  id="edit-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[200px]"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-is_published"
                  checked={editIsPublished}
                  onCheckedChange={(checked) => setEditIsPublished(checked === true)}
                />
                <Label htmlFor="edit-is_published" className="cursor-pointer">
                  게시함
                </Label>
              </div>
            </div>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">제목</dt>
                <dd className="font-medium">{notice.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">게시여부</dt>
                <dd>
                  <Badge variant={notice.is_published ? "default" : "secondary"}>
                    {notice.is_published ? "게시됨" : "미게시"}
                  </Badge>
                </dd>
              </div>
              {notice.published_at && (
                <div>
                  <dt className="text-muted-foreground">게시일</dt>
                  <dd>{new Date(notice.published_at).toLocaleString("ko-KR")}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">내용</dt>
                <dd className="whitespace-pre-wrap mt-1">{notice.content}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">생성일</dt>
                <dd>{new Date(notice.created_at).toLocaleString("ko-KR")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">수정일</dt>
                <dd>{new Date(notice.updated_at).toLocaleString("ko-KR")}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
