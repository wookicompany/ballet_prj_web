"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { ChevronRight, RefreshCw, Search } from "lucide-react";

const LIMIT = 20;

const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

type RecordRow = {
  id: string;
  user_id: string;
  record_date: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  status: "planned" | "done";
  created_at: string;
  nickname: string | null;
  avatar_url: string | null;
  location: string | null;
  instructor: string | null;
  level: string | null;
  did_well: string | null;
  improve_next: string | null;
  outfit: string | null;
  memo: string | null;
  media: { id: string; url: string; media_type: string }[];
};

const parseLocationName = (value: string | null) => {
  if (!value) return null;
  return value.includes(" | ") ? value.split(" | ")[0].trim() : value.trim();
};

const formatInstructorLevel = (instructor: string | null, level: string | null) =>
  [instructor, level].filter(Boolean).join(" · ") || null;

export default function AdminRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "planned">(
    "all"
  );

  const prevSearchQuery = useRef("");

  const formatDateLabel = useCallback((dateText: string) => {
    const base = dateText.replaceAll("-", ".");
    const [y, m, d] = dateText.split("-").map(Number);
    if (!y || !m || !d) return base;
    // 날짜 부분(y/m/d)으로 로컬 자정 기준 요일 계산 — 타임존 이동 없이 그 날짜의 요일이 나온다.
    const weekday = WEEKDAY_KR[new Date(y, m - 1, d).getDay()];
    return `${base} (${weekday})`;
  }, []);

  const formatCreatedDate = useCallback((value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    // created_at은 timestamptz라 항상 KST(Asia/Seoul) 기준으로 날짜·요일을 표시한다(앱 표준).
    const base = d.toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const weekday = d.toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      weekday: "short",
    });
    return `${base} (${weekday})`;
  }, []);

  const formatCreatedTime = useCallback((value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, []);

  const fetchRecords = useCallback(
    async (
      pageOffset: number,
      q = "",
      status: "all" | "done" | "planned" = "all"
    ) => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const statusParam = status !== "all" ? `&status=${status}` : "";
      const res = await fetch(
        `/api/admin/records?limit=${LIMIT}&offset=${pageOffset}${qParam}${statusParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setError("기록 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } catch {
      setError("기록 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 검색어 변경만 디바운스, 상태 필터 변경·마운트 시엔 즉시 fetch (offset 0으로 리셋)
    const queryChanged = prevSearchQuery.current !== searchQuery;
    prevSearchQuery.current = searchQuery;
    if (!queryChanged) {
      fetchRecords(0, searchQuery, statusFilter);
      return;
    }
    const timer = setTimeout(() => {
      fetchRecords(0, searchQuery, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, fetchRecords]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="캘린더 기록 관리"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRecords(offset, searchQuery, statusFilter)}
            disabled={loading}
          >
            <RefreshCw className="mr-1.5 size-4" />
            새로고침
          </Button>
        }
      />
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>기록 목록 (총 {total.toLocaleString("ko-KR")}건)</CardTitle>
            <p className="text-sm text-muted-foreground">
              현재 페이지 표시: {records.length.toLocaleString("ko-KR")}건
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="사용자/내용 검색"
                className="pl-9"
              />
            </div>
            {(
              [
                { value: "all", label: "전체" },
                { value: "done", label: "완료" },
                { value: "planned", label: "예정" },
              ] as const
            ).map((f) => (
              <Button
                key={f.value}
                type="button"
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>
              <div className="grid grid-cols-[110px_130px_120px_80px_1fr_40px] border-b px-4 py-2 gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
                <span />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[110px_130px_120px_80px_1fr_40px] border-b px-4 py-3 gap-4 items-center">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-14 w-14 rounded" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <span />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchRecords(offset, searchQuery, statusFilter)}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[110px_130px_120px_80px_1fr_40px] border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                <span>작성 날짜</span>
                <span>사용자</span>
                <span>기록 날짜</span>
                <span>미디어</span>
                <span>내용</span>
                <span />
              </div>
              {records.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery.trim() ? "검색 결과가 없습니다." : "등록된 기록이 없습니다."}
                </div>
              ) : (
                records.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[110px_130px_120px_80px_1fr_40px] cursor-pointer items-start border-b px-4 py-3 hover:bg-muted/40"
                    onClick={() => router.push(`/wookicompany/admin/records/${r.id}`)}
                  >
                    <div className="self-center space-y-0.5">
                      <p className="text-xs text-muted-foreground">{formatCreatedDate(r.created_at)}</p>
                      <p className="text-xs text-muted-foreground">{formatCreatedTime(r.created_at)}</p>
                    </div>
                    <div className="self-center flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(r.nickname ?? r.user_id.slice(0, 2)).slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-sm leading-none">{r.nickname ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{r.user_id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="self-center space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs">{formatDateLabel(r.record_date)}</p>
                        <span
                          className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${
                            r.status === "planned"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {r.status === "planned" ? "예정" : "완료"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.start_time.slice(0, 5)} ~ {r.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <div className="self-center">
                      {r.media.length > 0 ? (
                        <div className="relative h-14 w-14">
                          <img
                            src={r.media[0].url}
                            alt="미디어"
                            className="h-14 w-14 rounded object-cover"
                          />
                          {r.media.length > 1 && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#17171c] text-[10px] text-white">
                              +{r.media.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">한 줄: </span>
                        <span className="text-muted-foreground">{r.content || "-"}</span>
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">잘한 점: </span>
                        <span className="text-muted-foreground">{r.did_well || "-"}</span>
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">다음 개선점: </span>
                        <span className="text-muted-foreground">{r.improve_next || "-"}</span>
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">코디: </span>
                        <span className="text-muted-foreground">{r.outfit || "-"}</span>
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">메모: </span>
                        <span className="text-muted-foreground">{r.memo || "-"}</span>
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">장소: </span>
                        <span className="text-muted-foreground">{parseLocationName(r.location) || "-"}</span>
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-foreground/70">선생님 & 레벨: </span>
                        <span className="text-muted-foreground">{formatInstructorLevel(r.instructor, r.level) || "-"}</span>
                      </p>
                    </div>
                    <div className="self-center flex justify-end">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) fetchRecords(offset - LIMIT, searchQuery, statusFilter);
                        }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                      .map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              fetchRecords((p - 1) * LIMIT, searchQuery, statusFilter);
                            }}
                            isActive={currentPage === p}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) fetchRecords(offset + LIMIT, searchQuery, statusFilter);
                        }}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
