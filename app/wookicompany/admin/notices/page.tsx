"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ChevronRight, Plus } from "lucide-react";

const LIMIT = 20;

type NoticeRow = {
  id: string;
  title: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotices = useCallback(async (pageOffset: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/notices?limit=${LIMIT}&offset=${pageOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setNotices(data.notices ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices(0);
  }, [fetchNotices]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">공지사항 관리</h1>
        <Button asChild>
          <Link href="/wookicompany/admin/notices/new">
            <Plus className="size-4 mr-1" />
            새 공지
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>공지 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
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
                  {notices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        등록된 공지가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    notices.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {n.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant={n.is_published ? "default" : "secondary"}>
                            {n.is_published ? "게시됨" : "미게시"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {n.published_at
                            ? new Date(n.published_at).toLocaleDateString("ko-KR")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(n.created_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/wookicompany/admin/notices/${n.id}`}>
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
                          if (currentPage > 1) fetchNotices(offset - LIMIT);
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
                              fetchNotices((p - 1) * LIMIT);
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
                          if (currentPage < totalPages) fetchNotices(offset + LIMIT);
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
