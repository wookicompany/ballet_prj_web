"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ChevronRight, RefreshCw, Search } from "lucide-react";

const LIMIT = 20;

type ReviewRow = {
  id: string;
  performance_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  prfnm: string;
  nickname: string | null;
  report_count: number;
};

type CommentRow = {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  created_at: string;
  prfnm: string | null;
  nickname: string | null;
  report_count: number;
};

export default function AdminReviewsPage() {
  const [activeTab, setActiveTab] = useState<"reviews" | "comments">("reviews");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportFilter, setReportFilter] = useState<"all" | "reported">("all");

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsOffset, setReviewsOffset] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const searchInit = useRef(true);

  const fetchReviews = useCallback(async (offset: number, q = "") => {
    const token = await getAdminToken();
    if (!token) {
      setReviewsError("로그인이 필요합니다.");
      setReviewsLoading(false);
      return;
    }
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/admin/reviews?limit=${LIMIT}&offset=${offset}${qParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setReviewsError("리뷰 목록을 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setReviewsTotal(data.total ?? 0);
      setReviewsOffset(offset);
    } catch {
      setReviewsError("리뷰 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const fetchComments = useCallback(async (offset: number, q = "") => {
    const token = await getAdminToken();
    if (!token) {
      setCommentsError("로그인이 필요합니다.");
      setCommentsLoading(false);
      return;
    }
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/admin/review-comments?limit=${LIMIT}&offset=${offset}${qParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setCommentsError("댓글 목록을 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      setComments(data.comments ?? []);
      setCommentsTotal(data.total ?? 0);
      setCommentsOffset(offset);
    } catch {
      setCommentsError("댓글 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews(0);
  }, [fetchReviews]);
  useEffect(() => {
    fetchComments(0);
  }, [fetchComments]);

  useEffect(() => {
    if (searchInit.current) { searchInit.current = false; return; }
    const timer = setTimeout(() => {
      fetchReviews(0, searchQuery);
      fetchComments(0, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchReviews, fetchComments]);

  const reviewsPages = Math.ceil(reviewsTotal / LIMIT) || 1;
  const reviewsPage = Math.floor(reviewsOffset / LIMIT) + 1;
  const commentsPages = Math.ceil(commentsTotal / LIMIT) || 1;
  const commentsPage = Math.floor(commentsOffset / LIMIT) + 1;

  const filteredReviews = useMemo(() => {
    if (reportFilter === "all") return reviews;
    return reviews.filter((row) => row.report_count > 0);
  }, [reviews, reportFilter]);

  const filteredComments = useMemo(() => {
    if (reportFilter === "all") return comments;
    return comments.filter((row) => row.report_count > 0);
  }, [comments, reportFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="공연 리뷰/댓글 관리"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "reviews") {
                fetchReviews(reviewsOffset, searchQuery);
              } else {
                fetchComments(commentsOffset, searchQuery);
              }
            }}
            disabled={activeTab === "reviews" ? reviewsLoading : commentsLoading}
          >
            <RefreshCw className="mr-1.5 size-4" />
            새로고침
          </Button>
        }
      />
      <Tabs
        defaultValue="reviews"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "reviews" | "comments")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
          <TabsTrigger value="reviews">리뷰</TabsTrigger>
          <TabsTrigger value="comments">댓글</TabsTrigger>
        </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={reportFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportFilter("all")}
            >
              전체
            </Button>
            <Button
              variant={reportFilter === "reported" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportFilter("reported")}
            >
              신고 있음
            </Button>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="내용 검색"
            className="pl-9"
          />
        </div>
        <TabsContent value="reviews" className="mt-4">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>리뷰 목록 (총 {reviewsTotal.toLocaleString("ko-KR")}건)</CardTitle>
              <p className="text-sm text-muted-foreground">
                현재 페이지 표시: {filteredReviews.length.toLocaleString("ko-KR")}건
              </p>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : reviewsError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">{reviewsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => fetchReviews(reviewsOffset, searchQuery)}
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
                        <TableHead>작성자</TableHead>
                        <TableHead>평점</TableHead>
                        <TableHead className="max-w-[200px]">내용</TableHead>
                        <TableHead>신고</TableHead>
                        <TableHead>작성일</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReviews.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            {searchQuery.trim() || reportFilter === "reported"
                              ? "검색/필터 결과가 없습니다."
                              : "등록된 리뷰가 없습니다."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReviews.map((r) => (
                          <TableRow key={r.id} className="hover:bg-muted/40">
                            <TableCell className="font-medium">{r.prfnm}</TableCell>
                            <TableCell>{r.nickname ?? "-"}</TableCell>
                            <TableCell>{r.rating}</TableCell>
                            <TableCell
                              className="max-w-[200px] truncate text-muted-foreground"
                              title={r.content ?? "-"}
                            >
                              {r.content ?? "-"}
                            </TableCell>
                            <TableCell>
                              {r.report_count > 0 ? (
                                <Badge variant="destructive">{r.report_count}건</Badge>
                              ) : (
                                <Badge variant="secondary">0건</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatAdminDateTime(r.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/wookicompany/admin/reviews/${r.id}`}>
                                  <ChevronRight className="size-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {reviewsPages > 1 && (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (reviewsPage > 1) fetchReviews(reviewsOffset - LIMIT, searchQuery);
                            }}
                            className={reviewsPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                            }}
                            isActive
                          >
                            {reviewsPage} / {reviewsPages}
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (reviewsPage < reviewsPages) fetchReviews(reviewsOffset + LIMIT, searchQuery);
                            }}
                            className={reviewsPage >= reviewsPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>댓글 목록 (총 {commentsTotal.toLocaleString("ko-KR")}건)</CardTitle>
              <p className="text-sm text-muted-foreground">
                현재 페이지 표시: {filteredComments.length.toLocaleString("ko-KR")}건
              </p>
            </CardHeader>
            <CardContent>
              {commentsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : commentsError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">{commentsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => fetchComments(commentsOffset, searchQuery)}
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
                        <TableHead>작성자</TableHead>
                        <TableHead className="max-w-[200px]">내용</TableHead>
                        <TableHead>신고</TableHead>
                        <TableHead>작성일</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {searchQuery.trim() || reportFilter === "reported"
                              ? "검색/필터 결과가 없습니다."
                              : "등록된 댓글이 없습니다."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredComments.map((c) => (
                          <TableRow key={c.id} className="hover:bg-muted/40">
                            <TableCell className="font-medium">{c.prfnm ?? "-"}</TableCell>
                            <TableCell>{c.nickname ?? "-"}</TableCell>
                            <TableCell
                              className="max-w-[200px] truncate text-muted-foreground"
                              title={c.content}
                            >
                              {c.content}
                            </TableCell>
                            <TableCell>
                              {c.report_count > 0 ? (
                                <Badge variant="destructive">{c.report_count}건</Badge>
                              ) : (
                                <Badge variant="secondary">0건</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatAdminDateTime(c.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/wookicompany/admin/reviews/comments/${c.id}`}>
                                  <ChevronRight className="size-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {commentsPages > 1 && (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (commentsPage > 1) fetchComments(commentsOffset - LIMIT, searchQuery);
                            }}
                            className={commentsPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                            }}
                            isActive
                          >
                            {commentsPage} / {commentsPages}
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (commentsPage < commentsPages) fetchComments(commentsOffset + LIMIT, searchQuery);
                            }}
                            className={commentsPage >= commentsPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
