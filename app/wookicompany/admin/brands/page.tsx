"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";

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

type BrandRow = {
  id: string;
  name_ko: string;
  name_en: string | null;
  is_active: boolean;
  sort_order: number;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
};

type SortKey = "name_ko" | "view_count_desc" | "view_count_asc" | "like_count_desc" | "like_count_asc";

export default function AdminBrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name_ko");

  const prevSearchQuery = useRef("");

  const fetchBrands = useCallback(async (pageOffset: number, q = "", s: SortKey = "name_ko") => {
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
        `/api/admin/brands?limit=${LIMIT}&offset=${pageOffset}${qParam}&sort=${s}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setError("브랜드 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBrands(data.brands ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } catch {
      setError("브랜드 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 검색어 변경만 디바운스, 마운트·정렬 변경은 즉시 fetch
    const queryChanged = prevSearchQuery.current !== searchQuery;
    prevSearchQuery.current = searchQuery;
    if (!queryChanged) {
      fetchBrands(0, searchQuery, sort);
      return;
    }
    const timer = setTimeout(() => {
      fetchBrands(0, searchQuery, sort);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchBrands, sort]);

  const handleViewCountSort = () => {
    const next: SortKey = sort === "view_count_desc" ? "view_count_asc" : "view_count_desc";
    setSort(next);
    setOffset(0);
  };

  const handleLikeCountSort = () => {
    const next: SortKey = sort === "like_count_desc" ? "like_count_asc" : "like_count_desc";
    setSort(next);
    setOffset(0);
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="브랜드 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBrands(offset, searchQuery, sort)}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 size-4" />
              새로고침
            </Button>
            <Button asChild>
              <Link href="/wookicompany/admin/brands/new">
                <Plus className="mr-1 size-4" />
                새 브랜드
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>브랜드 목록 (총 {total.toLocaleString("ko-KR")}건)</CardTitle>
          </div>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="브랜드명 검색"
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchBrands(offset, searchQuery, sort)}
            >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>브랜드명</TableHead>
                    <TableHead>영문명</TableHead>
                    <TableHead>노출</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={handleViewCountSort}
                      >
                        조회수
                        {sort === "view_count_desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : sort === "view_count_asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={handleLikeCountSort}
                      >
                        찜 수
                        {sort === "like_count_desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : sort === "like_count_asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {searchQuery.trim()
                          ? "검색 결과가 없습니다."
                          : "등록된 브랜드가 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    brands.map((b) => (
                      <TableRow key={b.id} className="h-14 cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/wookicompany/admin/brands/${b.id}`)}>
                        <TableCell className="font-medium">{b.name_ko}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.name_en ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.is_active ? "default" : "secondary"}>
                            {b.is_active ? "노출" : "비노출"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.view_count.toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.like_count.toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAdminDateTime(b.created_at)}
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
                          if (currentPage > 1)
                            fetchBrands(offset - LIMIT, searchQuery, sort);
                        }}
                        className={
                          currentPage <= 1 ? "pointer-events-none opacity-50" : ""
                        }
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
                              fetchBrands((p - 1) * LIMIT, searchQuery, sort);
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
                          if (currentPage < totalPages)
                            fetchBrands(offset + LIMIT, searchQuery, sort);
                        }}
                        className={
                          currentPage >= totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
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
