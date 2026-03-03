"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

type RecordDetail = {
  id: string;
  user_id: string;
  record_date: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  location: string | null;
  level: string | null;
  instructor: string | null;
  created_at: string;
  nickname: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
};

type MediaItem = { id: string; media_type: string; url: string; created_at: string };

export default function AdminRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
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
      const res = await fetch(`/api/admin/records/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRecord(data.record);
      setMedia(data.media ?? []);
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
      const res = await fetch(`/api/admin/records/${id}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.replace("/wookicompany/admin/records");
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

  if (!record) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">기록을 찾을 수 없습니다.</p>
        <Button variant="outline" asChild>
          <Link href="/wookicompany/admin/records">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/records">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">기록 상세</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>기본 정보</CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="size-4 mr-1" />
                삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>기록 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  이 기록을 소프트 삭제합니다. 계속할까요?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarImage src={record.avatar_url ?? undefined} />
              <AvatarFallback>{(record.nickname ?? record.user_id.slice(0, 2)).slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{record.nickname ?? "-"}</span>
          </div>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">날짜</dt>
              <dd>{record.record_date}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">시간</dt>
              <dd>{record.start_time} ~ {record.end_time}</dd>
            </div>
            {record.content ? (
              <div>
                <dt className="text-muted-foreground">내용</dt>
                <dd className="whitespace-pre-wrap">{record.content}</dd>
              </div>
            ) : null}
            {record.location ? (
              <div>
                <dt className="text-muted-foreground">장소</dt>
                <dd>{record.location}</dd>
              </div>
            ) : null}
            {record.level ? (
              <div>
                <dt className="text-muted-foreground">레벨</dt>
                <dd>{record.level}</dd>
              </div>
            ) : null}
            {record.instructor ? (
              <div>
                <dt className="text-muted-foreground">강사</dt>
                <dd>{record.instructor}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">작성일</dt>
              <dd>{new Date(record.created_at).toLocaleString("ko-KR")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {media.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>미디어</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {media.map((m) => (
                <li key={m.id} className="text-sm">
                  {m.media_type === "image" ? (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      이미지 보기
                    </a>
                  ) : (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      미디어 링크
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
