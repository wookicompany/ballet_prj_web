"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
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
import { ChevronRight, Plus, RefreshCw, Search } from "lucide-react";

const LIMIT = 20;

type NoticeRow = {
  id: string;
  title: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

export default function AdminNoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">(
    "all"
  );

  const searchInit = useRef(true);

  const fetchNotices = useCallback(async (pageOffset: number, q = "") => {
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
      const res = await fetch(
        `/api/admin/notices?limit=${LIMIT}&offset=${pageOffset}${qParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setError("공지 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setNotices(data.notices ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } catch {
      setError("공지 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices(0);
  }, [fetchNotices]);

  useEffect(() => {
    if (searchInit.current) { searchInit.current = false; return; }
    const timer = setTimeout(() => { fetchNotices(0, searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchNotices]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      if (statusFilter === "published" && !notice.is_published) return false;
      if (statusFilter === "draft" && notice.is_published) return false;
      return true;
    });
  }, [notices, statusFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="공지사항 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNotices(offset, searchQuery)}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 size-4" />
              새로고침
            </Button>
            <Button asChild>
              <Link href="/wookicompany/admin/notices/new">
                <Plus className="size-4 mr-1" />
                새 공지
              </Link>
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>공지 목록 (총 {total.toLocaleString("ko-KR")}건)</CardTitle>
            <p className="text-sm text-muted-foreground">
              현재 페이지 표시: {filteredNotices.length.toLocaleString("ko-KR")}건
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목 검색"
                className="pl-9"
              />
            </div>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              전체
            </Button>
            <Button
              variant={statusFilter === "published" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("published")}
            >
              게시
            </Button>
            <Button
              variant={statusFilter === "draft" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("draft")}
            >
              미게시
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
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
                onClick={() => fetchNotices(offset, searchQuery)}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>게시여부</TableHead>
                    <TableHead>게시일</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {searchQuery.trim() || statusFilter !== "all"
                          ? "검색/필터 결과가 없습니다."
                          : "등록된 공지가 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNotices.map((n) => (
                      <TableRow key={n.id} className="h-14 cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/wookicompany/admin/notices/${n.id}`)}>
                        <TableCell
                          className="font-medium max-w-[300px] truncate"
                          title={n.title}
                        >
                          {n.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant={n.is_published ? "default" : "secondary"}>
                            {n.is_published ? "게시됨" : "미게시"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAdminDateTime(n.published_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAdminDateTime(n.created_at)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="size-4 text-muted-foreground" />
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
                          if (currentPage > 1) fetchNotices(offset - LIMIT, searchQuery);
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
                              fetchNotices((p - 1) * LIMIT, searchQuery);
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
                          if (currentPage < totalPages) fetchNotices(offset + LIMIT, searchQuery);
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
