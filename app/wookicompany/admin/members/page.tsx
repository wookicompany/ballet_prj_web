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
import { ChevronRight } from "lucide-react";

const LIMIT = 20;

type MemberRow = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  record_count: number;
  review_count: number;
};

export default function AdminMembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async (pageOffset: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members?limit=${LIMIT}&offset=${pageOffset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMembers(data.members ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers(0);
  }, [fetchMembers]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">회원 관리</h1>
      <Card>
        <CardHeader>
          <CardTitle>회원 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>닉네임</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead>기록 수</TableHead>
                    <TableHead>리뷰 수</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        회원이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {(m.nickname ?? m.id.slice(0, 2)).slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{m.nickname ?? "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(m.created_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell>{m.record_count}</TableCell>
                        <TableCell>{m.review_count}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/wookicompany/admin/members/${m.id}`}>
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
                          if (currentPage > 1) fetchMembers(offset - LIMIT);
                        }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" onClick={(e) => { e.preventDefault(); }} isActive>
                        {currentPage} / {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) fetchMembers(offset + LIMIT);
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
