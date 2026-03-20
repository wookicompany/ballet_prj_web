"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type RecordRow = {
  id: string;
  user_id: string;
  record_date: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  created_at: string;
  nickname: string | null;
  avatar_url: string | null;
};

export default function AdminRecordsPage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const formatDateLabel = useCallback((dateText: string) => {
    return dateText.replaceAll("-", ".");
  }, []);

  const fetchRecords = useCallback(async (pageOffset: number) => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/records?limit=${LIMIT}&offset=${pageOffset}`,
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
    fetchRecords(0);
  }, [fetchRecords]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const filteredRecords = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((row) => {
      const nickname = (row.nickname ?? "").toLowerCase();
      const userId = row.user_id.toLowerCase();
      const content = (row.content ?? "").toLowerCase();
      return (
        nickname.includes(keyword) ||
        userId.includes(keyword) ||
        content.includes(keyword) ||
        row.record_date.includes(keyword)
      );
    });
  }, [records, searchQuery]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="캘린더 기록 관리"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRecords(offset)}
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
              현재 페이지 표시: {filteredRecords.length.toLocaleString("ko-KR")}건
            </p>
          </div>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="닉네임/내용/날짜 검색"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchRecords(offset)}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>시간</TableHead>
                    <TableHead className="max-w-[200px]">내용</TableHead>
                    <TableHead>작성일</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchQuery.trim()
                          ? "검색 결과가 없습니다."
                          : "등록된 기록이 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">
                          {formatDateLabel(r.record_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarImage src={r.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {(r.nickname ?? r.user_id.slice(0, 2)).slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <p className="text-sm leading-none">{r.nickname ?? "-"}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.user_id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.start_time} ~ {r.end_time}
                        </TableCell>
                        <TableCell
                          className="max-w-[200px] truncate text-sm text-muted-foreground"
                          title={r.content || "-"}
                        >
                          {r.content || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAdminDateTime(r.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/wookicompany/admin/records/${r.id}`}>
                              <ChevronRight className="size-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) fetchRecords(offset - LIMIT);
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
                              fetchRecords((p - 1) * LIMIT);
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
                          if (currentPage < totalPages) fetchRecords(offset + LIMIT);
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
