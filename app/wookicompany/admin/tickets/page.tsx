"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Image as ImageIcon, RefreshCw, Search, Star } from "lucide-react";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";

const LIMIT = 20;

type TicketRow = {
  id: string;
  userId: string;
  nickname: string | null;
  title: string;
  venue: string | null;
  poster: string | null;
  isCustom: boolean;
  watchedOn: string;
  rating: number | null;
  reviewId: string | null;
  imageCount: number;
  createdAt: string;
};

type ReviewFilter = "all" | "with" | "without";
type SourceFilter = "all" | "kopis" | "custom";

export default function AdminTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const prevSearchQuery = useRef("");

  const fetchTickets = useCallback(
    async (pageOffset: number, q = "", review: ReviewFilter = "all", source: SourceFilter = "all") => {
      const token = await getAdminToken();
      if (!token) {
        setError("로그인이 필요합니다.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(pageOffset),
        });
        if (q) params.set("q", q);
        if (review !== "all") params.set("review", review);
        if (source !== "all") params.set("source", source);

        const res = await fetch(`/api/admin/tickets?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setError("티켓 목록을 불러오지 못했습니다.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setTickets(data.tickets ?? []);
        setTotal(data.total ?? 0);
        setOffset(pageOffset);
      } catch {
        setError("티켓 목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // 검색어 변경만 디바운스, 필터 변경과 마운트 시엔 즉시 조회(공지 관리와 동일).
    const queryChanged = prevSearchQuery.current !== searchQuery;
    prevSearchQuery.current = searchQuery;
    if (!queryChanged) {
      fetchTickets(0, searchQuery, reviewFilter, sourceFilter);
      return;
    }
    const timer = setTimeout(() => {
      fetchTickets(0, searchQuery, reviewFilter, sourceFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, reviewFilter, sourceFilter, fetchTickets]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="티켓북 관리"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTickets(offset, searchQuery, reviewFilter, sourceFilter)}
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
            <CardTitle>티켓 목록 (총 {total.toLocaleString("ko-KR")}건)</CardTitle>
            <p className="text-sm text-muted-foreground">
              현재 페이지 표시: {tickets.length.toLocaleString("ko-KR")}건
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="공연명/사용자 검색"
                className="pl-9"
              />
            </div>
            {(
              [
                { value: "all", label: "전체" },
                { value: "with", label: "리뷰 있음" },
                { value: "without", label: "리뷰 없음" },
              ] as const
            ).map((f) => (
              <Button
                key={f.value}
                type="button"
                variant={reviewFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setReviewFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" />
            {(
              [
                { value: "all", label: "전체" },
                { value: "kopis", label: "KOPIS" },
                { value: "custom", label: "직접 입력" },
              ] as const
            ).map((f) => (
              <Button
                key={f.value}
                type="button"
                variant={sourceFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchTickets(offset, searchQuery, reviewFilter, sourceFilter)}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>공연</TableHead>
                    <TableHead>관람일</TableHead>
                    <TableHead>작성자</TableHead>
                    <TableHead>별점</TableHead>
                    <TableHead>사진</TableHead>
                    <TableHead>리뷰</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        {searchQuery.trim() || reviewFilter !== "all" || sourceFilter !== "all"
                          ? "검색/필터 결과가 없습니다."
                          : "등록된 티켓이 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((t) => (
                      <TableRow
                        key={t.id}
                        className="h-14 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/wookicompany/admin/tickets/${t.id}`)}
                      >
                        <TableCell className="max-w-[260px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium" title={t.title}>
                              {t.title}
                            </span>
                            {t.isCustom ? (
                              <Badge variant="secondary" className="shrink-0">
                                직접 입력
                              </Badge>
                            ) : null}
                          </div>
                          {t.venue ? (
                            <p className="truncate text-xs text-muted-foreground" title={t.venue}>
                              {t.venue}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{t.watchedOn}</TableCell>
                        <TableCell className="text-sm">{t.nickname ?? "-"}</TableCell>
                        <TableCell className="text-sm">
                          {t.rating ? (
                            <span className="flex items-center gap-1">
                              <Star className="size-3.5 fill-current text-amber-500" />
                              {t.rating / 2}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.imageCount > 0 ? (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="size-3.5 text-muted-foreground" />
                              {t.imageCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.reviewId ? (
                            <Badge>작성</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAdminDateTime(t.createdAt)}
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
                          if (currentPage > 1) {
                            fetchTickets(offset - LIMIT, searchQuery, reviewFilter, sourceFilter);
                          }
                        }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          (p >= currentPage - 2 && p <= currentPage + 2)
                      )
                      .map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              fetchTickets((p - 1) * LIMIT, searchQuery, reviewFilter, sourceFilter);
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
                          if (currentPage < totalPages) {
                            fetchTickets(offset + LIMIT, searchQuery, reviewFilter, sourceFilter);
                          }
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
