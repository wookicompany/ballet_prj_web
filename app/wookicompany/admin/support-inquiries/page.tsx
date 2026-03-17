"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
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

type SupportInquiryRow = {
  id: string;
  user_id: string;
  email: string | null;
  nickname: string | null;
  title: string;
  content: string;
  created_at: string;
};

export default function AdminSupportInquiriesPage() {
  const [inquiries, setInquiries] = useState<SupportInquiryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const formatDateTime = useCallback((value: string | null) => {
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
  }, []);

  const fetchInquiries = useCallback(async (pageOffset: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/support-inquiries?limit=${LIMIT}&offset=${pageOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setError("문의 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setInquiries(data.inquiries ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } catch {
      setError("문의 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries(0);
  }, [fetchInquiries]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inquiry) => {
      if (!normalizedQuery) return true;
      return (
        inquiry.title.toLowerCase().includes(normalizedQuery) ||
        inquiry.nickname?.toLowerCase().includes(normalizedQuery) ||
        inquiry.email?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [inquiries, normalizedQuery]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="문의 관리"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInquiries(offset)}
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
            <CardTitle>문의 목록 (총 {total.toLocaleString("ko-KR")}건)</CardTitle>
            <p className="text-sm text-muted-foreground">
              현재 페이지 표시: {filteredInquiries.length.toLocaleString("ko-KR")}건
            </p>
          </div>
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목/닉네임/이메일 검색"
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
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchInquiries(offset)}
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
                    <TableHead>닉네임</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>접수일</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInquiries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {normalizedQuery ? "검색 결과가 없습니다." : "접수된 문의가 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInquiries.map((inquiry) => (
                      <TableRow key={inquiry.id} className="hover:bg-muted/40">
                        <TableCell
                          className="font-medium max-w-[300px] truncate"
                          title={inquiry.title}
                        >
                          {inquiry.title}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {inquiry.nickname || "-"}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                          {inquiry.email || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(inquiry.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              href={`/wookicompany/admin/support-inquiries/${inquiry.id}`}
                            >
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
                          if (currentPage > 1) fetchInquiries(offset - LIMIT);
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
                              fetchInquiries((p - 1) * LIMIT);
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
                          if (currentPage < totalPages) fetchInquiries(offset + LIMIT);
                        }}
                        className={
                          currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
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
