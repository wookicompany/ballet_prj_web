"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, RefreshCw, Search } from "lucide-react";

const LIMIT = 20;

type MemberRow = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  record_count: number;
  review_count: number;
  comment_count: number;
  like_brand_count: number;
};

type SortKey =
  | "created_at_desc"
  | "record_count_desc" | "record_count_asc"
  | "review_count_desc" | "review_count_asc"
  | "comment_count_desc" | "comment_count_asc"
  | "like_brand_count_desc" | "like_brand_count_asc";

export default function AdminMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("created_at_desc");
  const [activityFilter, setActivityFilter] = useState<
    "all" | "has_record" | "has_review" | "has_comment"
  >("all");

  const searchInit = useRef(true);

  const fetchMembers = useCallback(async (pageOffset: number, q = "", s: SortKey = "created_at_desc") => {
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
      const res = await fetch(`/api/admin/members?limit=${LIMIT}&offset=${pageOffset}${qParam}&sort=${s}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("회원 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMembers(data.members ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } catch {
      setError("회원 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers(0, "", sort);
  }, [fetchMembers, sort]);

  useEffect(() => {
    if (searchInit.current) { searchInit.current = false; return; }
    const timer = setTimeout(() => { fetchMembers(0, searchQuery, sort); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchMembers, sort]);

  const handleSort = (field: "record_count" | "review_count" | "comment_count" | "like_brand_count") => {
    const descKey = `${field}_desc` as SortKey;
    const ascKey = `${field}_asc` as SortKey;
    const next: SortKey = sort === descKey ? ascKey : descKey;
    setSort(next);
    setOffset(0);
  };

  const SortIcon = ({ field }: { field: "record_count" | "review_count" | "comment_count" | "like_brand_count" }) => {
    if (sort === `${field}_desc`) return <ArrowDown className="size-3.5" />;
    if (sort === `${field}_asc`) return <ArrowUp className="size-3.5" />;
    return <ArrowUpDown className="size-3.5 opacity-40" />;
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (activityFilter === "has_record" && member.record_count <= 0) return false;
      if (activityFilter === "has_review" && member.review_count <= 0) return false;
      if (activityFilter === "has_comment" && member.comment_count <= 0) return false;
      return true;
    });
  }, [members, activityFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="회원 관리"
        actions={
          <Button
            variant="outline"
            size="sm"
              onClick={() => fetchMembers(offset, searchQuery, sort)}
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
            <CardTitle>회원 목록 (총 {total.toLocaleString("ko-KR")}명)</CardTitle>
            <p className="text-sm text-muted-foreground">
              현재 페이지 표시: {filteredMembers.length.toLocaleString("ko-KR")}명
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="사용자 검색"
                className="pl-9"
              />
            </div>
            <Button
              variant={activityFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivityFilter("all")}
            >
              전체
            </Button>
            <Button
              variant={activityFilter === "has_record" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivityFilter("has_record")}
            >
              기록 있음
            </Button>
            <Button
              variant={activityFilter === "has_review" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivityFilter("has_review")}
            >
              리뷰 있음
            </Button>
            <Button
              variant={activityFilter === "has_comment" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivityFilter("has_comment")}
            >
              댓글 있음
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
                onClick={() => fetchMembers(offset, searchQuery, sort)}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>닉네임</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("record_count")}>
                        기록 수 <SortIcon field="record_count" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("review_count")}>
                        리뷰 수 <SortIcon field="review_count" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("comment_count")}>
                        댓글 수 <SortIcon field="comment_count" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("like_brand_count")}>
                        찜 수 <SortIcon field="like_brand_count" />
                      </button>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {searchQuery.trim() || activityFilter !== "all"
                          ? "검색/필터 결과가 없습니다."
                          : "회원이 없습니다."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((m) => (
                      <TableRow key={m.id} className="h-14 cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/wookicompany/admin/members/${m.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {(m.nickname ?? m.id.slice(0, 2)).slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <p className="text-sm leading-none">{m.nickname ?? "-"}</p>
                              <p className="text-xs text-muted-foreground">{m.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatAdminDateTime(m.created_at)}
                        </TableCell>
                        <TableCell className="tabular-nums">{m.record_count}</TableCell>
                        <TableCell className="tabular-nums">{m.review_count}</TableCell>
                        <TableCell className="tabular-nums">{m.comment_count}</TableCell>
                        <TableCell className="tabular-nums">{m.like_brand_count}</TableCell>
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
                          if (currentPage > 1) fetchMembers(offset - LIMIT, searchQuery, sort);
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
                          if (currentPage < totalPages) fetchMembers(offset + LIMIT, searchQuery, sort);
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
