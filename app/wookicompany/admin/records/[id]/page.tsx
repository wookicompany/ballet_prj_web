"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

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
  bar_order: string | null;
  center_order: string | null;
  did_well: string | null;
  improve_next: string | null;
  memo: string | null;
  workout_activity_label: string | null;
  workout_source_name: string | null;
  workout_device_name: string | null;
  workout_active_energy_kcal: number | null;
  workout_total_energy_kcal: number | null;
  workout_avg_bpm: number | null;
  workout_max_bpm: number | null;
  created_at: string;
  updated_at: string;
  nickname: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
};

type MediaItem = { id: string; media_type: string; url: string; created_at: string };
const LOCATION_DELIMITER = " | ";
const ADDRESS_DELIMITER = " || ";

const parseLocationValue = (value: string | null) => {
  if (!value) {
    return { name: "", base: "", detail: "" };
  }
  if (value.includes(LOCATION_DELIMITER)) {
    const [name, ...rest] = value.split(LOCATION_DELIMITER);
    const address = rest.join(LOCATION_DELIMITER).trim();
    if (address.includes(ADDRESS_DELIMITER)) {
      const [base, ...detailParts] = address.split(ADDRESS_DELIMITER);
      return {
        name: name.trim(),
        base: base.trim(),
        detail: detailParts.join(ADDRESS_DELIMITER).trim(),
      };
    }
    return { name: name.trim(), base: address, detail: "" };
  }
  if (value.includes(ADDRESS_DELIMITER)) {
    const [base, ...detailParts] = value.split(ADDRESS_DELIMITER);
    return {
      name: "",
      base: base.trim(),
      detail: detailParts.join(ADDRESS_DELIMITER).trim(),
    };
  }
  return { name: "", base: value.trim(), detail: "" };
};

export default function AdminRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDateLabel = (value: string) => value.replaceAll("-", ".");
  const formatTime = (value: string) => value.slice(0, 5);
  const formatLocation = (value: string | null) => {
    const parsed = parseLocationValue(value);
    const parts = [parsed.name, parsed.base, parsed.detail].filter(
      (part) => part.length > 0
    );
    return parts.length > 0 ? parts.join(" | ") : "—";
  };
  const moodText =
    typeof record?.mood === "number" && record.mood >= 1 && record.mood <= 8
      ? `${record.mood}점`
      : "미입력";

  const fetchDetail = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/records/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("기록 상세 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRecord(data.record);
      setMedia(data.media ?? []);
    } catch {
      setError("기록 상세 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDelete = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/records/${id}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.replace("/wookicompany/admin/records");
      } else {
        toast.error("기록 삭제에 실패했습니다.");
      }
    } catch {
      toast.error("기록 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="기록 상세" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="기록 상세" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              다시 시도
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wookicompany/admin/records">목록으로</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="기록 상세" />
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">기록을 찾을 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/wookicompany/admin/records">목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="기록 상세"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/records">
              <ArrowLeft className="mr-1.5 size-4" />
              목록으로
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>기록 전체 정보</CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="mr-1 size-4" />
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
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
            <Avatar>
              <AvatarImage src={record.avatar_url ?? undefined} />
              <AvatarFallback>
                {(record.nickname ?? record.user_id.slice(0, 2)).slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <p className="font-medium leading-none">{record.nickname ?? "미입력"}</p>
              <p className="text-xs text-muted-foreground">{record.user_id}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">기록일</p>
              <p className="mt-1 font-medium">{formatDateLabel(record.record_date)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">수업 시간</p>
              <p className="mt-1 font-medium">
                {formatTime(record.start_time)} ~ {formatTime(record.end_time)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">기분</p>
              <p className="mt-1">
                <Badge variant={record.mood ? "default" : "secondary"}>{moodText}</Badge>
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">작성일</p>
              <p className="mt-1 font-medium">{formatAdminDateTime(record.created_at)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">수정일</p>
              <p className="mt-1 font-medium">{formatAdminDateTime(record.updated_at)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">기록 ID</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{record.id}</p>
            </div>
          </div>

          <dl className="grid gap-3 text-sm md:grid-cols-[140px_1fr]">
            <dt className="text-muted-foreground">한 줄 기록</dt>
            <dd className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
              {record.content || "—"}
            </dd>
            <dt className="text-muted-foreground">장소</dt>
            <dd>{formatLocation(record.location)}</dd>
            <dt className="text-muted-foreground">강사</dt>
            <dd>{record.instructor || "—"}</dd>
            <dt className="text-muted-foreground">레벨</dt>
            <dd>{record.level || "—"}</dd>
            <dt className="text-muted-foreground">바 순서</dt>
            <dd>{record.bar_order || "—"}</dd>
            <dt className="text-muted-foreground">센터 순서</dt>
            <dd>{record.center_order || "—"}</dd>
            <dt className="text-muted-foreground">잘한 점</dt>
            <dd className="whitespace-pre-wrap">{record.did_well || "—"}</dd>
            <dt className="text-muted-foreground">다음 개선점</dt>
            <dd className="whitespace-pre-wrap">{record.improve_next || "—"}</dd>
            <dt className="text-muted-foreground">메모</dt>
            <dd className="whitespace-pre-wrap">{record.memo || "—"}</dd>
          </dl>

          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm font-medium">Apple Watch 운동 정보</p>
            <dl className="grid gap-3 text-sm md:grid-cols-[180px_1fr]">
              <dt className="text-muted-foreground">운동 라벨</dt>
              <dd>{record.workout_activity_label || "—"}</dd>
              <dt className="text-muted-foreground">소스</dt>
              <dd>{record.workout_source_name || "—"}</dd>
              <dt className="text-muted-foreground">기기</dt>
              <dd>{record.workout_device_name || "—"}</dd>
              <dt className="text-muted-foreground">활동 칼로리</dt>
              <dd>
                {record.workout_active_energy_kcal == null
                  ? "—"
                  : `${record.workout_active_energy_kcal} kcal`}
              </dd>
              <dt className="text-muted-foreground">총 칼로리</dt>
              <dd>
                {record.workout_total_energy_kcal == null
                  ? "—"
                  : `${record.workout_total_energy_kcal} kcal`}
              </dd>
              <dt className="text-muted-foreground">평균 심박수</dt>
              <dd>
                {record.workout_avg_bpm == null ? "—" : `${record.workout_avg_bpm} BPM`}
              </dd>
              <dt className="text-muted-foreground">최대 심박수</dt>
              <dd>
                {record.workout_max_bpm == null ? "—" : `${record.workout_max_bpm} BPM`}
              </dd>
            </dl>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm font-medium">미디어 ({media.length}건)</p>
            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 미디어가 없습니다.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {media.map((m) =>
                  m.media_type === "image" ? (
                    <li key={m.id} className="overflow-hidden rounded-md border text-sm">
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        <div className="relative aspect-square w-full bg-muted">
                          <Image
                            src={m.url}
                            alt="기록 이미지"
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-opacity hover:opacity-80"
                          />
                        </div>
                      </a>
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        이미지 · {formatAdminDateTime(m.created_at)}
                      </p>
                    </li>
                  ) : (
                    <li key={m.id} className="rounded-md border p-3 text-sm">
                      <p className="mb-1 text-xs text-muted-foreground">
                        미디어 · {formatAdminDateTime(m.created_at)}
                      </p>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline"
                      >
                        미디어 링크
                      </a>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
