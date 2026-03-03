"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";

export default function AdminNoticeNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
          title: title.trim(),
          content: content.trim(),
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/notices">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">새 공지 등록</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>공지 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">내용</Label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 입력하세요"
                required
                rows={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[200px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_published"
                checked={isPublished}
                onCheckedChange={(checked) => setIsPublished(checked === true)}
              />
              <Label htmlFor="is_published" className="cursor-pointer">
                바로 게시
              </Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "등록 중…" : "등록"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/wookicompany/admin/notices">취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
