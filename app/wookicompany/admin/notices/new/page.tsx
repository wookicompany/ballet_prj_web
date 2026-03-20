"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const TITLE_MAX_LENGTH = 120;
const CONTENT_MAX_LENGTH = 5000;

export default function AdminNoticeNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const canSubmit = !!trimmedTitle && !!trimmedContent && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedTitle || !trimmedContent) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: trimmedTitle,
          content: trimmedContent,
          is_published: isPublished,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "등록에 실패했습니다.");
        return;
      }
      const data = await res.json();
      if (data.notice?.id) {
        router.replace(`/wookicompany/admin/notices/${data.notice.id}`);
      } else {
        router.replace("/wookicompany/admin/notices");
      }
    } catch {
      setError("등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="새 공지 등록"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/notices">
              <ArrowLeft className="mr-1.5 size-4" />
              목록으로
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="title">제목 *</Label>
                <span className="text-xs text-muted-foreground">
                  {title.length.toLocaleString("ko-KR")} / {TITLE_MAX_LENGTH.toLocaleString("ko-KR")}
                </span>
              </div>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 3월 공지사항 안내"
                maxLength={TITLE_MAX_LENGTH}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_published"
                checked={isPublished}
                onCheckedChange={(checked) => setIsPublished(checked === true)}
              />
              <Label htmlFor="is_published" className="cursor-pointer">
                바로 게시 (체크 시 즉시 공개)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>본문</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="content">내용 *</Label>
                <span className="text-xs text-muted-foreground">
                  {content.length.toLocaleString("ko-KR")} / {CONTENT_MAX_LENGTH.toLocaleString("ko-KR")}
                </span>
              </div>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="공지 내용을 입력하세요."
                maxLength={CONTENT_MAX_LENGTH}
                required
                rows={12}
                className="min-h-[260px]"
              />
              <p className="text-xs text-muted-foreground">
                줄바꿈을 포함한 원문 그대로 사용자에게 표시됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/wookicompany/admin/notices">취소</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
