"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type SupportInquiryDetail = {
  id: string;
  user_id: string;
  email: string | null;
  nickname: string | null;
  title: string;
  content: string;
  created_at: string;
};

export default function AdminSupportInquiryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [inquiry, setInquiry] = useState<SupportInquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDateTime = (value: string | null) => {
    if (!value) return "-";
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
      const res = await fetch(`/api/admin/support-inquiries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("문의 상세 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.inquiry) {
        setInquiry(data.inquiry);
      }
    } catch {
      setError("문의 상세 정보를 불러오는 중 오류가 발생했습니다.");
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
        <AdminPageHeader title="문의 상세" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error && !inquiry) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="문의 상세" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              다시 시도
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wookicompany/admin/support-inquiries">목록으로</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="문의 상세" />
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">문의를 찾을 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/wookicompany/admin/support-inquiries">목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="문의 상세"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/support-inquiries">
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
          <CardTitle>문의 전체 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3 lg:col-span-2">
              <p className="text-xs text-muted-foreground">제목</p>
              <p className="mt-1 font-medium">{inquiry.title || "미입력"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">닉네임</p>
              <p className="mt-1 font-medium">{inquiry.nickname || "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">접수일</p>
              <p className="mt-1 font-medium">{formatDateTime(inquiry.created_at)}</p>
            </div>
            <div className="rounded-md border p-3 lg:col-span-2">
              <p className="text-xs text-muted-foreground">답변 이메일</p>
              <p className="mt-1 font-medium">{inquiry.email || "-"}</p>
            </div>
            <div className="rounded-md border p-3 lg:col-span-2">
              <p className="text-xs text-muted-foreground">회원 ID</p>
              <p className="mt-1 break-all font-medium">{inquiry.user_id}</p>
            </div>
          </div>

          <dl className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-[120px_1fr]">
            <dt className="text-muted-foreground">내용</dt>
            <dd className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
              {inquiry.content || "미입력"}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
